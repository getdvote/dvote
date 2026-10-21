import type { ComponentType } from 'react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { BrandIllustration, type IllustrationName } from './BrandArt';
import { PageHeader } from './PageHeader';
import { t } from '../i18n';

/** A page that exists in the nav but has nothing yet: its title and an empty box (a brand scene, or the page icon). */
export function PlaceholderPage({ title, subtitle, icon: Icon, illustration = 'welcome' }: { title: string; subtitle: string; icon: ComponentType; illustration?: IllustrationName | null }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Empty className="rounded-xl border border-dashed py-16">
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
          <EmptyTitle>{t('placeholder.empty')}</EmptyTitle>
          <EmptyDescription>{t('placeholder.emptyHint')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </>
  );
}
