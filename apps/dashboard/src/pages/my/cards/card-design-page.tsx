import {
  AddIcon,
  AltArrowLeftIcon,
  BookIcon,
  CardIcon,
  CloseIcon,
  EyeIcon,
  HistoryIcon,
  PaletteIcon,
  StarsIcon,
  TrashBinTrashIcon,
  UploadIcon,
} from '@solar-icons/react/linear';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import { Navigate, useBlocker } from 'react-router';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ErrorAlert } from '../../../components/ErrorAlert';
import { t } from '../../../i18n';
import { useMe, useMyScope, useMyVendor } from '../../../layouts/VendorLayout';
import type { CardDesign, CardLinkPlatform, LoyaltyCardInfo } from '../../../lib/api';
import { designProblem, LINK_PLATFORMS, MAX_LINKS, readableInk, softLabel } from '../../../lib/card-look';
import { useVendorApi, WorkspaceLink } from '../../../lib/vendor-workspace';
import { storefrontUrl } from '../storefront-editor';
import { BackgroundPicker, BilingualField, CardHoursEditor, ColorField } from './card-fields';
import { CardPreview, type PreviewInput } from './card-preview';

/** Loyalty → Cards → Design card: the look, the buttons and the back of the card, with a live preview and history. */
export function CardDesignPage() {
  const api = useVendorApi();
  const me = useMe();
  const scope = useMyScope();
  const vendor = useMyVendor();
  const qc = useQueryClient();
  const { data, error, isPending } = useQuery({
    queryKey: ['loyalty-card'],
    queryFn: api.loyaltyCard,
  });
  const branches = useQuery({ queryKey: ['branches', scope.key], queryFn: () => scope.branches() });
  const openBranches = (branches.data ?? []).filter((b) => b.status === 'active');

  const [draft, setDraft] = useState<CardDesign | null>(null);
  const loadedFrom = useRef<string | null>(null);
  useEffect(() => {
    // (re)load the editor from the live version, after the first fetch and after "Use this"
    if (data?.design && data.card && loadedFrom.current !== data.card.liveVersionId) {
      loadedFrom.current = data.card.liveVersionId;
      setDraft(structuredClone(data.design));
    }
  }, [data]);

  const dirty = !!draft && !!data?.design && JSON.stringify(draft) !== JSON.stringify(data.design);
  const leaving = useLeaveGuard(dirty);
  const wide = useWide();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tab, setTab] = useState<EditorTab>('look');

  const liveNumber = (info: LoyaltyCardInfo) => info.versions.find((v) => v.live)?.number ?? 0;
  const save = useMutation({
    mutationFn: (d: CardDesign) => api.saveLoyaltyCardVersion(d),
    onSuccess: (next) => {
      loadedFrom.current = next.card?.liveVersionId ?? null;
      qc.setQueryData(['loyalty-card'], next);
      if (next.design) setDraft(structuredClone(next.design));
      toast.success(t('cards.editor.savedToast', { n: liveNumber(next) }));
    },
  });
  const switchTo = useMutation({
    mutationFn: (id: string) => api.makeLoyaltyCardVersionLive(id),
    onSuccess: (next) => {
      qc.setQueryData(['loyalty-card'], next);
      toast.success(t('cards.history.switched', { n: liveNumber(next) }));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  if (me.role !== 'vendor_admin') return <Navigate to="/card" replace />;
  if (!isPending && data && (!data.card || data.card.status === 'cancelled')) {
    return (
      <div className="grid gap-3">
        <BackLink />
        <p className="text-muted-foreground">{t('cards.editor.noCard')}</p>
      </div>
    );
  }

  const problem = draft ? designProblem(draft) : null;
  const previewInput: PreviewInput | null = draft
    ? {
        design: draft,
        merchant: { name: vendor.name, logoUrl: vendor.logoUrl },
        branches: openBranches,
      }
    : null;

  return (
    <div className="pb-24 xl:pb-0">
      <BackLink />
      <div className="mt-2 mb-5">
        <h1 className="text-2xl font-bold tracking-tight">{t('cards.editor.title')}</h1>
        <p className="mt-1 text-muted-foreground">{data?.card?.name}</p>
      </div>
      <ErrorAlert error={error} />

      {/* the save bar: always in reach */}
      <div data-mobile-dialog-actions className="sticky top-2 z-20 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs">
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {dirty ? (
            <span className="font-medium text-foreground">● {t('cards.editor.unsaved')}</span>
          ) : data ? (
            t('cards.editor.saved', { n: liveNumber(data) })
          ) : null}
          {dirty && problem ? <span className="ms-2 text-destructive">{t(problem)}</span> : null}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!dirty || save.isPending}
            onClick={() => data?.design && setDraft(structuredClone(data.design))}
          >
            {t('cards.editor.discard')}
          </Button>
          <Button size="sm" disabled={!dirty || !!problem || save.isPending} onClick={() => draft && save.mutate(draft)}>
            {t('cards.editor.save')}
          </Button>
        </div>
      </div>
      <ErrorAlert error={save.error} className="mb-4" />

      {isPending || !draft || !data ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
          {/* one topic at a time: short pages instead of one long scroll */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as EditorTab)} className="min-w-0 gap-5">
            <div className="overflow-x-auto [scrollbar-width:none]">
              <TabsList className="w-max">
                {EDITOR_TABS.map((key) => (
                  <TabsTrigger key={key} value={key}>
                    {t(`cards.editor.tabs.${key}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <TabsContent value="look" className="grid gap-6">
              <ColoursSection draft={draft} setDraft={setDraft} brand={vendor.brandPrimary} />
              <BackgroundSection draft={draft} setDraft={setDraft} />
            </TabsContent>
            <TabsContent value="front" className="grid gap-6">
              <FrontSection draft={draft} setDraft={setDraft} />
            </TabsContent>
            <TabsContent value="buttons" className="grid gap-6">
              <ButtonsSection draft={draft} setDraft={setDraft} branches={openBranches} storefront={storefrontUrl(vendor)} />
            </TabsContent>
            <TabsContent value="back" className="grid gap-6">
              <BackSection draft={draft} setDraft={setDraft} />
            </TabsContent>
            <TabsContent value="history" className="grid gap-6">
              <HistoryCard info={data} onUse={(id) => switchTo.mutate(id)} busy={switchTo.isPending || dirty} />
            </TabsContent>
          </Tabs>
          {wide && previewInput ? (
            <div className="sticky top-20">
              <Card className={SECTION_CARD}>
                <CardContent>
                  <CardPreview {...previewInput} />
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      )}

      <LeaveDialog blocker={leaving} canSave={!problem && !save.isPending} onSave={() => (draft ? save.mutateAsync(draft) : Promise.resolve())} />

      {/* phones and tablets: the preview opens from a floating button, like the storefront editor */}
      {!wide && previewInput ? (
        <>
          <div
            data-mobile-dialog-actions
            className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex justify-center"
          >
            <Button size="lg" className="pointer-events-auto rounded-full px-5 shadow-lg" onClick={() => setPreviewOpen(true)}>
              <EyeIcon /> {t('cards.preview.open')}
            </Button>
          </div>
          <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
            <SheetContent side="bottom" className="max-h-dvh gap-0 overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
              <SheetHeader className="pe-12">
                <SheetTitle>{t('cards.preview.title')}</SheetTitle>
                <SheetDescription className="sr-only">{t('cards.preview.open')}</SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                <CardPreview {...previewInput} />
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : null}
    </div>
  );
}

function BackLink() {
  return (
    <WorkspaceLink to="/card" className="inline-flex min-h-7 items-center gap-1 text-sm font-medium text-primary hover:underline">
      <AltArrowLeftIcon className="size-4 rtl:rotate-180" /> {t('cards.editor.backToCards')}
    </WorkspaceLink>
  );
}

const EDITOR_TABS = ['look', 'front', 'buttons', 'back', 'history'] as const;
type EditorTab = (typeof EDITOR_TABS)[number];

/** Roomier than the default card: each editor section reads as its own block. */
const SECTION_CARD = 'gap-5 [--card-spacing:--spacing(6)]';

type SectionProps = { draft: CardDesign; setDraft: (d: CardDesign) => void };

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card className={SECTION_CARD}>
      <CardHeader className="flex flex-row items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </CardHeader>
      <CardContent className="@container grid grid-cols-[minmax(0,1fr)] gap-5">{children}</CardContent>
    </Card>
  );
}

function ColoursSection({ draft, setDraft, brand }: SectionProps & { brand: string | null }) {
  const c = draft.colors;
  /** A new background re-picks the automatic text and label colours. */
  const setBackground = (background: string, useBrand: boolean) => {
    const ink = readableInk(background);
    setDraft({
      ...draft,
      colors: {
        ...c,
        background,
        useBrand,
        text: c.autoText ? ink : c.text,
        label: c.autoLabel ? softLabel(c.autoText ? ink : c.text) : c.label,
      },
    });
  };
  return (
    <Section icon={PaletteIcon} title={t('cards.colors.title')}>
      <div className="grid gap-5 @2xl:grid-cols-3">
        <ColorField
          id="color-bg"
          label={t('cards.colors.background')}
          value={c.background}
          disabled={c.useBrand && !!brand}
          onChange={(hex) => setBackground(hex, false)}
          toggle={{
            label: t('cards.colors.useBrand'),
            checked: c.useBrand && !!brand,
            disabled: !brand,
            onChange: (on) => setBackground(on && brand ? brand.toUpperCase() : c.background, on),
          }}
        />
        <ColorField
          id="color-text"
          label={t('cards.colors.text')}
          value={c.text}
          disabled={c.autoText}
          onChange={(text) =>
            setDraft({
              ...draft,
              colors: {
                ...c,
                text,
                label: c.autoLabel ? softLabel(text) : c.label,
              },
            })
          }
          toggle={{
            label: t('cards.colors.auto'),
            checked: c.autoText,
            onChange: (on) => {
              const text = on ? readableInk(c.background) : c.text;
              setDraft({
                ...draft,
                colors: {
                  ...c,
                  autoText: on,
                  text,
                  label: c.autoLabel ? softLabel(text) : c.label,
                },
              });
            },
          }}
        />
        <ColorField
          id="color-label"
          label={t('cards.colors.label')}
          value={c.label}
          disabled={c.autoLabel}
          onChange={(label) => setDraft({ ...draft, colors: { ...c, label } })}
          toggle={{
            label: t('cards.colors.auto'),
            checked: c.autoLabel,
            onChange: (on) =>
              setDraft({
                ...draft,
                colors: {
                  ...c,
                  autoLabel: on,
                  label: on ? softLabel(c.text) : c.label,
                },
              }),
          }}
        />
      </div>
      {!brand ? <p className="text-xs text-muted-foreground">{t('cards.colors.noBrand')}</p> : null}
      <p className="text-xs text-muted-foreground">{t('cards.colors.androidNote')}</p>
    </Section>
  );
}

function BackgroundSection({ draft, setDraft }: SectionProps) {
  const api = useVendorApi();
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (f: File) => api.uploadCardBackground(f),
    onSuccess: (img) => setDraft({ ...draft, background: { ...draft.background, ...img } }),
  });
  const image = draft.background.imageUrl;
  return (
    <Section icon={StarsIcon} title={t('cards.background.title')} subtitle={t('cards.background.subtitle')}>
      <BackgroundPicker
        design={draft}
        value={image ? null : draft.background.style}
        onChange={(style) =>
          setDraft({
            ...draft,
            background: { style, imageUrl: null, imagePath: null },
          })
        }
      />
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3">
        {image ? <img src={image} alt="" className="h-16 w-28 rounded-lg object-cover" /> : null}
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="text-xs text-muted-foreground">{t('cards.background.imageHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}>
              <UploadIcon />{' '}
              {upload.isPending ? t('cards.background.uploading') : image ? t('cards.background.replace') : t('cards.background.upload')}
            </Button>
            {image ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDraft({
                    ...draft,
                    background: {
                      ...draft.background,
                      imageUrl: null,
                      imagePath: null,
                    },
                  })
                }
              >
                <TrashBinTrashIcon /> {t('cards.background.remove')}
              </Button>
            ) : null}
          </div>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = '';
          }}
        />
      </div>
      <ErrorAlert error={upload.error} />
    </Section>
  );
}

function FrontSection({ draft, setDraft }: SectionProps) {
  const f = draft.front;
  return (
    <Section icon={CardIcon} title={t('cards.front.title')}>
      <BilingualField
        id="front-title"
        label={t('cards.front.cardTitle')}
        hint={t('cards.front.cardTitleHint')}
        value={f.title}
        maxLength={40}
        onChange={(title) => setDraft({ ...draft, front: { ...f, title } })}
      />
      <BilingualField
        id="front-points"
        label={t('cards.front.pointsLabel')}
        value={f.pointsLabel}
        maxLength={20}
        onChange={(pointsLabel) => setDraft({ ...draft, front: { ...f, pointsLabel } })}
      />
      <div className="grid gap-1 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
        <p>{t('cards.front.always')}</p>
        <p>
          {t('cards.front.logo')}{' '}
          <WorkspaceLink to="/settings?tab=branding" className="font-medium text-primary hover:underline">
            {t('cards.front.changeLogo')}
          </WorkspaceLink>
        </p>
      </div>
    </Section>
  );
}

function ButtonsSection({
  draft,
  setDraft,
  branches,
  storefront,
}: SectionProps & {
  branches: { id: string; name: string; lat: number | null }[];
  storefront: string | null;
}) {
  const b = draft.buttons;
  const s = b.secondary;
  const branch = s.type === 'directions' ? branches.find((x) => x.id === s.branchId) : undefined;
  return (
    <Section icon={StarsIcon} title={t('cards.buttons.title')} subtitle={t('cards.buttons.subtitle')}>
      <div className="grid gap-3 rounded-xl border p-4">
        <div>
          <p className="text-sm font-medium">{t('cards.buttons.button1')}</p>
          <p className="text-xs text-muted-foreground">{t('cards.buttons.button1Hint')}</p>
          {storefront ? (
            <p className="mt-1 truncate text-xs text-muted-foreground" dir="ltr">
              {storefront.replace(/^https?:\/\//, '')}
            </p>
          ) : null}
        </div>
        <BilingualField
          id="button-1"
          label={t('cards.buttons.label')}
          value={b.primaryLabel}
          maxLength={30}
          onChange={(primaryLabel) => setDraft({ ...draft, buttons: { ...b, primaryLabel } })}
        />
      </div>
      <div className="grid gap-3 rounded-xl border p-4">
        <Label htmlFor="button-2">{t('cards.buttons.button2')}</Label>
        <Select
          value={s.type}
          onValueChange={(type) =>
            setDraft({
              ...draft,
              buttons: {
                ...b,
                secondary:
                  type === 'directions' ? { type, branchId: branches[0]?.id ?? '' } : type === 'call' ? { type, phone: '' } : { type: 'none' },
              },
            })
          }
        >
          <SelectTrigger id="button-2" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('cards.buttons.none')}</SelectItem>
            <SelectItem value="directions" disabled={!branches.length}>
              {t('cards.buttons.directions')}
            </SelectItem>
            <SelectItem value="call">{t('cards.buttons.call')}</SelectItem>
          </SelectContent>
        </Select>
        {s.type === 'directions' ? (
          <div className="grid gap-2">
            <Label htmlFor="button-branch">{t('cards.buttons.branch')}</Label>
            <Select
              value={s.branchId}
              onValueChange={(branchId) =>
                setDraft({
                  ...draft,
                  buttons: {
                    ...b,
                    secondary: { type: 'directions', branchId },
                  },
                })
              }
            >
              <SelectTrigger id="button-branch" className="w-full">
                <SelectValue placeholder={t('cards.buttons.pickBranch')} />
              </SelectTrigger>
              <SelectContent>
                {branches.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {branch && branch.lat === null ? <p className="text-xs text-warning">{t('cards.buttons.noPin')}</p> : null}
          </div>
        ) : null}
        {s.type === 'call' ? (
          <div className="grid gap-2">
            <Label htmlFor="button-phone">{t('cards.buttons.phone')}</Label>
            <Input
              id="button-phone"
              type="tel"
              dir="ltr"
              inputMode="tel"
              maxLength={30}
              placeholder="+20 100 000 0000"
              value={s.phone}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  buttons: {
                    ...b,
                    secondary: { type: 'call', phone: e.target.value },
                  },
                })
              }
            />
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function BackSection({ draft, setDraft }: SectionProps) {
  const back = draft.back;
  const set = (patch: Partial<CardDesign['back']>) => setDraft({ ...draft, back: { ...back, ...patch } });
  const setLink = (i: number, patch: Partial<CardDesign['back']['links'][number]>) =>
    set({
      links: back.links.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    });
  return (
    <Section icon={BookIcon} title={t('cards.back.title')} subtitle={t('cards.back.subtitle')}>
      <div className="grid gap-2">
        <Label htmlFor="back-about">{t('cards.back.about')}</Label>
        <Textarea
          id="back-about"
          rows={3}
          maxLength={1000}
          placeholder={t('cards.back.aboutPlaceholder')}
          value={back.about}
          onChange={(e) => set({ about: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <CardHoursEditor value={back.hours} onChange={(hours) => set({ hours })} />
      </div>
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">{t('cards.back.links', { max: MAX_LINKS })}</legend>
        {back.links.map((l, i) => (
          <div key={i} className="grid gap-2 rounded-xl border p-3 @xl:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] @xl:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor={`link-${i}-platform`} className="text-xs font-normal text-muted-foreground">
                {t('cards.back.platform')}
              </Label>
              <Select
                value={l.platform}
                onValueChange={(platform) =>
                  setLink(i, {
                    platform: platform as CardLinkPlatform,
                    label: platform === 'custom' ? (l.label ?? '') : undefined,
                  })
                }
              >
                <SelectTrigger id={`link-${i}-platform`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`cards.back.platforms.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`link-${i}-value`} className="text-xs font-normal text-muted-foreground">
                {t('cards.back.value')}
              </Label>
              <Input
                id={`link-${i}-value`}
                dir="ltr"
                maxLength={300}
                placeholder={t(`cards.back.placeholders.${l.platform}`)}
                value={l.value}
                onChange={(e) => setLink(i, { value: e.target.value })}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('cards.back.removeLink')}
              onClick={() => set({ links: back.links.filter((_, j) => j !== i) })}
            >
              <CloseIcon />
            </Button>
            {l.platform === 'custom' ? (
              <div className="grid gap-1.5 @xl:col-span-2">
                <Label htmlFor={`link-${i}-label`} className="text-xs font-normal text-muted-foreground">
                  {t('cards.back.customLabel')}
                </Label>
                <Input id={`link-${i}-label`} maxLength={40} value={l.label ?? ''} onChange={(e) => setLink(i, { label: e.target.value })} />
              </div>
            ) : null}
          </div>
        ))}
        {back.links.length < MAX_LINKS ? (
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                set({
                  links: [...back.links, { platform: 'instagram', value: '' }],
                })
              }
            >
              <AddIcon /> {t('cards.back.addLink')}
            </Button>
          </div>
        ) : null}
      </fieldset>
      <div className="grid gap-2">
        <Label htmlFor="back-terms">{t('cards.back.terms')}</Label>
        <Textarea
          id="back-terms"
          rows={3}
          maxLength={2000}
          placeholder={t('cards.back.termsPlaceholder')}
          value={back.terms}
          onChange={(e) => set({ terms: e.target.value })}
        />
      </div>
    </Section>
  );
}

