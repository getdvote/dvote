import { QRCodeSVG } from 'qrcode.react';
import type { CardDesign } from '../../../lib/api';
import { cardBackground, pick, readableInk } from '../../../lib/card-look';
import { cn } from '@/lib/utils';

export type PreviewDevice = 'iphone' | 'android';
export type PreviewLanguage = 'en' | 'ar';

/** Wallet wording in both languages: the preview language is chosen on its own, not the dashboard's. */
export const WALLET_WORDS = {
  en: {
    cardholder: 'Cardholder',
    code: 'Code',
    member: 'Member',
    points: 'Points',
    poweredBy: 'Powered by',
    sampleName: 'Lucía García',
    open: 'Open',
    about: 'About',
    hours: 'Opening hours',
    terms: 'Terms',
    links: 'Links',
    cardCode: 'Card code',
    updates: 'Automatic Updates',
    notifications: 'Allow Notifications',
    lockScreen: 'Suggest on Lock Screen',
    directions: 'Directions',
    call: 'Call',
  },
  ar: {
    cardholder: 'حامل البطاقة',
    code: 'الرمز',
    member: 'العضو',
    points: 'النقاط',
    poweredBy: 'بدعم من',
    sampleName: 'ليلى حسن',
    open: 'فتح',
    about: 'نبذة',
    hours: 'مواعيد العمل',
    terms: 'الشروط',
    links: 'الروابط',
    cardCode: 'رمز البطاقة',
    updates: 'التحديثات التلقائية',
    notifications: 'السماح بالإشعارات',
    lockScreen: 'الاقتراح على شاشة القفل',
    directions: 'الاتجاهات',
    call: 'اتصال',
  },
} as const;

export interface FaceProps {
  design: CardDesign;
  device: PreviewDevice;
  lang: PreviewLanguage;
  points: number;
  merchant: { name: string; logoUrl: string | null };
  cardholder?: string;
  code?: string;
  /** Rendered width in px; the face is drawn at 320 px and scaled. */
  width?: number;
  className?: string;
}

const BASE_W = 320;
const H = { iphone: 452, android: 470 };
const SAMPLE_QR = 'dvote:c1:preview-only-not-a-card';

/** A card front at a real wallet size, scaled to `width`. */
export function CardFace({ width = BASE_W, ...props }: FaceProps) {
  const scale = width / BASE_W;
  const h = H[props.device];
  return (
    <div className={cn('relative shrink-0 overflow-hidden', props.className)} style={{ width, height: h * scale }}>
      {/* exactly BASE_W wide, so pinning it top-left fills the box in either direction;
          `rtl:` would also fire inside an LTR phone on an Arabic page and push it sideways */}
      <div className="absolute top-0 left-0 origin-top-left" style={{ width: BASE_W, height: h, transform: `scale(${scale})` }}>
        {props.device === 'iphone' ? <IPhoneFront {...props} /> : <AndroidFront {...props} />}
      </div>
    </div>
  );
}

function Logo({ merchant, size, round }: { merchant: FaceProps['merchant']; size: number; round?: boolean }) {
  return merchant.logoUrl ? (
    <img
      src={merchant.logoUrl}
      alt=""
      className={cn('shrink-0 object-cover', round ? 'rounded-full' : 'rounded-md')}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className={cn('flex shrink-0 items-center justify-center bg-white/25 font-semibold', round ? 'rounded-full' : 'rounded-md')}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {merchant.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function IPhoneFront({ design, lang, points, merchant, cardholder, code }: FaceProps) {
  const w = WALLET_WORDS[lang];
  const ink = design.colors.text;
  const label = design.colors.label;
  const pointsLabel = pick(design.front.pointsLabel, lang);
  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="flex size-full flex-col overflow-hidden rounded-[18px] px-4 pt-3.5 pb-4 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)]"
      style={{ ...cardBackground(design), color: ink }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo merchant={merchant} size={30} />
          <span className="truncate text-[15px] font-semibold tracking-tight">{pick(design.front.title, lang)}</span>
        </div>
        <div className="shrink-0 text-end">
          <div className="text-[9px] font-semibold tracking-[0.12em] uppercase" style={{ color: label }}>
            {pointsLabel}
          </div>
          <div className="text-[17px] leading-tight tabular-nums">{points}</div>
        </div>
      </div>

      <div className="mt-7 text-center">
        <div className="text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ color: label }}>
          {pointsLabel}
        </div>
        <div className="text-[60px] leading-none font-bold tracking-tight tabular-nums">{points}</div>
      </div>

      <div className="mt-7 flex justify-between gap-3 text-[13px]">
        <div className="min-w-0">
          <div className="text-[9px] font-semibold tracking-[0.12em] uppercase" style={{ color: label }}>
            {w.cardholder}
          </div>
          <div className="truncate">{cardholder ?? w.sampleName}</div>
        </div>
        <div className="shrink-0 text-end">
          <div className="text-[9px] font-semibold tracking-[0.12em] uppercase" style={{ color: label }}>
            {w.code}
          </div>
          <div dir="ltr">{code ?? 'K7M-4QX'}</div>
        </div>
      </div>

      <div className="mt-auto flex justify-center">
        <div className="rounded-xl bg-white px-3 pt-3 pb-1.5 text-center text-neutral-900">
          <QRCodeSVG value={SAMPLE_QR} size={104} level="M" marginSize={0} />
          <div className="mt-1 text-[9px]">{w.poweredBy} dvote</div>
        </div>
      </div>
    </div>
  );
}

/** Google draws its own layout: flat colour, black or white text it picks, the image at the bottom. */
function AndroidFront({ design, lang, points, merchant, cardholder, code }: FaceProps) {
  const w = WALLET_WORDS[lang];
  const bg = design.colors.background;
  const ink = readableInk(bg);
  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="flex size-full flex-col overflow-hidden rounded-[24px] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.5)]"
      style={{
        backgroundColor: bg,
        color: ink,
        fontFamily: 'Roboto, Inter, system-ui, sans-serif',
      }}
    >
      <div className="px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <Logo merchant={merchant} size={34} round />
          <span className="truncate text-[14px]">{merchant.name}</span>
        </div>
        <div className="mt-3 truncate text-[24px] leading-tight">{pick(design.front.title, lang)}</div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <div className="opacity-75">{pick(design.front.pointsLabel, lang)}</div>
            <div className="text-[16px] tabular-nums">{points}</div>
          </div>
          <div className="min-w-0">
            <div className="opacity-75">{w.member}</div>
            <div className="truncate text-[16px]">{cardholder ?? w.sampleName}</div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-center">
        <div className="rounded-xl bg-white p-3 text-center text-neutral-800">
          <QRCodeSVG value={SAMPLE_QR} size={112} level="M" marginSize={0} />
          <div className="mt-1.5 text-[11px] tracking-[0.2em]" dir="ltr">
            {code ?? 'K7M-4QX'}
          </div>
        </div>
      </div>
      {design.background.imageUrl ? (
        <img src={design.background.imageUrl} alt="" className="mt-auto h-[118px] w-full object-cover" />
      ) : (
        <div className="mt-auto pb-4 text-center text-[10px] opacity-70">{w.poweredBy} dvote</div>
      )}
    </div>
  );
}
