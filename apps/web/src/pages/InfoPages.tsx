import { WalletCards } from 'lucide-react';
import { Page } from '../components/ui';
import { t } from '../i18n';

/** dvote.app: there is no shop list; customers arrive from a shop's tag or QR. */
export function HomePage() {
  return (
    <Page>
      <div className="flex flex-col items-center py-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-[20px] bg-brand-soft text-brand">
          <WalletCards className="size-8" />
        </span>
        <h1 className="mt-5 text-[26px] font-bold tracking-tight">{t('home.title')}</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-muted">{t('home.text')}</p>
      </div>
    </Page>
  );
}

/** "How your data is used" (linked from the join form). Draft wording; legal text to follow. */
export function PrivacyPage() {
  return (
    <Page>
      <h1 className="text-[24px] font-bold tracking-tight">{t('privacy.title')}</h1>
      <div className="mt-4 grid gap-3 text-[16px] leading-relaxed text-muted">
        <p>{t('privacy.body1')}</p>
        <p>{t('privacy.body2')}</p>
        <p>{t('privacy.body3')}</p>
      </div>
    </Page>
  );
}
