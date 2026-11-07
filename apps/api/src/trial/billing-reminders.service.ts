import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { BILLING } from '../plans/plans';
import { EmailService } from './email.service';

const DAY = 24 * 60 * 60 * 1000;

/** How long before the end the first reminder goes, and how late an "ended" email may still go. */
export const REMINDERS = { daysBefore: 5, endedWithinDays: 3 };

export type ReminderKind = 'trial_soon' | 'trial_ended' | 'paid_soon' | 'paid_ended';

interface Due {
  vendorId: string;
  name: string;
  kind: ReminderKind;
  endsAt: Date;
}

/**
 * Billing reminder emails to the merchant admin (decided 2026-11-07): one 5 days before a free trial
 * or a paid period ends, and one on the end date. Each is sent once per end date
 * (billing_reminders); a failed send is tried again on the next run. Without Resend configured,
 * nothing is sent or recorded.
 */
@Injectable()
export class BillingRemindersService {
  private readonly log = new Logger(BillingRemindersService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Returns how many emails were sent. */
  async run(now = new Date()): Promise<number> {
    if (!this.email.enabled) return 0;
    let sent = 0;
    for (const due of await this.due(now)) {
      const person = await this.recipient(due.vendorId);
      if (!person) continue;
      const to = person.email;
      // claim it first, so two runs never send the same email
      const claimed = await this.prisma.$executeRaw`
        INSERT INTO billing_reminders (vendor_id, kind, ends_at, email)
        VALUES (${due.vendorId}::uuid, ${due.kind}, ${due.endsAt}, ${to})
        ON CONFLICT (vendor_id, kind, ends_at) DO NOTHING`;
      if (!claimed) continue;
      try {
        await this.email.send({ to, ...reminderEmail(due, this.merchantUrl(), person.name) });
        sent++;
      } catch (err) {
        // not sent: forget the claim so the next run tries again
        await this.prisma.billing_reminders.deleteMany({ where: { vendor_id: due.vendorId, kind: due.kind, ends_at: due.endsAt } });
        this.log.warn(`Reminder ${due.kind} for shop ${due.vendorId} not sent: ${String(err)}`);
      }
    }
    return sent;
  }

  async due(now: Date): Promise<Due[]> {
    const soon = new Date(now.getTime() + REMINDERS.daysBefore * DAY);
    const recent = new Date(now.getTime() - REMINDERS.endedWithinDays * DAY);
    const [trials, paid] = await Promise.all([
      this.prisma.vendors.findMany({
        where: { plan_status: 'trial', trial_ends_at: { gt: recent, lte: soon } },
        select: { id: true, name: true, trial_ends_at: true },
      }),
      this.prisma.vendors.findMany({
        where: { plan_status: 'active', paid_until: { gt: recent, lte: soon } },
        select: { id: true, name: true, paid_until: true },
      }),
    ]);
    return [
      ...trials.map((v) => ({ vendorId: v.id, name: v.name, endsAt: v.trial_ends_at!, kind: (v.trial_ends_at! <= now ? 'trial_ended' : 'trial_soon') as ReminderKind })),
      ...paid.map((v) => ({ vendorId: v.id, name: v.name, endsAt: v.paid_until!, kind: (v.paid_until! <= now ? 'paid_ended' : 'paid_soon') as ReminderKind })),
    ];
  }

  /** The shop's merchant admin (with their name for the greeting), else the shop's contact email. */
  private async recipient(vendorId: string): Promise<{ email: string; name: string | null } | null> {
    const admin = await this.prisma.staff_users.findFirst({ where: { vendor_id: vendorId, role: 'vendor_admin', status: 'active' }, select: { email: true, name: true } });
    if (admin?.email) return { email: admin.email, name: admin.name };
    const v = await this.prisma.vendors.findUnique({ where: { id: vendorId }, select: { contact_email: true } });
    return v?.contact_email ? { email: v.contact_email, name: null } : null;
  }

  private merchantUrl(): string {
    return (this.config.get('MERCHANT_WEB_URL', { infer: true }) || 'https://merchant.dvote.co').replace(/\/+$/, '');
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function dateText(d: Date, lang: 'ar' | 'en') {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' }).format(d);
}

/** The colour logo for white emails (built by docs/email-templates/src/build-assets.mjs). */
export const EMAIL_LOGO_URL = 'https://dvote.co/email/logo-colour.png';

/**
 * Arabic first (the dashboard's default language), then English. Written like an account email: white,
 * a small logo and slogan, a greeting by name, a text link (no banner or big button), a quiet footer.
 * Inbox providers sort that as a personal / transactional message rather than marketing.
 */
export function reminderEmail(due: Due, merchantUrl: string, personName: string | null = null, logoUrl = EMAIL_LOGO_URL): { subject: string; html: string; text: string } {
  const ar = dateText(due.endsAt, 'ar');
  const en = dateText(due.endsAt, 'en');
  const link = `${merchantUrl}/settings?tab=billing`;
  const lock = BILLING.graceDays;
  const first = personName?.trim().split(/\s+/)[0] || null;
  const texts: Record<ReminderKind, { subject: string; ar: string; en: string }> = {
    trial_soon: {
      subject: `${due.name}: تجربة dvote بتخلص ${ar} · trial ends ${en}`,
      ar: `التجربة المجانية لـ ${due.name} بتخلص يوم ${ar}. عشان لوحة التحكم والمسح يفضلوا شغالين، اختار باقة من صفحة الاشتراك وكلّمنا عشان الدفع.`,
      en: `The free trial for ${due.name} ends on ${en}. To keep your dashboard and scanning working, pick a plan on your billing page and contact us to pay.`,
    },
    trial_ended: {
      subject: `${due.name}: تجربة dvote خلصت · trial ended`,
      ar: `التجربة المجانية لـ ${due.name} خلصت يوم ${ar}، فلوحة التحكم والمسح اتقفلوا. بياناتك محفوظة، وأول ما تشترك في باقة هنفتحلك المحل تاني.`,
      en: `The free trial for ${due.name} ended on ${en}, so the dashboard and scanning are locked. Your data is kept, and once you subscribe to a plan we'll open the shop again.`,
    },
    paid_soon: {
      subject: `${due.name}: اشتراك dvote بيتجدد ${ar} · renews ${en}`,
      ar: `اشتراك ${due.name} مدفوع لحد ${ar}. كلّمنا عشان تجدد قبلها، علشان ما يحصلش أي توقف.`,
      en: `The subscription for ${due.name} is paid until ${en}. Contact us to renew before then so nothing stops.`,
    },
    paid_ended: {
      subject: `${due.name}: اشتراك dvote خلص · subscription ended`,
      ar: `اشتراك ${due.name} خلص يوم ${ar}. عندك ${lock} أيام قبل ما لوحة التحكم والمسح يتقفلوا، فجدد اشتراكك قبلها.`,
      en: `The subscription for ${due.name} ended on ${en}. You have ${lock} days before the dashboard and scanning lock, so please renew before then.`,
    },
  };
  const t = texts[due.kind];
  const hiAr = first ? `أهلًا ${first}،` : 'أهلًا،';
  const hiEn = first ? `Hi ${first},` : 'Hi,';
  const a = (label: string) => `<a href="${esc(link)}" style="color:#1F3DFF">${label}</a>`;
  const p = 'margin:0 0 14px;font-size:15px;line-height:1.6';
  const small = 'margin:0;font-size:12px;line-height:1.6;color:#6B5F57';
  const html = `<!doctype html><html><body style="margin:0;padding:24px 16px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#18100F">
<div style="max-width:560px">
<a href="https://dvote.co" style="text-decoration:none"><img src="${logoUrl}" width="104" height="33" alt="dvote" style="display:block;border:0"></a>
<p style="${small};margin:6px 0 24px">Loyalty cards in your customers' wallet · كروت ولاء في محفظة زباينك</p>
<div dir="rtl" style="text-align:right">
<p style="${p}">${esc(hiAr)}</p>
<p style="${p}">${esc(t.ar)}</p>
<p style="${p}">صفحة الاشتراك: ${a(esc(link))}</p>
<p style="${p}">لو عندك أي سؤال، رد على الإيميل ده.<br>فريق dvote</p>
</div>
<hr style="border:none;border-top:1px solid #EFE9E3;margin:24px 0">
<p style="${p}">${esc(hiEn)}</p>
<p style="${p}">${esc(t.en)}</p>
<p style="${p}">Your billing page: ${a(esc(link))}</p>
<p style="${p}">Any questions? Just reply to this email.<br>The dvote team</p>
<hr style="border:none;border-top:1px solid #EFE9E3;margin:24px 0 16px">
<p style="${small}">You get this email because you manage ${esc(due.name)} on dvote. · وصلك الإيميل ده عشان إنت مسؤول ${esc(due.name)} على dvote.</p>
<p style="${small};margin-top:6px">dvote · Made in Egypt · <a href="https://dvote.co" style="color:#6B5F57">dvote.co</a></p>
</div></body></html>`;
  const text = `${hiAr}\n\n${t.ar}\n\nصفحة الاشتراك: ${link}\n\nلو عندك أي سؤال، رد على الإيميل ده.\nفريق dvote\n\n---\n\n${hiEn}\n\n${t.en}\n\nYour billing page: ${link}\n\nAny questions? Just reply to this email.\nThe dvote team\n\n---\nYou get this email because you manage ${due.name} on dvote. dvote · Made in Egypt · https://dvote.co`;
  return { subject: t.subject, html, text };
}
