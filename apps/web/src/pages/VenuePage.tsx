import { Check, ChevronLeft, ChevronRight, Copy, Gift, MessageSquare, MapPin, Navigation, UtensilsCrossed, WalletCards, Wifi, ZoomIn } from 'lucide-react';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ImageViewer } from '../components/image-viewer';
import { ErrorNote, Page, Spinner, cx } from '../components/ui';
import { localized, t } from '../i18n';
import { api, errorMessage, type PublicVendor, type Section } from '../lib/api';
import { brandColors, displayFont, useBrandFont } from '../lib/brand';

const LRI = String.fromCharCode(0x2066);
const PDI = String.fromCharCode(0x2069);

/** Keeps ?b= (branch) and ?s= (nfc / qr) from the tag or poster on every link of the flow. */
export function useTagParams() {
  const [params] = useSearchParams();
  const keep = new URLSearchParams();
  for (const k of ['b', 's']) {
    const v = params.get(k);
    if (v) keep.set(k, v);
  }
  return keep;
}

/** The merchant's public data; with a branch (?b=) the page uses that branch's storefront if it has one. */
export function useVendor(slug: string | undefined, branch?: string | null) {
  const [vendor, setVendor] = useState<PublicVendor | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    api.vendor(slug, branch).then(
      (v) => alive && setVendor(v),
      (e) => alive && setError(errorMessage(e)),
    );
    return () => {
      alive = false;
    };
  }, [slug, branch]);
  return { vendor, error };
}

type Colors = ReturnType<typeof brandColors>;
type Brand = { vendor: PublicVendor; colors: Colors; font?: string; q: string };

/** Loads the merchant (with its font and colours) and shows loading / error states. */
function useBrandedVendor(): { brand: Brand | null; fallback: ReactNode } {
  const { slug } = useParams();
  const tag = useTagParams();
  const { vendor, error } = useVendor(slug, tag.get('b'));
  useBrandFont(vendor?.style.font ?? null);
  useEffect(() => {
    if (vendor) document.title = `${vendor.name} · dvote`;
  }, [vendor]);
  if (error)
    return {
      brand: null,
      fallback: (
        <Page>
          <ErrorNote>{error}</ErrorNote>
        </Page>
      ),
    };
  if (!vendor)
    return {
      brand: null,
      fallback: (
        <Page>
          <Spinner />
        </Page>
      ),
    };
  return {
    brand: { vendor, colors: brandColors(vendor), font: displayFont(vendor.style.font), q: tag.toString() ? `?${tag}` : '' },
    fallback: null,
  };
}

/**
 * m.dvote.co/<slug>: what the NFC tag / QR at the till opens. A short hub: one row per section the
 * merchant chose (dashboard → Storefront), in their order; each row opens its own page (the
 * loyalty card opens joining), WiFi shows its password right here. The look (page style,
 * colours, font) comes from Settings → Branding.
 */
export function VenuePage() {
  const { brand, fallback } = useBrandedVendor();
  if (!brand) return fallback;
  const { vendor, colors, font } = brand;

  const rows = (
    <div className={cx('grid grid-cols-1 gap-3', vendor.style.pageStyle === 'playful' && 'px-1 [&>*:nth-child(odd)]:rotate-1 [&>*:nth-child(even)]:-rotate-1 [&>*]:shadow-sm')}>
      {vendor.sections.map((s) => (
        <SectionRow key={s.type} section={s} brand={brand} />
      ))}
    </div>
  );

  return (
    <Page>
      {vendor.style.pageStyle === 'playful' ? (
        <div className="rounded-3xl p-4" style={{ background: `color-mix(in srgb, ${colors.primary} 10%, white)` }}>
          <header className="mb-7 flex flex-col items-center gap-4 text-center">
            <Logo vendor={vendor} colors={colors} className="-rotate-6 ring-4 ring-white" />
            <h1 className="text-2xl font-bold" style={{ fontFamily: font, color: colors.accent }}>{vendor.name}</h1>
          </header>
          {rows}
        </div>
      ) : vendor.style.pageStyle === 'split' ? (
        <div className="border-s-8 ps-4" style={{ borderColor: colors.primary }}>
          <header className="mb-6 flex flex-col items-start gap-4 border-b border-line pb-5">
            <Logo vendor={vendor} colors={colors} size="size-16 rounded-2xl text-2xl" />
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: font }}>{vendor.name}</h1>
            <span className="h-1 w-12 rounded-full" style={{ background: colors.secondary }} />
          </header>
          {rows}
        </div>
      ) : vendor.style.pageStyle === 'branded' ? (
        <>
          <header
            className="-mx-5 -mt-7 flex flex-col items-center rounded-t-[28px] px-5 pt-8 pb-14 text-center sm:-mx-8 sm:px-8"
            style={{ background: `linear-gradient(160deg, ${colors.primary}, ${colors.secondary})`, color: colors.ink }}
          >
            <Logo vendor={vendor} colors={colors} className="ring-4 ring-white/25" />
            <p className="mt-4 text-[13px] font-semibold tracking-[0.18em] uppercase opacity-80" style={{ fontFamily: font }}>
              {vendor.name}
            </p>
          </header>
          <div className="relative -mx-2 -mt-8 rounded-3xl bg-white px-2 pt-6 sm:-mx-3 sm:px-3">{rows}</div>
        </>
      ) : vendor.style.pageStyle === 'compact' ? (
        <>
          <header className="-mt-2 mb-6 flex items-center gap-3 border-b border-line pb-4">
            <Logo vendor={vendor} colors={colors} size="size-11 rounded-xl text-lg" />
            <p className="min-w-0 truncate text-[18px] font-semibold" style={{ fontFamily: font }}>
              {vendor.name}
            </p>
          </header>
          {rows}
        </>
      ) : (
        <>
          <header className="mb-7 flex flex-col items-center text-center">
            <Logo vendor={vendor} colors={colors} />
            <p className="mt-4 text-[13px] font-semibold tracking-[0.18em] text-muted uppercase" style={{ fontFamily: font }}>
              {vendor.name}
            </p>
          </header>
          {rows}
        </>
      )}
    </Page>
  );
}

