import { AltArrowLeftIcon, CloseIcon, GiftIcon, LinkIcon, MapPointIcon, MenuDotsIcon, PhoneIcon } from '@solar-icons/react/linear';
import { useState, type ReactNode } from 'react';
import { Slider } from '@/components/ui/slider';
import { Segmented } from '../../../components/segmented';
import { t } from '../../../i18n';
import type { CardDesign } from '../../../lib/api';
import { linkHref, MAX_PREVIEW_POINTS, pick } from '../../../lib/card-look';
import { cn } from '@/lib/utils';
import { CardFace, WALLET_WORDS, type PreviewDevice, type PreviewLanguage } from './card-face';

const LINK_NAMES = {
  instagram: { en: 'Instagram', ar: 'إنستغرام' },
  facebook: { en: 'Facebook', ar: 'فيسبوك' },
  tiktok: { en: 'TikTok', ar: 'تيك توك' },
  x: { en: 'X', ar: 'إكس' },
  snapchat: { en: 'Snapchat', ar: 'سناب شات' },
  whatsapp: { en: 'WhatsApp', ar: 'واتساب' },
  youtube: { en: 'YouTube', ar: 'يوتيوب' },
  linkedin: { en: 'LinkedIn', ar: 'لينكدإن' },
  website: { en: 'Website', ar: 'الموقع' },
} as const;

const DAYS = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ar: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
};
const WEEK = [0, 1, 2, 3, 4, 5, 6];

export interface PreviewInput {
  design: CardDesign;
  merchant: { name: string; logoUrl: string | null };
  /** Branch names for the Directions button. */
  branches: { id: string; name: string }[];
}

interface Rendered extends PreviewInput {
  device: PreviewDevice;
  lang: PreviewLanguage;
  points: number;
}

