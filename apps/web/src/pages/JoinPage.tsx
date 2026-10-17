import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Button, ErrorNote, Field, Input, MerchantHeader, Page, Spinner } from '../components/ui';
import { t } from '../i18n';
import { api, errorMessage, type JoinSource } from '../lib/api';
import { cardDesign } from '../lib/cardDesigns';
import { useVendor } from './VenuePage';

/**
 * dvote.app/<slug>/join: name + Egyptian mobile (decided 2026-10-17). A known mobile gets
 * the same card back; a new one gets a new card. No sign-in, no email.
 */
export function JoinPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { vendor, error: vendorError } = useVendor(slug);
  const source: JoinSource = params.get('s') === 'nfc' ? 'nfc' : params.get('s') === 'qr' ? 'qr' : 'link';
  const branchId = params.get('b') ?? undefined;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (vendorError) {
    return (
      <Page>
        <ErrorNote>{vendorError}</ErrorNote>
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
  const keep = new URLSearchParams([...params].filter(([k]) => k === 'b' || k === 's'));

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.join(vendor.slug, { name: name.trim(), phone, source, branchId });
      navigate(`/c/${r.card.publicId}?${r.created ? 'new' : 'back'}=1`, { replace: true });
    } catch (e) {
      setBusy(false);
      setError(errorMessage(e));
    }
  };

  return (
    <Page>
      <Link to={`/${vendor.slug}${keep.toString() ? `?${keep}` : ''}`} className="-mt-2 mb-2 inline-flex max-w-full items-center gap-1 py-1 text-[15px] text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" /> {vendor.name}
      </Link>
      <MerchantHeader
        name={vendor.name}
        logoUrl={vendor.logoUrl}
        color={design.colors[0]}
        ink={design.ink}
        title={t('venue.loyalty')}
        subtitle={t('join.subtitle')}
      />

      <form className="mt-7 grid gap-5" onSubmit={(e) => void submit(e)}>
        <Field label={t('join.name')}>
          <Input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('join.namePlaceholder')} />
        </Field>
        <Field label={t('join.phone')} hint={t('join.phoneHint')}>
          <Input
            required
            dir="ltr"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('join.phonePlaceholder')}
            className="rtl:text-right"
          />
        </Field>
        <p className="text-center text-[14px] text-muted">
          {t('join.privacy', { shop: vendor.name })}{' '}
          <Link to="/privacy" className="underline underline-offset-4">
            {t('join.howData')}
          </Link>
        </p>
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" busy={busy}>
          {t('join.submit')}
        </Button>
      </form>
    </Page>
  );
}
