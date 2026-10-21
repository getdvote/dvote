import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ErrorNote, Page, Spinner } from '../components/ui';
import { t } from '../i18n';
import { api, errorMessage } from '../lib/api';
import { platform } from '../lib/device';
import { CardPage } from './CardPage';

/** Permanent QR destination. Apple pass issuance can be added here without replacing QR codes. */
export function WalletPage() {
  const { publicId } = useParams();
  const device = platform();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicId || device !== 'android') return;
    let active = true;
    api.googleWallet(publicId).then(
      ({ saveUrl }) => { if (active) window.location.replace(saveUrl); },
      (e) => { if (active) setError(errorMessage(e)); },
    );
    return () => { active = false; };
  }, [publicId, device]);

  // iPhone shows the card and current Apple availability until Apple passes are enabled.
  if (device !== 'android') return <CardPage />;
  return (
    <Page>
      {error ? (
        <div className="grid gap-4 text-center">
          <ErrorNote>{error}</ErrorNote>
          <Link to={`/c/${encodeURIComponent(publicId ?? '')}`} className="text-brand underline">
            {t('card.yours')}
          </Link>
        </div>
      ) : <Spinner />}
    </Page>
  );
}
