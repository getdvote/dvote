import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '../../components/PageHeader';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Field } from '../../components/Field';
import { ConfirmAction } from '../../components/ConfirmAction';
import { t } from '../../i18n';
import { useMe } from '../../layouts/VendorLayout';
import { vendorApi, type CustomerSegment, type MerchantCustomerQuery } from '../../lib/api';

const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export function MyMessages() {
  const me = useMe();
  const allowed = me.role === 'vendor_admin';
  const [audience, setAudience] = useState('all');
  const [branchId, setBranchId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const key = useRef(crypto.randomUUID());
  const customers = useQuery({ queryKey: ['broadcast-segments', me.id], queryFn: () => vendorApi.customers({ pageSize: 1 }), enabled: allowed });
  const branches = useQuery({ queryKey: ['broadcast-branches', me.id], queryFn: vendorApi.branches, enabled: allowed });
  const history = useQuery({ queryKey: ['broadcasts', me.id], queryFn: vendorApi.broadcasts, enabled: allowed, refetchInterval: 5000 });
  const nearby = useQuery({ queryKey: ['broadcast-nearby', me.id], queryFn: vendorApi.nearbyNotifications, enabled: allowed });
  const filters: MerchantCustomerQuery = {
    ...(audience.startsWith('custom:') ? { customSegment: audience.slice(7) } : audience === 'all' ? {} : { segment: audience as CustomerSegment }),
    ...(branchId ? { branchId } : {}),
  };
  const audienceKey = JSON.stringify(filters);
  const preview = useMutation({ mutationFn: async () => ({ ...await vendorApi.broadcastPreview(filters), audienceKey }) });
  const currentPreview = preview.data?.audienceKey === audienceKey ? preview.data : undefined;
  const send = useMutation({ mutationFn: () => vendorApi.sendBroadcast({ ...filters, title: title.trim(), body: body.trim(), idempotencyKey: key.current }), onSuccess: () => {
    toast.success(t('messages.queued')); key.current = crypto.randomUUID(); setTitle(''); setBody(''); preview.reset(); void history.refetch();
  } });
  const settings = useMutation({ mutationFn: vendorApi.setNearbyNotifications, onSuccess: () => { void nearby.refetch(); toast.success(t('messages.saved')); } });
  useEffect(() => { preview.reset(); key.current = crypto.randomUUID(); }, [audience, branchId]);
  useEffect(() => { key.current = crypto.randomUUID(); }, [title, body]);
  if (!allowed) return <p>{t('messages.adminOnly')}</p>;
  return <>
    <PageHeader title={t('nav.messages')} subtitle={t('messages.subtitle')} />
    <ErrorAlert error={customers.error || branches.error || history.error || nearby.error} />
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>{t('messages.compose')}</CardTitle></CardHeader><CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">{t('messages.googleOnly')}</p>
        <Field htmlFor="broadcast-audience" label={t('messages.audience')}><select id="broadcast-audience" className={selectClass} value={audience} onChange={e => setAudience(e.target.value)} disabled={send.isPending}>
          <option value="all">{t('messages.all')}</option>
          {customers.data?.segments.map(s => <option key={s.key} value={s.key}>{t(`customers.segments.${s.key}.label`)} ({s.count})</option>)}
          {customers.data?.customSegments.map(s => <option key={s.id} value={`custom:${s.id}`}>{s.name} ({s.count})</option>)}
        </select></Field>
        <Field htmlFor="broadcast-branch" label={t('messages.branch')} hint={t('messages.branchHint')}><select id="broadcast-branch" className={selectClass} value={branchId} onChange={e => setBranchId(e.target.value)} disabled={send.isPending}>
          <option value="">{t('messages.allBranches')}</option>{branches.data?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select></Field>
        <Button variant="outline" disabled={preview.isPending || send.isPending || customers.isPending} onClick={() => preview.mutate()}>{t('messages.preview')}</Button>
        <ErrorAlert error={preview.error} />
        {currentPreview && <p className="rounded-lg bg-muted p-3 text-sm" aria-live="polite">{t('messages.audienceCount', { matched: currentPreview.matched, linked: currentPreview.linked, unavailable: currentPreview.unavailable })}</p>}
        {currentPreview && !currentPreview.configured && <p className="text-sm text-destructive">{t('messages.notConfigured')}</p>}
        <Field htmlFor="broadcast-title" label={t('messages.title')}><Input id="broadcast-title" value={title} maxLength={80} onChange={e => setTitle(e.target.value)} disabled={send.isPending} /></Field>
        <Field htmlFor="broadcast-body" label={t('messages.body')} hint={t('messages.limits')}><Textarea id="broadcast-body" rows={4} value={body} maxLength={500} onChange={e => setBody(e.target.value)} disabled={send.isPending} /></Field>
        <p className="text-xs text-muted-foreground">{t('messages.notice')}</p>
        <ConfirmAction title={t('messages.confirmTitle')} description={<><strong>{title}</strong><span className="block whitespace-pre-wrap">{body}</span><span className="mt-3 block">{t('messages.confirmCount', { count: currentPreview?.linked ?? 0 })}</span></>}
          actionLabel={t('messages.send')} trigger={<Button disabled={!currentPreview?.configured || !currentPreview.linked || !title.trim() || !body.trim() || send.isPending}>{t('messages.send')}</Button>}
          onConfirm={async () => { await send.mutateAsync(); }} />
        <ErrorAlert error={send.error} />
      </CardContent></Card>
      <div className="grid content-start gap-6">
        <Card><CardHeader><CardTitle>{t('messages.nearby')}</CardTitle></CardHeader><CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">{t('messages.nearbyHint')}</p>
          <p className="text-sm">{t('messages.locations', { count: nearby.data?.locations ?? 0 })}</p>
          <Button variant="outline" disabled={!nearby.data || settings.isPending || (!nearby.data.enabled && !nearby.data.locations)} onClick={() => settings.mutate(!nearby.data?.enabled)}>{nearby.data?.enabled ? t('messages.disableNearby') : t('messages.enableNearby')}</Button>
          <ErrorAlert error={settings.error} />
        </CardContent></Card>
        <Card><CardHeader><CardTitle>{t('messages.history')}</CardTitle></CardHeader><CardContent className="grid gap-4">
          <p className="text-xs text-muted-foreground">{t('messages.resultsHint')}</p>
          {!history.data?.length && <p className="text-sm text-muted-foreground">{t('messages.empty')}</p>}
          {history.data?.map(item => <div key={item.id} className="rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><strong>{item.title}</strong><time className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</time></div>
            <p className="my-2 whitespace-pre-wrap">{item.body}</p>
            <p>{t('messages.results', item)}</p>
          </div>)}
        </CardContent></Card>
      </div>
    </div>
  </>;
}
