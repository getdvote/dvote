import { useVendorApi, useWorkspace } from '../../lib/vendor-workspace';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AddCircleIcon as Plus,
  ArrowDownIcon as ArrowDown,
  ArrowUpIcon as ArrowUp,
  ChefHatIcon,
  CopyIcon,
  QrCodeIcon,
  CheckCircleIcon as CheckCircle,
  GiftIcon,
  ChatRoundDotsIcon,
  LoaderIcon as Loader2,
  MapPointIcon,
  RefreshIcon as Refresh,
  TrashBinTrashIcon as Trash2,
  WalletIcon,
  WiFiRouterIcon,
} from '@solar-icons/react/linear';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router';
import { WorkspaceLink as Link } from '../../lib/vendor-workspace';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Field } from '../../components/Field';
import { IPhoneMockup } from '../../components/IPhoneMockup';
import { initial } from '../../components/PageHeader';
import { useMyScope, useMyVendor } from '../../layouts/VendorLayout';
import { errorMessage, type Storefront, type StorefrontSection, type Vendor } from '../../lib/api';
import { config } from '../../lib/config';
import { LOYALTY_LABELS, newSection, SECTION_TYPES, WIFI_SECURITY } from '../../lib/storefront';
import { t } from '../../i18n';
import { ImagesTab } from '../vendor/ImagesTab';
import { QrPosterDialog } from './qr-poster-dialog';

const SHOP = 'shop';
const SAVE_KEY = ['storefront', 'save'];
const ICONS: Record<StorefrontSection['type'], ComponentType<{ className?: string }>> = {
  loyalty: WalletIcon,
  rewards: GiftIcon,
  menu: ChefHatIcon,
  branches: MapPointIcon,
  wifi: WiFiRouterIcon,
  feedback: ChatRoundDotsIcon,
};

export const storefrontUrl = (vendor: Vendor, branchId?: string) =>
  vendor.slug ? `${config.webUrl}/${vendor.slug}${branchId ? `?b=${branchId}` : ''}` : null;

/**
 * Storefront: the customer website page (apps/web) live in an iPhone on the left, its sections on
 * the right, using the dashboard theme and controls. One storefront for every branch; a branch
 * can get its own copy. Changes save on their own and the phone reloads after each save.
 */