/** The logo (or the first letter in the brand colour). `size` replaces the default 80px rounded square. */
function Logo({ vendor, colors, size = 'size-20 rounded-[22px] text-3xl', className }: { vendor: PublicVendor; colors: Colors; size?: string; className?: string }) {
  return vendor.logoUrl ? (
    <img src={vendor.logoUrl} alt="" className={cx(size, 'object-cover shadow-sm', className)} />
  ) : (
    <span className={cx(size, 'flex items-center justify-center font-bold', className)} style={{ background: colors.primary, color: colors.ink }}>
      {vendor.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** The icon square: the brand colour, softly tinted. */
function Mark({ icon: Icon, colors }: { icon: ComponentType<{ className?: string }>; colors: Colors }) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `${colors.primary}2e`, color: colors.accent }}>
      <Icon className="size-[22px]" />
    </span>
  );
}

const ROW = 'flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5 transition-colors hover:bg-canvas';

function Row({ to, icon, title, text, brand }: { to: string; icon: ComponentType<{ className?: string }>; title: string; text?: string; brand: Brand }) {
  return (
    <Link to={to} className={ROW}>
      <Mark icon={icon} colors={brand.colors} />
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold" style={{ fontFamily: brand.font }}>
          {title}
        </span>
        {text ? <span className="block truncate text-[14px] text-muted">{text}</span> : null}
      </span>
      <ChevronRight className="size-5 text-muted rtl:rotate-180" />
    </Link>
  );
}

function earnText(vendor: PublicVendor) {
  return vendor.rule
    ? t('venue.earn', {
        count: vendor.rule.pointsPerSpend,
        // "10 EGP" kept together, left-to-right, inside Arabic text
        price: `${LRI}${vendor.rule.spendAmount.replace(/\.00$/, '')} ${vendor.currency}${PDI}`,
      })
    : t('venue.noRule');
}

/** One row of the hub. Sections with nothing to show (no rewards, no menu…) are left out. */
function SectionRow({ section: s, brand }: { section: Section; brand: Brand }) {
  const { vendor, q } = brand;
  const base = `/${vendor.slug}`;
  switch (s.type) {
    case 'feedback':
      return <Row to={`${base}/feedback${q}`} icon={MessageSquare} title={t('feedback.title')} text={t('feedback.rowHint')} brand={brand} />;
    case 'loyalty':
      return <Row to={`${base}/join${q}`} icon={WalletCards} title={t(`venue.labels.${s.label}`)} text={earnText(vendor)} brand={brand} />;
    case 'rewards':
      return vendor.rewards.length ? (
        <Row to={`${base}/rewards${q}`} icon={Gift} title={t('venue.rewards')} text={t('venue.rewardsCount', { count: vendor.rewards.length })} brand={brand} />
      ) : null;
    case 'menu':
      return vendor.menu.length ? <Row to={`${base}/menu${q}`} icon={UtensilsCrossed} title={t('venue.menu')} text={t('venue.menuText')} brand={brand} /> : null;
    case 'branches':
      return vendor.branches.length ? (
        <Row
          to={`${base}/branches${q}`}
          icon={MapPin}
          title={t('venue.branches')}
          text={vendor.branches.length === 1 ? (vendor.branches[0].address ?? vendor.branches[0].name) : t('venue.branchesCount', { count: vendor.branches.length })}
          brand={brand}
        />
      ) : null;
    case 'wifi':
      return s.ssid ? <WifiCard ssid={s.ssid} password={s.security === 'none' ? '' : s.password} brand={brand} /> : null;
  }
}

