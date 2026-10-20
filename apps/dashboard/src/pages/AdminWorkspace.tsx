import { AdminTeam } from './AdminTeam';
import { MyHome } from './my/MyHome';
import { WORKSPACE_PAGES } from '../lib/workspace-pages';
import { useMemo, useState, type ComponentType } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { api, createVendorApi } from '../lib/api';
import { VendorWorkspaceProvider } from '../lib/vendor-workspace';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useStackedRows } from '@/components/ui/table';
import { ErrorAlert } from '../components/ErrorAlert';
import { MyProfile } from './my/MyProfile';
import { MyActivity } from './my/MyActivity';
import { MyInsights } from './my/MyInsights';
import { CardsArea } from './my/cards/cards-area';
import { MyBranches, MyRewards } from './my/MySections';
import { MyCustomers } from './my/my-customers';
import { MyMessages } from './my/MyMessages';
import { MyFeedback } from './my/MyFeedback';
import { MyTill } from './my/MyTill';
import { MySettings } from './my/MySettings';
import { MyStoreIds } from './my/MyStoreIds';
import { MyRedemptions } from './my/MyRedemptions';

const COMPONENTS: {
  section: string;
  label: string;
  component?: ComponentType;
}[] = [
  { section: 'merchant-home', label: 'Merchant overview', component: MyHome },
  { section: 'storefront', label: 'Storefronts', component: MyProfile },
  { section: 'branches', label: 'Branches', component: MyBranches },
  { section: 'card', label: 'Loyalty cards & points', component: CardsArea },
  { section: 'rewards', label: 'Rewards', component: MyRewards },
  { section: 'members', label: 'Customer segments', component: MyCustomers },
  { section: 'broadcast', label: 'Broadcast', component: MyMessages },
  { section: 'activity', label: 'Activity', component: MyActivity },
  { section: 'redemptions', label: 'Redemptions', component: MyRedemptions },
  { section: 'insights', label: 'Insights', component: MyInsights },
  {
    section: 'customer-feedback',
    label: 'Customer feedback',
    component: MyFeedback,
  },
  { section: 'team', label: 'Merchant teams', component: AdminTeam },
  { section: 'scan', label: 'Till', component: MyTill },
  { section: 'settings', label: 'Merchant settings', component: MySettings },
  { section: 'kit', label: 'Store kits', component: MyStoreIds },
  { section: 'audit', label: 'Admin action log' },
];

/** A separate query cache per merchant prevents data leaking between selected workspaces. */
function MerchantWorkspace({ vendorId, section }: { vendorId: string; section: string }) {
  const client = useMemo(() => createVendorApi(`/api/admin/vendors/${vendorId}/workspace`), [vendorId]);
  const [cache] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const me = useQuery({
    queryKey: ['admin-workspace-me', vendorId],
    queryFn: client.me,
  });
  const Component = COMPONENTS.find((p) => p.section === section)?.component;
  if (me.error) return <ErrorAlert error={me.error} />;
  if (!me.data) return <p role="status">Loading merchant workspace…</p>;
  if (!Component) return null;
  return (
    <QueryClientProvider client={cache}>
      <VendorWorkspaceProvider client={client} me={me.data}>
        <Component />
      </VendorWorkspaceProvider>
    </QueryClientProvider>
  );
}

export function AdminWorkspace({ section }: { section: string }) {
  const [params, setParams] = useSearchParams();
  const vendorId = params.get('vendor') ?? '';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const vendors = useQuery({
    queryKey: ['admin-workspace-vendors'],
    queryFn: () => api.vendors(),
  });
  const tableRef = useStackedRows();
  const rows = useQuery({
    queryKey: ['admin-workspace', section, search, page, vendorId],
    queryFn: () => api.workspace(section, { search, page, vendorId: vendorId || undefined }),
    enabled: !vendorId || section === 'audit',
  });
  const choose = (id: string) => {
    setPage(1);
    const next = new URLSearchParams(params);
    if (id) next.set('vendor', id);
    else next.delete('vendor');
    setParams(next);
  };
  const label = WORKSPACE_PAGES.find((p) => p.section === section)?.label ?? section;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform administration · {vendorId ? (vendors.data?.find((v) => v.id === vendorId)?.name ?? 'Selected merchant') : 'All merchants'}
          </p>
        </div>
        <label className="grid w-full gap-1 text-sm sm:w-auto">
          Merchant
          <select
            aria-label="Merchant"
            className="h-10 w-full max-w-full rounded-md border bg-background px-3 sm:w-64"
            value={vendorId}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">All merchants</option>
            {vendors.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.status === 'suspended' ? ' (suspended)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      {vendors.error && <ErrorAlert error={vendors.error} />}
      {vendorId && section !== 'audit' ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
            <span>Managing this merchant as a dvote platform admin. Changes are recorded in the admin action log.</span>
            <Button variant="outline" asChild>
              <Link to={`/merchants/${vendorId}`}>Merchant overview</Link>
            </Button>
          </div>
          <MerchantWorkspace key={vendorId} vendorId={vendorId} section={section} />
        </>
      ) : (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm text-muted-foreground">
              {section === 'audit'
                ? 'Platform-admin actions across merchant workspaces.'
                : 'View all merchants below. Select a merchant to open its management tools.'}
            </p>
            <Input
              aria-label="Search all merchants"
              placeholder="Search names, merchants or details…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {rows.error && <ErrorAlert error={rows.error} />}
            {rows.isPending ? (
              <p role="status">Loading…</p>
            ) : (
              <>
                <div data-slot="table-container" className="overflow-x-auto">
                  <table ref={tableRef} data-slot="table" className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-3">Merchant</th>
                        <th className="p-3">Name / type</th>
                        <th className="p-3">Details</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">{section === 'insights' ? 'Cards' : section === 'broadcast' ? 'Accepted' : 'Points'}</th>
                        <th className="p-3">{section === 'insights' ? 'Spend (30 days)' : 'Amount'}</th>
                        {section !== 'audit' && <th className="p-3">Manage</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.data?.items.map((row) => (
                        <tr className="border-b last:border-0" key={row.id}>
                          <td className="p-3 font-medium">{row.vendorName}</td>
                          <td className="p-3">{row.name}</td>
                          <td className="max-w-96 break-words p-3 text-muted-foreground">{row.detail}</td>
                          <td className="p-3">{row.status}</td>
                          <td className="p-3 tabular-nums">{row.points ?? '—'}</td>
                          <td className="p-3 tabular-nums">{row.amount ? `${row.amount} ${row.currency}` : '—'}</td>
                          {section !== 'audit' && (
                            <td className="p-3">
                              <Button variant="outline" size="sm" onClick={() => choose(row.vendorId)}>
                                Open
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!rows.data?.items.length && <p className="py-8 text-center text-muted-foreground">No records found.</p>}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {rows.data?.total ?? 0} records · Page {page}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                      Previous
                    </Button>
                    <Button variant="outline" disabled={page * 25 >= (rows.data?.total ?? 0)} onClick={() => setPage((p) => p + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
