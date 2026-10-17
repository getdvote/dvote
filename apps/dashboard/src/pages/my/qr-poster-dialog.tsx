import { DownloadMinimalisticIcon, LoaderIcon as Loader2, SquareTopDownIcon } from '@solar-icons/react/linear';
import { QRCodeSVG } from 'qrcode.react';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DvoteLogo } from '../../components/DvoteLogo';
import { Field } from '../../components/Field';
import { Segmented } from '../../components/segmented';
import { initial } from '../../components/PageHeader';
import { cardDesign } from '../../lib/cardDesigns';
import type { Vendor } from '../../lib/api';
import { t, useI18n } from '../../i18n';

type PosterSize = 'a5' | 'a6';
type PosterLanguage = 'en' | 'ar';

/** Both sizes print on an A5 sheet (148 × 210 mm): the A6 table tent is two halves folded in the middle. */
const SHEET = { w: 148, h: 210 };
const MM = 96 / 25.4;
const ALL = 'all';
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.8 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>',
)}")`;

/** Poster wording follows the poster's language, not the dashboard's. */
const COPY: Record<PosterLanguage, { headline: string; body: string; poweredBy: string }> = {
  en: {
    headline: 'Scan to join our loyalty card',
    body: "Collect points on every visit. Your card lives in your phone's wallet, nothing to install.",
    poweredBy: 'Powered by',
  },
  ar: {
    headline: 'امسح الرمز وانضم لبطاقة الولاء',
    body: 'اجمع النقاط مع كل زيارة. بطاقتك في محفظة هاتفك، بدون تثبيت أي تطبيق.',
    poweredBy: 'بدعم من',
  },
};

/** Text on the brand colour: dark ink on light colours, white otherwise. */
function inkOn(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#1C1C1E' : '#FFFFFF';
}

interface PosterProps {
  vendor: Vendor;
  language: PosterLanguage;
  headline: string;
  branchName: string | null;
  /** What the QR opens (with ?s=qr). */
  qrValue: string;
  /** The address printed under the QR. */
  shownUrl: string;
}

/**
 * The printable QR poster: an A5 poster for the wall or the till, or an A6 table tent (two halves
 * on one A5 sheet, the top one upside down, folded along the dashed line). Sized in millimetres, so
 * the PDF comes out at real size.
 */
