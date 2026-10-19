import { Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { LoyaltyCard } from '../components/LoyaltyCard';
import { ErrorNote, Page, Spinner } from '../components/ui';
import { t } from '../i18n';
import { api, errorMessage, type PublicCard } from '../lib/api';
import { platform } from '../lib/device';

/**
 * Card and both Wallet buttons, with the phone's preferred wallet first.
 * Only saved wallets are disabled. Apple currently explains its pending setup.
 */
export function CardPage() {
  const { publicId } = useParams();
  const [params] = useSearchParams();
  const [card, setCard] = useState<PublicCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [appleNotice, setAppleNotice] = useState(false);
  const [inWallet, setInWallet] = useState<{ google: boolean; apple: boolean } | null>(null);
  const device = platform();

  useEffect(() => {
    if (!publicId) return;
    api.card(publicId).then(setCard, (e) => setError(errorMessage(e)));
  }, [publicId]);

  // Disable only the saved wallet. Checked again when the customer comes back
  // from Google's save page (the tab becomes visible).
  useEffect(() => {
    if (!publicId) return;
    const check = () => api.walletStatus(publicId).then(setInWallet, () => undefined);
    void check();
    const onShow = () => document.visibilityState === 'visible' && void check();
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [publicId]);

  if (error) {
    return (
      <Page>
        <ErrorNote>{error}</ErrorNote>
      </Page>
    );
  }
  if (!card) {
    return (
      <Page>
        <Spinner />
      </Page>
    );
  }

  const addGoogle = async () => {
    setAdding(true);
    setWalletError(null);
    try {
      window.location.href = (await api.googleWallet(card.publicId)).saveUrl;
    } catch (e) {
      setWalletError(errorMessage(e));
    } finally {
      setAdding(false);
    }
  };
  const link = `${window.location.origin}/c/${card.publicId}`;
  const heading = params.get('new') ? t('card.enrolled') : params.get('back') ? t('card.welcomeBack') : t('card.yours');
  const apple = <WalletButton kind="apple" disabled={inWallet?.apple} onClick={() => setAppleNotice(true)} />;
  const google = <WalletButton kind="google" onClick={() => void addGoogle()} busy={adding} disabled={inWallet?.google} />;

  return (
    <Page>
      <h1 className="mb-5 text-center text-[24px] font-bold tracking-tight">{heading}</h1>
      <LoyaltyCard card={card} />

      {inWallet?.google || inWallet?.apple ? (
        <p className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-success/10 px-4 py-3 text-center text-[15px] font-medium text-success">
          <Check className="size-5 shrink-0" />
          {inWallet.google ? t('card.inGoogle') : t('card.inApple')}
        </p>
      ) : null}
      <div className="mt-6 grid justify-items-center gap-3">
        <p className="text-center text-[14px] text-muted">{t('card.addWithButtons')}</p>
        {device === 'ios' ? apple : google}
        {device === 'ios' ? google : apple}
        <ErrorNote>{walletError}</ErrorNote>
        {appleNotice && <p role="status" className="max-w-xs text-center text-[14px] leading-relaxed text-muted">{t('card.appleSoon')}</p>}
      </div>

      {device === 'other' && !inWallet?.google && !inWallet?.apple ? (
        <>
        <div className="mt-6 flex items-center gap-4 text-sm text-muted">
          <span className="h-px flex-1 bg-line" />
          <span>{t('card.or')}</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl bg-canvas p-5 text-center">
          <div className="rounded-2xl bg-white p-3">
            <QRCodeSVG value={`${link}/wallet`} size={140} />
          </div>
          <p className="text-[14px] text-muted">{t('card.openOnPhone')}</p>
        </div>
        </>
      ) : null}


      <div className="mt-5 text-center">
        <Link to={`/${card.vendor.slug}`} className="inline-block py-1 text-[15px] text-brand underline-offset-4 hover:underline">
          {t('card.visitShop', { shop: card.vendor.name })}
        </Link>
      </div>
    </Page>
  );
}

/** Official supplied badges; each wallet has its own saved status. */
function WalletButton({ kind, onClick, busy, disabled }: { kind: 'apple' | 'google'; onClick?: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={onClick}
      className="inline-flex h-16 w-56 max-w-full items-center justify-center rounded-lg outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <img
        src={`/wallet/add-to-${kind}-wallet.svg`}
        alt={kind === 'apple' ? t('card.addApple') : t('card.addGoogle')}
        className="h-full w-full object-contain"
      />
    </button>
  );
}
