import { DangerTriangleIcon, HomeIcon, MapPointSearchIcon, RestartIcon } from '@solar-icons/react/linear';
import type { ComponentType, ReactNode } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { BrandIllustration, BrandPattern, type IllustrationName } from './BrandArt';
import { DvoteLogo } from './DvoteLogo';
import { t } from '../i18n';
import { useAuth } from '../lib/auth';
import { config } from '../lib/config';
import dayjs from 'dayjs';

function ErrorState({ icon: Icon, illustration, code, title, text, children }: { icon: ComponentType; illustration?: IllustrationName; code?: string; title: string; text: string; children: ReactNode }) {
  return (
    <Empty className="py-16">
      <EmptyHeader>
        {illustration ? (
          <EmptyMedia>
            <BrandIllustration name={illustration} />
          </EmptyMedia>
        ) : (
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
        )}
        {code ? <p className="text-sm font-semibold tabular-nums text-muted-foreground">{code}</p> : null}
        <EmptyTitle className="text-xl">{title}</EmptyTitle>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap justify-center gap-2">{children}</div>
      </EmptyContent>
    </Empty>
  );
}

/** An address that matches no page, shown inside the dashboard layout so the menu stays. */
export function NotFoundPage({ home = '/' }: { home?: string }) {
  return (
    <ErrorState icon={MapPointSearchIcon} illustration="nearby" code={t('errorPage.notFoundCode')} title={t('errorPage.notFoundTitle')} text={t('errorPage.notFoundText')}>
      <Button asChild>
        <Link to={home}>
          <HomeIcon /> {t('errorPage.home')}
        </Link>
      </Button>
    </ErrorState>
  );
}

/** Full-screen brand frame (as the crash page): paper with a quiet dot grid, logo, one card. */
function NoticeFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-hidden bg-background">
      <BrandPattern name="paper-grid" className="-z-10 [mask-image:radial-gradient(ellipse_at_center,transparent_35%,black_75%)]" />
      <header className="p-6">
        <DvoteLogo markColor="var(--brand)" />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-lg rounded-2xl bg-card px-2 shadow-sm ring-1 ring-border">{children}</div>
      </main>
    </div>
  );
}

/**
 * Signed in on the other dashboard's address: admin.dvote.co lets in only platform admins and
 * merchant.dvote.co only merchant accounts (config.site). Offers the right address and sign-out.
 */
export function WrongSitePage({ belongsTo, href }: { belongsTo: 'admin' | 'merchant'; href: string }) {
  const { signOut } = useAuth();
  return (
    <NoticeFrame>
      <ErrorState
        icon={DangerTriangleIcon}
        illustration="nearby"
        title={t(belongsTo === 'admin' ? 'site.adminTitle' : 'site.merchantTitle')}
        text={t(belongsTo === 'admin' ? 'site.adminText' : 'site.merchantText')}
      >
        {href ? (
          <Button asChild variant="brand">
            <a href={href}>{t(belongsTo === 'admin' ? 'site.goAdmin' : 'site.goMerchant')}</a>
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => void signOut()}>
          {t('site.signOut')}
        </Button>
      </ErrorState>
    </NoticeFrame>
  );
}

/**
 * A self sign-up shop whose 14-day free trial is over (API trial_ended): nothing else is
 * reachable. Points to the plans on dvote.co/pricing and says when the shop will be deleted.
 */
export function TrialEndedPage() {
  const { trial, signOut } = useAuth();
  const deleteAt = trial?.deleteAt ? dayjs(trial.deleteAt).format('D MMMM YYYY') : null;
  return (
    <NoticeFrame>
      <ErrorState
        icon={DangerTriangleIcon}
        illustration="reward-unlocked"
        title={t('trial.endedTitle')}
        text={deleteAt ? t('trial.endedTextDate', { date: deleteAt }) : t('trial.endedText')}
      >
        <Button asChild variant="brand">
          <a href={`${config.landingUrl}/pricing`}>{t('trial.seePlans')}</a>
        </Button>
        <Button asChild variant="outline">
          <a href="https://wa.me/201207118966" target="_blank" rel="noreferrer">
            {t('trial.contact')}
          </a>
        </Button>
        <Button variant="ghost" onClick={() => void signOut()}>
          {t('site.signOut')}
        </Button>
      </ErrorState>
    </NoticeFrame>
  );
}

/**
 * The router's errorElement: a page crashed while rendering. Full screen (the layout may be what
 * broke), with a reload and a way home; the technical message only in development.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? (error.stack ?? error.message) : String(error);
  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-hidden bg-background">
      {/* quiet dot grid at the edges only; the message sits on a plain card */}
      <BrandPattern name="paper-grid" className="-z-10 [mask-image:radial-gradient(ellipse_at_center,transparent_35%,black_75%)]" />
      <header className="p-6">
        <DvoteLogo markColor="var(--brand)" />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-lg rounded-2xl bg-card px-2 shadow-sm ring-1 ring-border">
          {missing ? (
            <NotFoundPage />
          ) : (
            <ErrorState icon={DangerTriangleIcon} title={t('errorPage.crashTitle')} text={t('errorPage.crashText')}>
              <Button onClick={() => window.location.reload()}>
                <RestartIcon /> {t('errorPage.reload')}
              </Button>
              <Button variant="outline" asChild>
                {/* a full load, so a broken in-memory state is not carried over */}
                <a href="/">
                  <HomeIcon /> {t('errorPage.home')}
                </a>
              </Button>
              <Button variant="ghost" asChild>
                <a href="mailto:getdvote@gmail.com">{t('errorPage.contact')}</a>
              </Button>
            </ErrorState>
          )}
          {!missing && import.meta.env.DEV ? (
            <details className="mx-2 mb-4 rounded-lg border bg-muted/40 p-3 text-xs">
              <summary className="cursor-pointer font-medium">{t('errorPage.details')}</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-muted-foreground" dir="ltr">
                {detail}
              </pre>
            </details>
          ) : null}
        </div>
      </main>
    </div>
  );
}