/** The live preview: iPhone | Android × English | Arabic × front | back, with a points number. */
export function CardPreview(input: PreviewInput) {
  const [device, setDevice] = useState<PreviewDevice>('iphone');
  const [lang, setLang] = useState<PreviewLanguage>('en');
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [points, setPoints] = useState(73);
  const props: Rendered = { ...input, device, lang, points };

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Segmented
          label={t('cards.preview.title')}
          value={device}
          onChange={setDevice}
          options={[
            { value: 'iphone', label: t('cards.preview.iphone') },
            { value: 'android', label: t('cards.preview.android') },
          ]}
        />
        <Segmented
          label={t('cards.front.english')}
          value={lang}
          onChange={setLang}
          options={[
            { value: 'en', label: 'EN' },
            { value: 'ar', label: 'ع' },
          ]}
        />
      </div>
      <Segmented
        value={side}
        onChange={setSide}
        options={[
          { value: 'front', label: t('cards.preview.front') },
          {
            value: 'back',
            label: device === 'iphone' ? t('cards.preview.back') : t('cards.preview.details'),
          },
        ]}
      />

      <div className="flex justify-center py-1">
        {device === 'iphone' ? (
          <PhoneFrame>{side === 'front' ? <IPhoneWalletFront {...props} /> : <IPhoneBack {...props} />}</PhoneFrame>
        ) : side === 'front' ? (
          <AndroidFrontView {...props} />
        ) : (
          <AndroidDetails {...props} />
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {device === 'iphone' ? t('cards.preview.iphoneNote') : t('cards.preview.androidNote')}
      </p>
      <div className="grid gap-3 px-1">
        <p id="preview-points" className="text-sm text-muted-foreground">
          {t('cards.preview.points', { count: points })}
        </p>
        <Slider aria-labelledby="preview-points" min={0} max={MAX_PREVIEW_POINTS} step={1} value={[points]} onValueChange={([v]) => setPoints(v)} />
      </div>
    </div>
  );
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="w-[300px] max-w-full rounded-[44px] bg-neutral-900 p-2 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.5)]" dir="ltr">
      <div className="relative h-[600px] overflow-hidden rounded-[36px] bg-black text-white">
        <div className="flex items-center justify-between px-7 pt-3 text-[13px] font-semibold">
          <span>9:41</span>
          <span className="h-[22px] w-[86px] rounded-full bg-neutral-900" aria-hidden />
          <span className="text-[11px]">●●● ▮</span>
        </div>
        <div className="h-[calc(100%-34px)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/** Button 2 as the customer sees it, or null. */
function secondButton(p: Rendered) {
  const s = p.design.buttons.secondary;
  const w = WALLET_WORDS[p.lang];
  if (s.type === 'directions') {
    const branch = p.branches.find((b) => b.id === s.branchId);
    return {
      icon: MapPointIcon,
      label: w.directions,
      detail: branch?.name ?? '',
    };
  }
  if (s.type === 'call') return { icon: PhoneIcon, label: w.call, detail: s.phone };
  return null;
}

function IPhoneWalletFront(p: Rendered) {
  const second = secondButton(p);
  return (
    <div dir={p.lang === 'ar' ? 'rtl' : 'ltr'} className="px-3 pb-6">
      <div className="flex items-center justify-between py-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-neutral-800">
          <CloseIcon className="size-4" />
        </span>
        <span className="flex size-8 items-center justify-center rounded-full bg-neutral-800">
          <MenuDotsIcon className="size-4" />
        </span>
      </div>
      <CardFace {...p} width={268} />
      <div className="mt-3 flex justify-center gap-1" aria-hidden>
        <span className="size-1.5 rounded-full bg-white" />
        <span className="size-1.5 rounded-full bg-white/40" />
      </div>
      <div className="mt-3 grid gap-2">
        <WalletButton icon={GiftIcon} tone="bg-fuchsia-500" label={pick(p.design.buttons.primaryLabel, p.lang)} detail={WALLET_WORDS[p.lang].open} />
        {second ? <WalletButton icon={second.icon} tone="bg-sky-500" label={second.label} detail={second.detail} /> : null}
      </div>
    </div>
  );
}

function WalletButton({ icon: Icon, tone, label, detail }: { icon: typeof GiftIcon; tone: string; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-neutral-800/90 px-3 py-2.5">
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-white', tone)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold">{label}</div>
        <div className="truncate text-[11px] text-neutral-400" dir="auto">
          {detail}
        </div>
      </div>
    </div>
  );
}

function hoursLines(p: Rendered) {
  return WEEK.flatMap((day) => {
    const slots = p.design.back.hours.filter((h) => h.day === day);
    return slots.length ? [`${DAYS[p.lang][day]} ${slots.map((s) => `${s.opensAt}–${s.closesAt}`).join(', ')}`] : [];
  });
}

function linkRows(p: Rendered) {
  return p.design.back.links.map((l) => ({
    name: l.platform === 'custom' ? (l.label ?? '') : LINK_NAMES[l.platform][p.lang],
    value: l.platform === 'custom' ? linkHref(l).replace(/^https?:\/\//, '') : l.value,
  }));
}

function IPhoneBack(p: Rendered) {
  const w = WALLET_WORDS[p.lang];
  const d = p.design;
  const second = secondButton(p);
  const hours = hoursLines(p);
  const Row = ({ title, children }: { title: string; children?: ReactNode }) => (
    <div className="border-b border-white/10 py-2.5 last:border-0">
      <div className="text-[13px]">{title}</div>
      {children ? <div className="mt-0.5 text-[12px] whitespace-pre-line text-neutral-400">{children}</div> : null}
    </div>
  );
  const LinkRow = ({ title, value }: { title: string; value: string }) => (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 py-2.5 text-[13px] last:border-0">
      <span className="truncate">{title}</span>
      <span className="truncate text-sky-400" dir="auto">
        {value}
      </span>
    </div>
  );
  return (
    <div dir={p.lang === 'ar' ? 'rtl' : 'ltr'} className="px-3 pb-6">
      <div className="flex items-center gap-2 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-800">
          <AltArrowLeftIcon className="size-4 rtl:rotate-180" />
        </span>
        <span className="truncate text-[13px] font-semibold">
          {pick(d.front.title, p.lang)} — {p.merchant.name}
        </span>
      </div>
      <div className="rounded-2xl bg-neutral-900 px-3">
        {[w.updates, w.notifications, w.lockScreen].map((label) => (
          <div key={label} className="flex items-center justify-between border-b border-white/10 py-2 text-[13px] last:border-0">
            <span>{label}</span>
            <span className="flex h-5 w-9 items-center justify-end rounded-full bg-green-500 px-0.5 rtl:justify-start">
              <span className="size-4 rounded-full bg-white" />
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl bg-neutral-900 px-3">
        <LinkRow title={pick(d.buttons.primaryLabel, p.lang)} value={w.open} />
        {second ? <LinkRow title={second.label} value={second.detail} /> : null}
        {d.back.about ? <Row title={w.about}>{d.back.about}</Row> : null}
        {hours.length ? <Row title={w.hours}>{hours.join('\n')}</Row> : null}
        {linkRows(p).map((l, i) => (
          <LinkRow key={i} title={l.name} value={l.value} />
        ))}
        {d.back.terms ? <Row title={w.terms}>{d.back.terms}</Row> : null}
        <LinkRow title={w.cardCode} value="K7M-4QX" />
        <LinkRow title={`${w.poweredBy} dvote`} value="dvote.app" />
      </div>
    </div>
  );
}

function AndroidFrontView(p: Rendered) {
  return (
    <div className="grid w-[300px] max-w-full justify-items-center gap-3 rounded-3xl bg-muted/60 p-4">
      <CardFace {...p} width={268} />
      <div dir={p.lang === 'ar' ? 'rtl' : 'ltr'} className="flex w-[268px] max-w-full">
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-[13px]">
          <LinkIcon className="size-4" /> {pick(p.design.buttons.primaryLabel, p.lang)}
        </span>
      </div>
    </div>
  );
}

function AndroidDetails(p: Rendered) {
  const w = WALLET_WORDS[p.lang];
  const d = p.design;
  const second = secondButton(p);
  const hours = hoursLines(p);
  const Block = ({ title, body }: { title: string; body: string }) => (
    <div className="border-b py-3">
      <div className="text-[14px] font-medium">{title}</div>
      <div className="mt-0.5 text-[13px] whitespace-pre-line text-muted-foreground">{body}</div>
    </div>
  );
  const links = [pick(d.buttons.primaryLabel, p.lang), ...(second ? [second.label] : []), ...linkRows(p).map((l) => l.name), `${w.poweredBy} dvote`];
  return (
    <div
      dir={p.lang === 'ar' ? 'rtl' : 'ltr'}
      className="w-[300px] max-w-full rounded-3xl bg-card p-4 ring-1 ring-border"
      style={{ fontFamily: 'Roboto, Inter, system-ui, sans-serif' }}
    >
      <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: d.colors.background, color: d.colors.text }}>
        <div className="text-[12px] opacity-80">{p.merchant.name}</div>
        <div className="truncate text-[18px] font-medium">{pick(d.front.title, p.lang)}</div>
      </div>
      {d.back.about ? <Block title={w.about} body={d.back.about} /> : null}
      {hours.length ? <Block title={w.hours} body={hours.join('\n')} /> : null}
      {d.back.terms ? <Block title={w.terms} body={d.back.terms} /> : null}
      <div className="pt-3 text-[14px] font-medium">{w.links}</div>
      <ul className="mt-1 grid gap-1">
        {links.map((l, i) => (
          <li key={i} className="flex items-center gap-3 py-1.5 text-[13px] text-primary">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <LinkIcon className="size-4" />
            </span>
            <span className="truncate">{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
