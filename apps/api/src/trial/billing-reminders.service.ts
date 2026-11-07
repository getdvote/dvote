import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { BILLING } from '../plans/plans';
import { EmailService } from './email.service';
import { dvoteEmail, esc } from './email-layout';

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

function dateText(d: Date, lang: 'ar' | 'en') {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' }).format(d);
}

/**
 * Arabic first (the dashboard's default language), then English, in the same frame as the dvote
 * sign-in emails (`email-layout.ts`): eyebrow, headline, a greeting by name, the text, a button to
 * Billing and "reply to this email". Replies go to EMAIL_REPLY_TO.
 */
export function reminderEmail(due: Due, merchantUrl: string, personName: string | null = null): { subject: string; html: string; text: string } {
  const ar = dateText(due.endsAt, 'ar');
  const en = dateText(due.endsAt, 'en');
  const link = `${merchantUrl}/settings?tab=billing`;
  const lock = BILLING.graceDays;
  const first = personName?.trim().split(/\s+/)[0] || null;
  const shop = due.name;
  type Copy = { subject: string; preheader: string; ar: { eyebrow: string; title: string; text: string }; en: { eyebrow: string; title: string; text: string } };
  const texts: Record<ReminderKind, Copy> = {
    trial_soon: {
      subject: `${shop}: تجربة dvote بتخلص ${ar} · trial ends ${en}`,
      preheader: `Your free trial ends on ${en}. Pick a plan to keep going.`,
      ar: { eyebrow: 'تجربتك المجانية', title: `باقي أيام قليلة على تجربتك`, text: `التجربة المجانية لـ ${shop} بتخلص يوم ${ar}. عشان لوحة التحكم والمسح يفضلوا شغالين، اختار باقة من صفحة الاشتراك وكلّمنا عشان الدفع.` },
      en: { eyebrow: 'Your free trial', title: 'Your trial ends soon', text: `The free trial for ${shop} ends on ${en}. To keep your dashboard and scanning working, pick a plan on your billing page and contact us to pay.` },
    },
    trial_ended: {
      subject: `${shop}: تجربة dvote خلصت · trial ended`,
      preheader: 'Your free trial has ended. Your data is kept.',
      ar: { eyebrow: 'تجربتك المجانية', title: 'تجربتك المجانية خلصت', text: `التجربة المجانية لـ ${shop} خلصت يوم ${ar}، فلوحة التحكم والمسح اتقفلوا. بياناتك محفوظة، وأول ما تشترك في باقة هنفتحلك المحل تاني.` },
      en: { eyebrow: 'Your free trial', title: 'Your trial has ended', text: `The free trial for ${shop} ended on ${en}, so the dashboard and scanning are locked. Your data is kept, and once you subscribe to a plan we'll open the shop again.` },
    },
    paid_soon: {
      subject: `${shop}: اشتراك dvote بيتجدد ${ar} · renews ${en}`,
      preheader: `Your plan is paid until ${en}. Renew to keep going.`,
      ar: { eyebrow: 'اشتراكك', title: 'اشتراكك قرّب يخلص', text: `اشتراك ${shop} مدفوع لحد ${ar}. كلّمنا عشان تجدد قبلها، علشان ما يحصلش أي توقف.` },
      en: { eyebrow: 'Your subscription', title: 'Time to renew', text: `The subscription for ${shop} is paid until ${en}. Contact us to renew before then so nothing stops.` },
    },
    paid_ended: {
      subject: `${shop}: اشتراك dvote خلص · subscription ended`,
      preheader: `Your subscription ended. ${lock} days before the dashboard locks.`,
      ar: { eyebrow: 'اشتراكك', title: 'اشتراكك خلص', text: `اشتراك ${shop} خلص يوم ${ar}. عندك ${lock} أيام قبل ما لوحة التحكم والمسح يتقفلوا، فجدد اشتراكك قبلها.` },
      en: { eyebrow: 'Your subscription', title: 'Your subscription ended', text: `The subscription for ${shop} ended on ${en}. You have ${lock} days before the dashboard and scanning lock, so please renew before then.` },
    },
  };
  const t = texts[due.kind];
  const hiAr = first ? `أهلًا ${first}،` : 'أهلًا،';
  const hiEn = first ? `Hi ${first},` : 'Hi,';
  const html = dvoteEmail({
    preheader: t.preheader,
    ar: {
      eyebrow: t.ar.eyebrow,
      title: esc(t.ar.title),
      body: [esc(hiAr), esc(t.ar.text)],
      button: { label: 'افتح صفحة الاشتراك', href: link },
      note: 'لو عندك أي سؤال، رد على الإيميل ده وهنرد عليك.',
    },
    en: {
      eyebrow: t.en.eyebrow,
      title: esc(t.en.title),
      body: [esc(hiEn), esc(t.en.text)],
      button: { label: 'Open billing', href: link },
      note: 'Any questions? Just reply to this email and we\'ll get back to you.',
    },
    footerAr: `وصلك الإيميل ده عشان إنت مسؤول ${esc(shop)} على dvote.`,
    footerEn: `You get this email because you manage ${esc(shop)} on dvote.`,
  });
  const text = `${hiAr}\n\n${t.ar.text}\n\nصفحة الاشتراك: ${link}\n\nلو عندك أي سؤال، رد على الإيميل ده.\nفريق dvote\n\n---\n\n${hiEn}\n\n${t.en.text}\n\nYour billing page: ${link}\n\nAny questions? Just reply to this email.\nThe dvote team\n\n---\nGood things come back. · dvote.co`;
  return { subject: t.subject, html, text };
}
