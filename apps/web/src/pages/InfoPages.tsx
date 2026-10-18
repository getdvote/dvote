import { WalletCards } from 'lucide-react';
import { useEffect } from 'react';
import { Page } from '../components/ui';
import { t, useI18n } from '../i18n';
import { PRIVACY, TERMS, type LegalDoc } from '../legal/legal-text';

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

/** dvote.app/privacy ("How your data is used", linked from the join form) and dvote.app/terms. */
export function PrivacyPage() {
  return <LegalPage doc={PRIVACY} />;
}

export function TermsPage() {
  return <LegalPage doc={TERMS} />;
}

function LegalPage({ doc }: { doc: Record<'en' | 'ar', LegalDoc> }) {
  const { language } = useI18n();
  const d = doc[language === 'ar' ? 'ar' : 'en'];
  useEffect(() => {
    document.title = `${d.title} · dvote`;
  }, [d.title]);
  return (
    <Page wide>
      <h1 className="text-[26px] font-bold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-[14px] text-muted">{d.updated}</p>
      <p className="mt-5 text-[16px] leading-relaxed">{d.intro}</p>
      {d.sections.map((sec) => (
        <section key={sec.heading} className="mt-7">
          <h2 className="text-[18px] font-semibold">{sec.heading}</h2>
          {sec.bullets ? (
            <ul className="mt-2 grid list-disc gap-2 ps-5 text-[15px] leading-relaxed text-ink/85">
              {sec.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
          {sec.paragraphs?.map((p) => (
            <p key={p} className="mt-2 text-[15px] leading-relaxed text-ink/85">
              {p}
            </p>
          ))}
        </section>
      ))}
    </Page>
  );
}