export function QrPosterDialog({
  open,
  onOpenChange,
  vendor,
  branches,
  initialBranchId,
  urlFor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: Vendor;
  branches: { id: string; name: string }[];
  initialBranchId?: string;
  /** The storefront address, for one branch or the whole shop. */
  urlFor: (branchId?: string) => string | null;
}) {
  const { language: dashboardLanguage } = useI18n();
  const [size, setSize] = useState<PosterSize>('a5');
  const [language, setLanguage] = useState<PosterLanguage>(dashboardLanguage === 'ar' ? 'ar' : 'en');
  const [headline, setHeadline] = useState('');
  const [branchId, setBranchId] = useState<string>(initialBranchId ?? ALL);
  const [busy, setBusy] = useState<'download' | 'tab' | null>(null);
  const sheet = useRef<HTMLDivElement>(null);

  const branch = branches.find((b) => b.id === branchId) ?? null;
  const url = urlFor(branch?.id);
  if (!url) return null;
  const qrValue = `${url}${url.includes('?') ? '&' : '?'}s=qr`;
  const poster: PosterProps = {
    vendor,
    language,
    headline: headline.trim() || COPY[language].headline,
    branchName: branch?.name ?? null,
    qrValue,
    shownUrl: (urlFor() ?? url).replace(/^https?:\/\//, ''),
  };

  const exportPdf = async (mode: 'download' | 'tab') => {
    if (!sheet.current || busy) return;
    // a new tab must open while the click is still "fresh", or the browser blocks it
    const tab = mode === 'tab' ? window.open('', '_blank') : null;
    setBusy(mode);
    try {
      const blob = await renderPdf(sheet.current);
      const href = URL.createObjectURL(blob);
      if (tab) tab.location.href = href;
      else {
        const a = document.createElement('a');
        a.href = href;
        a.download = `${vendor.slug}${branch ? '-branch' : ''}-qr-${size === 'a5' ? 'a5-poster' : 'a6-table-tent'}-${language}.pdf`;
        a.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } catch {
      tab?.close();
      toast.error(t('qrPoster.failed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-5xl md:max-h-[calc(100dvh-2rem)]">
        <div className="grid min-h-0 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="grid content-start gap-5 overflow-y-auto p-5 sm:p-6">
            <DialogHeader>
              <DialogTitle>{t('qrPoster.title')}</DialogTitle>
              <DialogDescription>{t('qrPoster.subtitle')}</DialogDescription>
            </DialogHeader>

            <Field label={t('qrPoster.size')} htmlFor="qr-size" hint={size === 'a5' ? t('qrPoster.a5Hint') : t('qrPoster.a6Hint')}>
              <Segmented
                id="qr-size"
                value={size}
                onChange={setSize}
                options={[
                  { value: 'a5', label: t('qrPoster.a5') },
                  { value: 'a6', label: t('qrPoster.a6') },
                ]}
              />
            </Field>

            <Field label={t('qrPoster.language')} htmlFor="qr-language" hint={t('qrPoster.languageHint')}>
              <Segmented
                id="qr-language"
                value={language}
                onChange={setLanguage}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'ar', label: 'العربية' },
                ]}
              />
            </Field>

            <Field
              label={
                <>
                  {t('qrPoster.headline')} <span className="font-normal text-muted-foreground">{t('qrPoster.optional')}</span>
                </>
              }
              htmlFor="qr-headline"
              hint={t('qrPoster.headlineHint', { text: COPY[language].headline })}
            >
              <Input
                id="qr-headline"
                value={headline}
                maxLength={48}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
                placeholder={COPY[language].headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
            </Field>

            {branches.length ? (
              <Field label={t('qrPoster.branch')} htmlFor="qr-branch" hint={t('qrPoster.branchHint')}>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger id="qr-branch" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t('qrPoster.noBranch')}</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button disabled={!!busy} onClick={() => exportPdf('download')}>
                {busy === 'download' ? <Loader2 className="animate-spin" /> : <DownloadMinimalisticIcon />} {t('qrPoster.download')}
              </Button>
              <Button variant="outline" disabled={!!busy} onClick={() => exportPdf('tab')}>
                {busy === 'tab' ? <Loader2 className="animate-spin" /> : <SquareTopDownIcon />} {t('qrPoster.openTab')}
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t('qrPoster.printNote')}</p>
          </div>

          <div className="relative isolate flex min-h-0 items-start justify-center bg-muted/60 p-5 sm:p-8">
            {/* film grain behind the sheet: only the preview pane, never the PDF */}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-60 mix-blend-multiply dark:opacity-25 dark:mix-blend-screen" style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }} />
            <ScaledSheet>
              <div ref={sheet} style={{ width: `${SHEET.w}mm`, height: `${SHEET.h}mm` }} className="bg-white">
                {size === 'a5' ? <A5Poster {...poster} /> : <A6Tent {...poster} />}
              </div>
            </ScaledSheet>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Shows the real-size sheet scaled down to fit the preview pane. */
function ScaledSheet({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      const w = SHEET.w * MM;
      const h = SHEET.h * MM;
      const maxH = Math.max(320, window.innerHeight - 160);
      setScale(Math.min(1, el.clientWidth / w, maxH / h));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);
  return (
    <div ref={box} dir="ltr" className="w-full">
      <div
        className="mx-auto overflow-hidden rounded-sm shadow-lg ring-1 ring-black/5"
        style={{ width: SHEET.w * MM * scale, height: SHEET.h * MM * scale }}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
      </div>
    </div>
  );
}

function useBrand(vendor: Vendor) {
  const design = cardDesign(vendor.id, vendor.cardDesign);
  const bg = vendor.brandPrimary ?? design.colors[0];
  return { bg, ink: vendor.brandPrimary ? inkOn(vendor.brandPrimary) : design.ink };
}

function BrandBar({ vendor, branchName, height, logo }: { vendor: Vendor; branchName: string | null; height: number; logo: number }) {
  const { bg, ink } = useBrand(vendor);
  return (
    <div className="flex items-center" style={{ background: bg, color: ink, height: `${height}mm`, padding: '0 12mm', gap: '4mm' }}>
      {vendor.logoUrl ? (
        <img
          src={vendor.logoUrl}
          alt=""
          crossOrigin="anonymous"
          className="shrink-0 bg-white object-cover"
          style={{ width: `${logo}mm`, height: `${logo}mm`, borderRadius: `${logo * 0.22}mm` }}
        />
      ) : (
        <span
          className="flex shrink-0 items-center justify-center bg-white/20 font-semibold"
          style={{ width: `${logo}mm`, height: `${logo}mm`, borderRadius: `${logo * 0.22}mm`, fontSize: `${logo * 0.5}mm` }}
        >
          {initial(vendor.name)}
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate font-semibold" style={{ fontSize: `${logo * 0.38}mm`, lineHeight: 1.2 }}>
          {vendor.name}
        </div>
        {branchName ? (
          <div className="truncate opacity-80" style={{ fontSize: `${logo * 0.28}mm`, lineHeight: 1.3 }}>
            {branchName}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PoweredBy({ language, size }: { language: PosterLanguage; size: number }) {
  return (
    <div className="flex items-center justify-center text-neutral-500" style={{ gap: `${size * 0.35}mm`, fontSize: `${size * 0.8}mm` }}>
      {COPY[language].poweredBy}
      <DvoteLogo height={size * MM} color="#525252" />
    </div>
  );
}

const text = (mm: number, extra?: CSSProperties): CSSProperties => ({ fontSize: `${mm}mm`, ...extra });

function A5Poster({ vendor, language, headline, branchName, qrValue, shownUrl }: PosterProps) {
  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="flex h-full flex-col text-neutral-900">
      <BrandBar vendor={vendor} branchName={branchName} height={26} logo={13} />
      <div className="flex flex-1 flex-col items-center text-center" style={{ padding: '13mm 14mm 9mm' }}>
        <h1 className="font-semibold text-balance" style={text(8.6, { lineHeight: 1.2, maxWidth: '118mm' })}>
          {headline}
        </h1>
        <div style={{ marginTop: '11mm' }}>
          <QRCodeSVG value={qrValue} size={86 * MM} level="M" marginSize={0} />
        </div>
        <p className="text-neutral-600 text-balance" style={text(3.9, { marginTop: '11mm', lineHeight: 1.45, maxWidth: '104mm' })}>
          {COPY[language].body}
        </p>
        <div className="mt-auto grid justify-items-center" style={{ gap: '2.5mm' }}>
          <div dir="ltr" className="text-neutral-500" style={text(3)}>
            {shownUrl}
          </div>
          <PoweredBy language={language} size={3.4} />
        </div>
      </div>
    </div>
  );
}

function A6Tent(props: PosterProps) {
  return (
    <div className="relative flex h-full flex-col">
      <div className="h-1/2 rotate-180">
        <TentHalf {...props} />
      </div>
      <div className="h-1/2">
        <TentHalf {...props} />
      </div>
      <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/70" />
    </div>
  );
}

/** One face of the table tent (148 × 105 mm), brand bar along the fold. */
function TentHalf({ vendor, language, headline, branchName, qrValue, shownUrl }: PosterProps) {
  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="flex h-full flex-col text-neutral-900">
      <BrandBar vendor={vendor} branchName={branchName} height={15} logo={9} />
      <div className="flex flex-1 items-center" style={{ padding: '6mm 10mm', gap: '8mm' }}>
        <div className="grid shrink-0 justify-items-center" style={{ gap: '3mm' }}>
          <QRCodeSVG value={qrValue} size={56 * MM} level="M" marginSize={0} />
          <div dir="ltr" className="text-neutral-500" style={text(2.4)}>
            {shownUrl}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col self-stretch" style={{ paddingTop: '4mm' }}>
          <h1 className="font-semibold text-balance" style={text(6.4, { lineHeight: 1.2 })}>
            {headline}
          </h1>
          <p className="text-neutral-600" style={text(3.2, { marginTop: '4mm', lineHeight: 1.45 })}>
            {COPY[language].body}
          </p>
          <div className="mt-auto flex">
            <PoweredBy language={language} size={2.8} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The sheet as an A5 PDF: the poster drawn at 300 dpi (Arabic text keeps the browser's shaping). */
async function renderPdf(node: HTMLElement): Promise<Blob> {
  const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  await document.fonts.ready;
  const png = await toPng(node, { pixelRatio: 300 / 96, backgroundColor: '#ffffff', cacheBust: true });
  const pdf = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait', compress: true });
  pdf.addImage(png, 'PNG', 0, 0, SHEET.w, SHEET.h, undefined, 'FAST');
  return pdf.output('blob');
}
