import { useVendorApi, WorkspaceLink } from '../../lib/vendor-workspace';
import { useMe } from '../../layouts/VendorLayout';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorAlert } from '../../components/ErrorAlert';
import { PageHeader } from '../../components/PageHeader';

import { t } from '../../i18n';

export function MyFeedback() {
  const vendorApi = useVendorApi();
  const me = useMe();
  const [page, setPage] = useState(1);
  const { data, error, isPending } = useQuery({
    queryKey: ['customer-feedback', page],
    queryFn: () => vendorApi.customerFeedback(page),
  });
  return (
    <div>
      <PageHeader title={t('nav.feedback')} subtitle={t('feedback.subtitle')} />
      <ErrorAlert error={error} />
      {isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : data ? (
        <div className="grid gap-4">
          {!data.items.length ? (
            <Card className="items-center gap-1.5 px-6 py-12 text-center">
              <p className="font-medium">{t('emptyStates.feedbackTitle')}</p>
              <p className="max-w-md text-sm text-muted-foreground">{t('feedback.empty')}</p>
              {me.role === 'vendor_admin' ? (
                <Button variant="outline" size="sm" className="mt-2" asChild>
                  <WorkspaceLink to="/storefront">{t('emptyStates.openStorefront')}</WorkspaceLink>
                </Button>
              ) : null}
            </Card>
          ) : (
            data.items.map((f) => (
              <Card key={f.id} className="gap-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words font-semibold">{f.name}</h2>
                    {f.phone ? (
                      <a href={`tel:${f.phone}`} dir="ltr" className="block py-0.5 text-sm text-muted-foreground">
                        {f.phone}
                      </a>
                    ) : null}
                  </div>
                  <Badge variant={f.existingCustomer ? 'success' : 'outline'}>
                    {f.existingCustomer ? t('feedback.cardholder') : t('feedback.guest')}
                  </Badge>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{f.message}</p>
                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span>{f.branchName ?? t('feedback.allBranches')}</span>
                  <time dateTime={f.createdAt}>{new Date(f.createdAt).toLocaleString()}</time>
                </div>
              </Card>
            ))
          )}
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              {t('feedback.previous')}
            </Button>
            <span className="text-sm text-muted-foreground">{page}</span>
            <Button variant="outline" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)}>
              {t('feedback.next')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
