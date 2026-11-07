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
      const to = await this.recipient(due.vendorId);
      if (!to) continue;
      // claim it first, so two runs never send the same email
      const claimed = await this.prisma.$executeRaw`
        INSERT INTO billing_reminders (vendor_id, kind, ends_at, email)
        VALUES (${due.vendorId}::uuid, ${due.kind}, ${due.endsAt}, ${to})
        ON CONFLICT (vendor_id, kind, ends_at) DO NOTHING`;
      if (!claimed) continue;
      try {
        await this.email.send({ to, ...reminderEmail(due, this.merchantUrl()) });
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

  /** The shop's merchant admin, else the shop's contact email. */
  private async recipient(vendorId: string): Promise<string | null> {
    const admin = await this.prisma.staff_users.findFirst({ where: { vendor_id: vendorId, role: 'vendor_admin', status: 'active' }, select: { email: true } });
    if (admin?.email) return admin.email;
    const v = await this.prisma.vendors.findUnique({ where: { id: vendorId }, select: { contact_email: true } });
    return v?.contact_email ?? null;
  }

  private merchantUrl(): string {
    return (this.config.get('MERCHANT_WEB_URL', { infer: true }) || 'https://merchant.dvote.co').replace(/\/+$/, '');
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function dateText(d: Date, lang: 'ar' | 'en') {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' }).format(d);
}

/** Arabic first (the dashboard's default language), then English. */
export function reminderEmail(due: Due, merchantUrl: string): { subject: string; html: string; text: string } {
  const ar = dateText(due.endsAt, 'ar');
  const en = dateText(due.endsAt, 'en');
  const link = `${merchantUrl}/settings?tab=billing`;
  const lock = BILLING.graceDays;
  const texts: Record<ReminderKind, { subject: string; ar: string; en: string }> = {
    trial_soon: {
      subject: `تجربتك المجانية على dvote بتخلص ${ar} · Your dvote free trial ends ${en}`,
      ar: `التجربة المجانية لـ ${due.name} بتخلص يوم ${ar}. اختار باقة وكلّمنا عشان تدفع، علشان لوحة التحكم والمسح يفضلوا شغالين.`,
      en: `The free trial for ${due.name} ends on ${en}. Pick a plan and contact us to pay, so your dashboard and scanning keep working.`,
    },
    trial_ended: {
      subject: `تجربتك المجانية على dvote خلصت · Your dvote free trial has ended`,
      ar: `التجربة المجانية لـ ${due.name} خلصت يوم ${ar}، ولوحة التحكم والمسح اتقفلوا. بياناتك محفوظة: اشترك في باقة وهنفتحلك المحل تاني.`,
      en: `The free trial for ${due.name} ended on ${en}, so the dashboard and scanning are locked. Your data is kept: subscribe to a plan and we'll open the shop again.`,
    },
    paid_soon: {
      subject: `اشتراكك في dvote بيتجدد ${ar} · Your dvote subscription renews ${en}`,
      ar: `اشتراك ${due.name} مدفوع لحد ${ar}. كلّمنا عشان تجدد قبلها، علشان ما يحصلش أي توقف.`,
      en: `The subscription for ${due.name} is paid until ${en}. Contact us to renew before then so nothing stops.`,
    },
    paid_ended: {
      subject: `اشتراكك في dvote خلص · Your dvote subscription has ended`,
      ar: `اشتراك ${due.name} خلص يوم ${ar}. عندك ${lock} أيام قبل ما لوحة التحكم والمسح يتقفلوا. جدد اشتراكك دلوقتي.`,
      en: `The subscription for ${due.name} ended on ${en}. You have ${lock} days before the dashboard and scanning lock. Renew now.`,
    },
  };
  const t = texts[due.kind];
  const button = (label: string) =>
    `<a href="${esc(link)}" style="display:inline-block;background:#1F3DFF;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${label}</a>`;
  const html = `<!doctype html><html><body style="margin:0;background:#F8F4F1;font-family:Arial,Helvetica,sans-serif;color:#18100F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:22px;font-weight:700;padding-bottom:24px">dvote</td></tr>
<tr><td dir="rtl" style="text-align:right;font-size:16px;line-height:1.7;padding-bottom:16px">${esc(t.ar)}</td></tr>
<tr><td dir="rtl" style="text-align:right;padding-bottom:28px">${button('افتح صفحة الاشتراك')}</td></tr>
<tr><td style="border-top:1px solid #EFE9E3;padding-top:24px;font-size:15px;line-height:1.6;padding-bottom:16px">${esc(t.en)}</td></tr>
<tr><td>${button('Open billing')}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: t.subject, html, text: `${t.ar}\n\n${t.en}\n\n${link}` };
}