/** Versions on one page of the history. */
const HISTORY_PAGE = 5;

/** Every saved version, newest first, 5 a page; "Use this" makes one live (no new version is made). */
function HistoryCard({ info, onUse, busy }: { info: LoyaltyCardInfo; onUse: (id: string) => void; busy: boolean }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(info.versions.length / HISTORY_PAGE));
  const current = Math.min(page, pages);
  const shown = info.versions.slice((current - 1) * HISTORY_PAGE, current * HISTORY_PAGE);
  return (
    <Card className={SECTION_CARD}>
      <CardHeader className="flex flex-row items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HistoryIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold">{t('cards.history.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('cards.history.subtitle')}</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {info.versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('cards.history.empty')}</p>
        ) : (
          <ul className="grid divide-y rounded-xl border">
            {shown.map((v) => (
              <li key={v.id} className={cn('flex min-h-14 items-center justify-between gap-3 px-3 py-2', v.live && 'bg-muted/60')}>
                <div className="min-w-0 text-sm">
                  <span className="font-semibold">{t('cards.history.version', { n: v.number })}</span>
                  {v.live ? (
                    <Badge variant="success" className="ms-2 font-semibold">
                      {t('cards.history.live')}
                    </Badge>
                  ) : null}
                  <div className="truncate text-xs text-muted-foreground">
                    {dayjs(v.createdAt).format('D MMM YYYY, HH:mm')}
                    {v.createdBy ? ` · ${t('cards.history.by', { name: v.createdBy })}` : ''}
                  </div>
                </div>
                {v.live ? null : (
                  <Button size="sm" variant="outline" className="shrink-0" disabled={busy} onClick={() => onUse(v.id)}>
                    {t('cards.history.use')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {pages > 1 ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
              {t('cards.membersDialog.prev')}
            </Button>
            <span className="text-muted-foreground">{t('cards.membersDialog.page', { page: current, pages })}</span>
            <Button variant="outline" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>
              {t('cards.membersDialog.next')}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Leaving the editor with unsaved changes: in-app links are held for our own dialog. Closing or
 * reloading the tab can only use the browser's built-in question (browsers don't allow another).
 */
function useLeaveGuard(dirty: boolean) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  return blocker;
}

/** "You have unsaved changes": keep editing, leave without saving, or save and leave. */
function LeaveDialog({ blocker, canSave, onSave }: { blocker: ReturnType<typeof useBlocker>; canSave: boolean; onSave: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={blocker.state === 'blocked'} onOpenChange={(open) => !open && !busy && blocker.reset?.()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('cards.editor.leaveTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('cards.editor.leave')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => blocker.reset?.()}>
            {t('cards.editor.keepEditing')}
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => blocker.proceed?.()}>
            {t('cards.editor.leaveWithout')}
          </Button>
          {canSave ? (
            <Button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                onSave()
                  .then(() => blocker.proceed?.())
                  .catch(() => blocker.reset?.())
                  .finally(() => setBusy(false));
              }}
            >
              {t('cards.editor.saveAndLeave')}
            </Button>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** xl and up (1280 px): the preview sits beside the editor; below, it opens from the floating button. */
const WIDE = '(min-width: 1280px)';
function useWide() {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(WIDE);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(WIDE).matches,
  );
}