export function StorefrontEditor() {
  const vendorApi = useVendorApi();
  const vendor = useMyVendor();
  const qc = useQueryClient();
  const { data, error, isPending } = useQuery({
    queryKey: ['storefront'],
    queryFn: vendorApi.storefront,
  });
  const [scope, setScope] = useState<string>(SHOP);
  const [previewKey, setPreviewKey] = useState(0);
  const [qrOpen, setQrOpen] = useState(false);

  const branch = scope === SHOP ? null : data?.branches.find((b) => b.id === scope);
  const current: Storefront | null = !data ? null : scope === SHOP ? data.shop : (branch?.storefront ?? null);

  const save = useMutation({
    mutationKey: SAVE_KEY,
    mutationFn: vendorApi.saveStorefront,
    onSuccess: (d) => {
      qc.setQueryData(['storefront'], d);
      setPreviewKey((k) => k + 1);
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const branchId = scope === SHOP ? undefined : scope;
  const url = storefrontUrl(vendor, branchId);

  return (
    <div className="grid gap-6">
      {/* the shop and its page address, with the ways to share it */}
      <Card className="flex-row flex-wrap items-center gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-4">
          {vendor.logoUrl ? (
            <img src={vendor.logoUrl} alt="" className="size-12 shrink-0 rounded-xl border object-cover" />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-xl font-semibold">
              {initial(vendor.name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="truncate font-semibold">{vendor.name}</h2>
              <SaveStatus />
            </div>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                dir="ltr"
                className="block truncate py-0.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                {url.replace(/^https?:\/\//, '')}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">{t('storefront.noSlug')}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!url}
            onClick={() => {
              if (!url) return;
              navigator.clipboard.writeText(url).then(
                () => toast.success(t('storefront.linkCopied')),
                () => toast.error(t('storefront.copyFailed')),
              );
            }}
          >
            <CopyIcon /> {t('storefront.copyLink')}
          </Button>
          <Button variant="outline" size="sm" disabled={!url} onClick={() => setQrOpen(true)}>
            <QrCodeIcon /> {t('storefront.getQr')}
          </Button>
        </div>
      </Card>
      {url && qrOpen ? (
        <QrPosterDialog
          open
          onOpenChange={setQrOpen}
          vendor={vendor}
          branches={data?.branches ?? []}
          initialBranchId={branchId}
          urlFor={(id) => storefrontUrl(vendor, id)}
        />
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid justify-items-center gap-5 lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1">
          <IPhoneMockup src={url} width={300} reloadKey={previewKey} title={t('storefront.preview')} empty={t('storefront.noSlug')} />
          <PreviewFooter url={url} />
        </div>

        <div className="grid min-w-0 gap-4 lg:col-start-1 lg:row-start-1">
          <Card>
            <CardHeader>
              <CardTitle>{t('storefront.appliesTo')}</CardTitle>
              <CardDescription>{t('storefront.appliesToHint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="w-full sm:w-80" aria-label={t('storefront.appliesTo')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SHOP}>{t('storefront.allLocations')}</SelectItem>
                  {data?.branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                      {b.storefront ? ` · ${t('storefront.ownCopy')}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {branch ? (
                branch.storefront ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    {t('storefront.branchOwn', { branch: branch.name })}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={save.isPending}
                      onClick={() => save.mutate({ branchId: branch.id, storefront: null })}
                    >
                      <Refresh /> {t('storefront.useShop')}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3 text-sm">
                    <span className="text-muted-foreground">{t('storefront.branchUsesShop', { branch: branch.name })}</span>
                    <Button
                      size="sm"
                      disabled={save.isPending || !data}
                      onClick={() =>
                        data &&
                        save.mutate({
                          branchId: branch.id,
                          storefront: data.shop,
                        })
                      }
                    >
                      {t('storefront.customize')}
                    </Button>
                  </div>
                )
              ) : null}
            </CardContent>
          </Card>

          <ErrorAlert error={error} />
          {isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : current ? (
            <SectionsEditor key={scope} value={current} onChange={(storefront) => save.mutate({ branchId, storefront })} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Under the phone, like the footer of the page itself: Preview (the live page) | Change style. */
function PreviewFooter({ url, onNavigate }: { url: string | null; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const link =
    'rounded-md px-1 py-1 text-sm font-medium text-muted-foreground transition-colors duration-100 ease-linear hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none';
  return (
    <div className="flex items-center gap-4">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className={link}>
          {t('storefront.previewLink')}
        </a>
      ) : null}
      {url ? <span aria-hidden className="h-4 w-px bg-border" /> : null}
      <button
        type="button"
        className={link}
        onClick={() => {
          onNavigate?.();
          navigate(`/settings?tab=branding${workspace ? `&vendor=${workspace.me.vendorId}` : ''}`);
        }}
      >
        {t('storefront.changeStyle')}
      </button>
    </div>
  );
}

function SaveStatus() {
  const saving = useIsMutating({ mutationKey: SAVE_KEY }) > 0;
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle className="size-3.5" />}
      {saving ? t('profile.saving') : t('profile.allSaved')}
    </span>
  );
}

/**
 * The sections in page order. Picking, moving and removing save at once; typed WiFi details save
 * shortly after typing stops. The loyalty card is the core of the page: it can move, not go.
 */
function SectionsEditor({ value, onChange }: { value: Storefront; onChange: (s: Storefront) => void }) {
  const [sections, setSections] = useState(value.sections);
  const [menuOpen, setMenuOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const missing = useMemo(() => SECTION_TYPES.filter((type) => !sections.some((s) => s.type === type)), [sections]);

  const commit = (next: StorefrontSection[], later = false) => {
    setSections(next);
    window.clearTimeout(timer.current);
    if (later) timer.current = window.setTimeout(() => onChange({ sections: next }), 700);
    else onChange({ sections: next });
  };
  const move = (i: number, by: -1 | 1) => {
    const next = [...sections];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    commit(next);
  };
  const patch = (i: number, s: StorefrontSection, later = false) =>
    commit(
      sections.map((x, j) => (j === i ? s : x)),
      later,
    );

  return (
    <div className="grid gap-3">
      {sections.map((s, i) => {
        const Icon = ICONS[s.type];
        const core = s.type === 'loyalty';
        return (
          <div key={s.type} className="flex items-start gap-2">
            <Card className="min-w-0 flex-1 gap-4 p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{t(`storefront.sections.${s.type}.title`)}</h3>
                  <p className="text-sm text-muted-foreground">{t(`storefront.sections.${s.type}.hint`)}</p>
                </div>
                <Badge variant={core ? 'outline' : 'success'}>{core ? t('storefront.alwaysShown') : t('storefront.shown')}</Badge>
              </div>
              <SectionFields section={s} onChange={(next, later) => patch(i, next, later)} onEditMenu={() => setMenuOpen(true)} />
            </Card>
            <div className="flex flex-col gap-1 pt-3">
              <Button variant="ghost" size="icon-sm" disabled={i === 0} aria-label={t('storefront.moveUp')} onClick={() => move(i, -1)}>
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={i === sections.length - 1}
                aria-label={t('storefront.moveDown')}
                onClick={() => move(i, 1)}
              >
                <ArrowDown />
              </Button>
              {core ? null : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  aria-label={t('storefront.remove')}
                  onClick={() => commit(sections.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {missing.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="justify-self-start">
              <Plus /> {t('storefront.add')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {missing.map((type) => {
              const Icon = ICONS[type];
              return (
                <DropdownMenuItem key={type} onSelect={() => commit([...sections, newSection(type)])}>
                  <Icon /> {t(`storefront.sections.${type}.title`)}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <MenuDialog open={menuOpen} onOpenChange={setMenuOpen} />
    </div>
  );
}

function SectionFields({
  section: s,
  onChange,
  onEditMenu,
}: {
  section: StorefrontSection;
  onChange: (s: StorefrontSection, later?: boolean) => void;
  onEditMenu: () => void;
}) {
  switch (s.type) {
    case 'loyalty':
      return (
        <Field label={t('storefront.buttonWording')} htmlFor="sf-loyalty">
          <Select value={s.label} onValueChange={(v) => onChange({ ...s, label: v as typeof s.label })}>
            <SelectTrigger id="sf-loyalty" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOYALTY_LABELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {t(`storefront.loyaltyLabels.${l}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      );
    case 'menu':
      return (
        <Button variant="outline" className="w-fit" onClick={onEditMenu}>
          {t('storefront.editMenu')}
        </Button>
      );
    case 'wifi':
      return (
        <div className="grid gap-4">
          <Field label={t('storefront.wifiName')} htmlFor="sf-ssid">
            <Input id="sf-ssid" maxLength={32} dir="auto" value={s.ssid} onChange={(e) => onChange({ ...s, ssid: e.target.value }, true)} />
          </Field>
          <Field label={t('storefront.wifiSecurity')} htmlFor="sf-security">
            <Select value={s.security} onValueChange={(v) => onChange({ ...s, security: v as typeof s.security })}>
              <SelectTrigger id="sf-security" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WIFI_SECURITY.map((x) => (
                  <SelectItem key={x} value={x}>
                    {t(`storefront.security.${x}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {s.security !== 'none' ? (
            <Field label={t('storefront.wifiPassword')} htmlFor="sf-password" hint={t('storefront.wifiPasswordHint')}>
              <Input
                id="sf-password"
                maxLength={63}
                dir="ltr"
                autoComplete="off"
                value={s.password}
                onChange={(e) => onChange({ ...s, password: e.target.value }, true)}
              />
            </Field>
          ) : null}
        </div>
      );
    case 'rewards':
      return (
        <Button variant="outline" className="w-fit" asChild>
          <Link to="/rewards">{t('storefront.manageRewards')}</Link>
        </Button>
      );
    case 'feedback':
      return <FeedbackSettings section={s} onChange={onChange} />;
    case 'branches':
      return (
        <Button variant="outline" className="w-fit" asChild>
          <Link to="/branches">{t('storefront.manageBranches')}</Link>
        </Button>
      );
  }
}

/** The menu pages (photos of the printed menu), edited without leaving the storefront. */
function MenuDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const scope = useMyScope();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('storefront.editMenu')}</DialogTitle>
          <DialogDescription>{t('storefront.menuHint')}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          <ImagesTab scope={scope} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The eye button next to Storefront in the sidebar: the live page in an iPhone, over everything. */
export function StorefrontPreviewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const vendor = useMyVendor();
  const url = storefrontUrl(vendor);
  // fit the phone in the window (screen ratio 393 × 852, plus room for the footer)
  const [width, setWidth] = useState(300);
  useEffect(() => {
    const fit = () => setWidth(Math.max(220, Math.min(320, Math.floor(((window.innerHeight - 160) * 393) / 852))));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-auto max-w-none justify-items-center gap-5 border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-none [&>[data-slot=dialog-close]]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('storefront.preview')}</DialogTitle>
          <DialogDescription>{t('storefront.subtitle')}</DialogDescription>
        </DialogHeader>
        {open ? <IPhoneMockup src={url} width={width} title={t('storefront.preview')} empty={t('storefront.noSlug')} /> : null}
        <div className="rounded-full bg-card px-4 py-2 shadow-sm">
          <PreviewFooter url={url} onNavigate={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeedbackSettings({
  section,
  onChange,
}: {
  section: Extract<StorefrontSection, { type: 'feedback' }>;
  onChange: (s: StorefrontSection) => void;
}) {
  const [en, setEn] = useState(section.placeholder?.en ?? '');
  const [ar, setAr] = useState(section.placeholder?.ar ?? '');
  const both = !!en.trim() && !!ar.trim();
  const empty = !en.trim() && !ar.trim();
  const changed = en.trim() !== (section.placeholder?.en ?? '') || ar.trim() !== (section.placeholder?.ar ?? '');
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t('feedback.placeholderHint')}</p>
      <Field label={t('feedback.placeholderEn')} htmlFor="feedback-placeholder-en">
        <Input
          id="feedback-placeholder-en"
          dir="ltr"
          maxLength={300}
          value={en}
          placeholder={t('feedback.defaultEn')}
          onChange={(e) => setEn(e.target.value)}
        />
      </Field>
      <Field label={t('feedback.placeholderAr')} htmlFor="feedback-placeholder-ar">
        <Input
          id="feedback-placeholder-ar"
          dir="rtl"
          maxLength={300}
          value={ar}
          placeholder={t('feedback.defaultAr')}
          onChange={(e) => setAr(e.target.value)}
        />
      </Field>
      {!both && !empty ? (
        <p role="status" className="text-sm text-destructive">
          {t('feedback.bothRequired')}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!changed || (!both && !empty)}
          onClick={() =>
            onChange(
              both
                ? {
                    type: 'feedback',
                    placeholder: { en: en.trim(), ar: ar.trim() },
                  }
                : { type: 'feedback' },
            )
          }
        >
          {t('feedback.savePlaceholder')}
        </Button>
        <Button variant="outline" asChild>
          <Link to="/feedback">{t('feedback.view')}</Link>
        </Button>
      </div>
    </div>
  );
}
