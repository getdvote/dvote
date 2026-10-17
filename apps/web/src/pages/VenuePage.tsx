import { ChevronRight, Gift, WalletCards } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ErrorNote, MerchantHeader, Page, Spinner } from '../components/ui';
import { localized, t } from '../i18n';
import { api, errorMessage, type PublicVendor } from '../lib/api';
import { cardDesign } from '../lib/cardDesigns';

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

export function useVendor(slug: string | undefined) {
  const [vendor, setVendor] = useState<PublicVendor | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    api.vendor(slug).then(
      (v) => alive && setVendor(v),
      (e) => alive && setError(errorMessage(e)),
    );
    return () => {
      alive = false;
    };
  }, [slug]);
  return { vendor, error };
}

/** dvote.app/<slug>: what the NFC tag / QR at the till opens. */
export function VenuePage() {
  const { slug } = useParams();
  const tag = useTagParams();
  const { vendor, error } = useVendor(slug);

  useEffect(() => {
    if (vendor) document.title = `${vendor.name} · dvote`;
  }, [vendor]);

  if (error) {
    return (
      <Page>
        <ErrorNote>{error}</ErrorNote>
      </Page>
    );
  }
  if (!vendor) {
    return (
      <Page>
        <Spinner />
      </Page>
    );
  }

  const design = cardDesign(vendor.id, vendor.cardDesign);
  const q = tag.toString() ? `?${tag}` : '';

  return (
    <Page>
      <MerchantHeader name={vendor.name} logoUrl={vendor.logoUrl} color={design.colors[0]} ink={design.ink} />

      <Link
        to={`/${vendor.slug}/join${q}`}
        className="mt-7 flex items-center gap-4 rounded-3xl border border-line p-4 transition-colors hover:bg-canvas"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: design.colors[0], color: design.ink }}>
          <WalletCards className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[18px] font-semibold">{t('venue.loyalty')}</span>
          <span className="block text-[15px] text-muted">{t('venue.loyaltyText')}</span>
        </span>
        <ChevronRight className="size-5 text-muted rtl:rotate-180" />
      </Link>

      <p className="mt-4 text-center text-[15px] text-muted">
        {vendor.rule
          ? t('venue.earn', {
              count: vendor.rule.pointsPerSpend,
              // "10 EGP" kept together, left-to-right, inside Arabic text
              price: `${LRI}${vendor.rule.spendAmount.replace(/\.00$/, '')} ${vendor.currency}${PDI}`,
            })
          : t('venue.noRule')}
      </p>

      {vendor.rewards.length ? (
        <section className="mt-7">
          <h2 className="mb-3 text-[13px] font-semibold tracking-[0.15em] text-muted uppercase">{t('venue.rewards')}</h2>
          <ul className="divide-y divide-line rounded-3xl border border-line">
            {vendor.rewards.map((r) => (
              <li key={r.name} className="flex items-center gap-3 px-4 py-3">
                {r.imageUrl ? (
                  <img src={r.imageUrl} alt="" className="size-11 rounded-xl object-cover" />
                ) : (
                  <span className="flex size-11 items-center justify-center rounded-xl bg-canvas text-muted">
                    <Gift className="size-5" />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[16px] font-medium">{localized(r.name, r.nameAr)}</span>
                <span className="text-[15px] font-semibold tabular-nums">{t('venue.pts', { n: r.pointsCost })}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Page>
  );
}
