import { DangerTriangleIcon, HomeIcon, MapPointSearchIcon, RestartIcon } from '@solar-icons/react/linear';
import type { ComponentType, ReactNode } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { DvoteLogo } from './DvoteLogo';
import { t } from '../i18n';

function ErrorState({ icon: Icon, code, title, text, children }: { icon: ComponentType; code?: string; title: string; text: string; children: ReactNode }) {
  return (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
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
    <ErrorState icon={MapPointSearchIcon} code={t('errorPage.notFoundCode')} title={t('errorPage.notFoundTitle')} text={t('errorPage.notFoundText')}>
      <Button asChild>
        <Link to={home}>
          <HomeIcon /> {t('errorPage.home')}
        </Link>
      </Button>
    </ErrorState>
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
    <div className="flex min-h-svh flex-col bg-background">
      <header className="p-6">
        <DvoteLogo />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-lg">
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
            <details className="rounded-lg border bg-muted/40 p-3 text-xs">
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