/** WiFi stays on the hub: the network, the password and one tap to copy it. */
function WifiCard({ ssid, password, brand }: { ssid: string; password: string; brand: Brand }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    void navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  return (
    <div className="grid grid-cols-1 gap-3 rounded-2xl border border-line bg-white p-3.5">
      <div className="flex items-center gap-3">
        <Mark icon={Wifi} colors={brand.colors} />
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold" style={{ fontFamily: brand.font }}>
            {t('venue.wifi')}
          </span>
          <span className="block truncate text-[14px] text-muted" dir="auto">
            {t('venue.networkName', { ssid })}
          </span>
        </span>
      </div>
      {password ? (
        <>
          <p className="rounded-xl border border-line px-4 py-3 text-center font-mono text-[16px] break-all" dir="ltr">
            {password}
          </p>
          <button
            type="button"
            onClick={copy}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line text-[15px] font-semibold transition-colors hover:bg-canvas"
            style={{ color: brand.colors.accent }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? t('venue.copied') : t('venue.copyPassword')}
          </button>
        </>
      ) : (
        <p className="text-[14px] text-muted">{t('venue.noPassword')}</p>
      )}
    </div>
  );
}

/**
 * m.dvote.co/<slug>/rewards | /menu | /branches: one section on its own page, with the way back
 * to the merchant's hub.
 */
export function VenueSectionPage({ kind }: { kind: 'rewards' | 'menu' | 'branches' }) {
  const { brand, fallback } = useBrandedVendor();
  if (!brand) return fallback;
  const { vendor, colors, font, q } = brand;
  const title = kind === 'rewards' ? t('venue.rewards') : kind === 'menu' ? t('venue.menu') : t('venue.branches');

  return (
    <Page>
      <header className="-mt-2 mb-6">
        <Link to={`/${vendor.slug}${q}`} className="-ms-1 inline-flex max-w-full items-center gap-1 rounded-lg px-1 py-1 text-[15px] font-medium text-muted hover:text-ink">
          <ChevronLeft className="size-5 rtl:rotate-180" />
          <Logo vendor={vendor} colors={colors} size="size-6 rounded-md text-xs" />
          <span className="truncate">{vendor.name}</span>
        </Link>
        <h1 className="mt-3 text-[28px] leading-tight font-bold tracking-tight" style={{ fontFamily: font }}>
          {title}
        </h1>
        {kind === 'rewards' ? <p className="mt-1 text-[15px] text-muted">{earnText(vendor)}</p> : null}
      </header>

      {kind === 'rewards' ? (
        <ul className="divide-y divide-line rounded-3xl border border-line">
          {vendor.rewards.map((r) => (
            <li key={r.name} className="flex items-center gap-3 px-4 py-3">
              {r.imageUrl ? (
                <img src={r.imageUrl} alt="" className="size-12 rounded-xl object-cover" />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-xl bg-canvas text-muted">
                  <Gift className="size-5" />
                </span>
              )}
              <span className="min-w-0 flex-1 text-[16px] font-medium">{localized(r.name, r.nameAr)}</span>
              <span className="text-[15px] font-semibold tabular-nums" style={{ color: colors.accent }}>
                {t('venue.pts', { n: r.pointsCost })}
              </span>
            </li>
          ))}
        </ul>
      ) : kind === 'menu' ? (
        <MenuPages images={vendor.menu} />
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {vendor.branches.map((b) => (
            // on narrow phones Directions wraps under the address instead of squeezing it
            <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3.5">
              <Mark icon={MapPin} colors={colors} />
              <span className="min-w-40 flex-1">
                <span className="block text-[16px] font-semibold">{b.name}</span>
                {b.address ? <span className="block text-[14px] text-muted">{b.address}</span> : null}
              </span>
              {b.mapsUrl ? (
                <a
                  href={b.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ms-auto flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[14px] font-semibold"
                  style={{ background: `${colors.primary}2e`, color: colors.accent }}
                >
                  <Navigation className="size-4" /> {t('venue.directions')}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

/** The menu pages; tapping one opens it full screen to zoom in. */
function MenuPages({ images }: { images: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const alt = (i: number) => t('venue.menuPage', { n: i + 1 });
  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        {images.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpen(i)}
            className="relative block cursor-zoom-in overflow-hidden rounded-2xl border border-line"
            aria-label={`${alt(i)} · ${t('venue.tapToZoom')}`}
          >
            <img src={url} alt={alt(i)} className="w-full" />
            <span className="absolute end-3 bottom-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[13px] font-medium text-white backdrop-blur">
              <ZoomIn className="size-4" /> {t('venue.tapToZoom')}
            </span>
          </button>
        ))}
      </div>
      {open !== null ? <ImageViewer images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} alt={alt} /> : null}
    </>
  );
}
