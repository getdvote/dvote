// DEV NOTE: Preserve this dashboard's existing shared shadcn/Radix components and theme.
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type React from "react";
import { useCampaignAutosave } from "./use-campaign-autosave";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AddCircleIcon as AddCircle,
  CalendarAddIcon as CalendarAdd,
  InfoCircleIcon as InfoCircle,
} from "@solar-icons/react/linear";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageHeader } from "../../components/PageHeader";
import { BrandPattern } from "../../components/BrandArt";
import { ErrorAlert } from "../../components/ErrorAlert";
import { Field } from "../../components/Field";
import { DatePicker, TimePicker } from "../../components/PeriodFilter";
import { ConfirmAction } from "../../components/ConfirmAction";
import { Segmented } from "../../components/segmented";
import { StatusFilter } from "../../components/ListControls";
import { TableState } from "../../components/TableState";
import { localeOf, t } from "../../i18n";
import { useMe } from "../../layouts/VendorLayout";
import { useVendorApi } from "../../lib/vendor-workspace";
import type {
  BroadcastCampaign,
  BroadcastCampaignInput,
  CustomerSegment,
  MerchantCustomerQuery,
} from "../../lib/api";

const dateText = (v: string | null) =>
  v
    ? new Date(v).toLocaleString(localeOf(), {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : t("broadcast.notScheduled");
const localDate = (v: string) => {
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const statusVariant = (status: string) =>
  status === "sent"
    ? "success"
    : status === "failed"
      ? "destructive"
      : status === "draft" || status === "cancelled"
        ? "secondary"
        : "outline";

export function MyMessages() {
  const api = useVendorApi();
  const me = useMe();
  const allowed = me.role === "vendor_admin";
  const [tab, setTab] = useState("push");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState<string>();
  const [clientDraftId, setClientDraftId] = useState(() => crypto.randomUUID());
  const [autoEligible, setAutoEligible] = useState(true);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [mode, setMode] = useState<"now" | "schedule" | "repeat">("now");
  const [nextAt, setNextAt] = useState("");
  const [repeatDays, setRepeatDays] = useState(7);
  const [wallet, setWallet] = useState<"apple" | "google">("apple");
  const [branchSelection, setBranchSelection] = useState<string[] | null>(null);
  const customers = useQuery({
    queryKey: ["broadcast-segments", me.id],
    queryFn: () => api.customers({ pageSize: 1 }),
    enabled: allowed,
  });
  const branches = useQuery({
    queryKey: ["broadcast-branches", me.id],
    queryFn: api.branches,
    enabled: allowed,
  });
  const history = useQuery({
    queryKey: ["broadcasts", me.id],
    queryFn: api.broadcasts,
    enabled: allowed,
    refetchInterval: 5000,
  });
  const campaigns = useQuery({
    queryKey: ["broadcast-campaigns", me.id],
    queryFn: api.campaigns,
    enabled: allowed,
    refetchInterval: 5000,
  });
  const quota = useQuery({
    queryKey: ["broadcast-quota", me.id],
    queryFn: api.broadcastQuota,
    enabled: allowed,
    refetchInterval: 5000,
  });
  const nearby = useQuery({
    queryKey: ["broadcast-nearby", me.id],
    queryFn: api.nearbyNotifications,
    enabled: allowed,
  });
  const profile = useQuery({
    queryKey: ["broadcast-profile", me.id],
    queryFn: api.profile,
    enabled: allowed,
  });
  const merchantName = profile.data?.name ?? me.vendor.name;
  const filters: MerchantCustomerQuery = audience.startsWith("custom:")
    ? { customSegment: audience.slice(7) }
    : audience === "all"
      ? {}
      : { segment: audience as CustomerSegment };
  const preview = useQuery({
    queryKey: ["broadcast-audience", me.id, filters],
    queryFn: () => api.broadcastPreview(filters),
    enabled: allowed && open,
  });
  const currentPreview =
    !preview.isFetching && !preview.isError ? preview.data : undefined;
  const refresh = () => {
    void campaigns.refetch();
    void history.refetch();
    void quota.refetch();
  };
  const draftInput: BroadcastCampaignInput = {
    ...filters,
    clientDraftId,
    name: name.trim() || t("broadcast.untitled"),
    body,
    mode: "draft",
    draftMode: mode,
    repeatDays,
    ...(nextAt && !Number.isNaN(new Date(nextAt).getTime())
      ? { nextAt: new Date(nextAt).toISOString() }
      : {}),
  };
  const autosave = useCampaignAutosave(
    `dvote-broadcast-draft:${me.vendorId}:${me.id}`,
    open && autoEligible,
    name.trim() || body.trim() || editing
      ? { input: draftInput, editing }
      : null,
    api.saveCampaign,
    refresh,
  );
  const save = useMutation({
    mutationFn: async (m: BroadcastCampaignInput["mode"]) => {
      const draft = autoEligible ? await autosave.flush() : undefined;
      autosave.pause();
      if (m === "draft" && draft) return draft;
      try {
        return await api.saveCampaign(
          {
            ...filters,
            name: name.trim() || t("broadcast.untitled"),
            body: body.trim(),
            mode: m,
            ...(m === "schedule" || m === "repeat"
              ? { nextAt: new Date(nextAt).toISOString() }
              : {}),
            ...(m === "repeat" ? { repeatDays } : {}),
          },
          draft?.id ?? editing,
        );
      } catch (error) {
        autosave.resume();
        throw error;
      }
    },
    onSuccess: () => {
      autosave.clear();
      setOpen(false);
      refresh();
      toast.success(t("broadcast.saved"));
    },
  });
  const cancel = useMutation({
    mutationFn: api.cancelCampaign,
    onSuccess: refresh,
  });
  const eligible =
    branches.data?.filter(
      (b) => b.status === "active" && b.lat != null && b.lng != null,
    ) ?? [];
  const selected =
    branchSelection ?? nearby.data?.branchIds ?? eligible.map((b) => b.id);
  const settings = useMutation({
    mutationFn: (enabled: boolean) =>
      api.setNearbyNotifications(enabled, selected),
    onSuccess: () => {
      void nearby.refetch();
      void quota.refetch();
      toast.success(t("broadcast.nearbySaved"));
    },
  });
  const start = (
    c?: BroadcastCampaign,
    copy = false,
    initialMode: typeof mode = "now",
  ) => {
    autosave.reset();
    setClientDraftId(crypto.randomUUID());
    setAutoEligible(!c || copy || c.status === "draft");
    setEditing(copy ? undefined : c?.id);
    setName(c?.name ?? "");
    setBody(c?.body ?? "");
    setAudience(
      c?.audience.customSegment
        ? `custom:${c.audience.customSegment}`
        : (c?.audience.segment ?? "all"),
    );
    setMode(
      c?.audience.draftMode && !copy
        ? c.audience.draftMode
        : c?.repeatDays && !copy
          ? "repeat"
          : c?.nextAt && !copy
            ? "schedule"
            : initialMode,
    );
    setNextAt(
      !copy && (c?.audience.draftNextAt || c?.nextAt)
        ? localDate((c?.audience.draftNextAt || c?.nextAt)!)
        : "",
    );
    setRepeatDays(c?.audience.draftRepeatDays ?? c?.repeatDays ?? 7);
    setStep(0);
    save.reset();
    setOpen(true);
  };
  const legacy: BroadcastCampaign[] = (history.data ?? []).map((c) => ({
    id: c.id,
    name: c.title,
    body: c.body,
    audience: c.audience ?? {},
    status: c.pending
      ? "processing"
      : c.failed || c.unknown
        ? "failed"
        : "sent",
    nextAt: null,
    repeatDays: null,
    createdAt: c.createdAt,
    accepted: c.accepted,
  }));
  const items = [...(campaigns.data ?? []), ...legacy].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const upcoming = items
    .filter((c) => ["scheduled", "repeating"].includes(c.status))
    .sort((a, b) => (a.nextAt ?? "").localeCompare(b.nextAt ?? ""));
  const last = items.find((c) => c.status === "sent");
  const matches = (c: BroadcastCampaign, f: string) =>
    f === "all" ||
    (f === "scheduled"
      ? ["scheduled", "repeating"].includes(c.status)
      : c.status === f);
  const audienceName = (q: MerchantCustomerQuery) =>
    q.customSegment
      ? (customers.data?.customSegments.find((s) => s.id === q.customSegment)
          ?.name ?? t("broadcast.segment"))
      : q.segment
        ? t(`customers.segments.${q.segment}.label`)
        : t("broadcast.everyone");
  // The API refuses < and > (Wallet text is plain); say so before the merchant reaches Send.
  const hasMarkup = /[<>]/.test(name + body);
  const validContent = !!name.trim() && !!body.trim() && !hasMarkup;
  const validTime =
    mode === "now" || (!!nextAt && new Date(nextAt).getTime() > Date.now());
  const canSend =
    validContent &&
    validTime &&
    !!currentPreview?.configured &&
    !!currentPreview.linked &&
    (mode !== "now" || (quota.data?.remaining ?? 0) > 0) &&
    !save.isPending;
  const action = t(
    mode === "now"
      ? "broadcast.send"
      : mode === "schedule"
        ? "broadcast.scheduleSend"
        : "broadcast.startRepeat",
  );
  if (!allowed)
    return (
      <>
        <PageHeader
          title={t("nav.messages")}
          subtitle={t("broadcast.subtitle")}
        />
        <Card className="p-6 text-sm text-muted-foreground">
          {t("messages.adminOnly")}
        </Card>
      </>
    );
  const remaining = quota.data?.remaining ?? 0;
  const summary = (
    <Card className="mb-6 gap-0 py-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.2fr)] lg:divide-x divide-y lg:divide-y-0">
      {/* how many can still go out */}
      <section className="flex flex-col gap-3 p-5">
        <SummaryLabel hint={t("broadcast.allowance")}>
          {t("broadcast.leftTitle")}
        </SummaryLabel>
        <p className="flex items-baseline gap-1.5" aria-live="polite">
          <span className="text-3xl font-semibold tabular-nums">
            {quota.data ? remaining : "–"}
          </span>
          <span className="text-sm text-muted-foreground">
            {t("broadcast.leftOf")}
          </span>
        </p>
        <div className="flex gap-1" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                n <= remaining ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {quota.data?.resetsAt && remaining < 3
            ? t("broadcast.freesUp", {
                time: new Date(quota.data.resetsAt).toLocaleString(localeOf(), {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                }),
              })
            : t("broadcast.rolling")}
        </p>
      </section>

      {/* the latest one sent */}
      <section className="flex min-w-0 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <SummaryLabel hint={t("broadcast.historyHint")}>
            {t("broadcast.last")}
          </SummaryLabel>
          {last ? (
            <Badge variant={statusVariant(last.deliveryStatus ?? last.status)}>
              {t(`broadcast.${last.deliveryStatus ?? last.status}`)}
            </Badge>
          ) : null}
        </div>
        {last ? (
          <>
            <div className="min-w-0">
              <p className="truncate font-medium">{last.name}</p>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {last.body}
              </p>
            </div>
            <p className="mt-auto text-xs text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">
                {t("broadcast.reached", { count: last.accepted })}
              </span>
              {" · "}
              {dateText(last.createdAt)} · {audienceName(last.audience)}
            </p>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">
              {t("broadcast.nothingSent")}
            </p>
            <Button variant="outline" size="sm" onClick={() => start()}>
              <AddCircle />
              {t("broadcast.firstPush")}
            </Button>
          </div>
        )}
      </section>

      {/* what's queued next */}
      <section className="flex min-w-0 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <SummaryLabel>{t("broadcast.coming")}</SummaryLabel>
          {upcoming.length ? (
            <Button
              variant="link"
              size="sm"
              className="h-6 px-0"
              onClick={() => {
                setTab("push");
                setFilter("scheduled");
              }}
            >
              {t("broadcast.allCampaigns")}
            </Button>
          ) : null}
        </div>
        {upcoming.length ? (
          <ul className="grid gap-2">
            {upcoming.slice(0, 2).map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <CalendarAdd className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {dateText(c.nextAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-1 flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">
              {t("broadcast.nothingScheduled")}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => start(undefined, false, "schedule")}
            >
              <CalendarAdd />
              {t("broadcast.schedulePush")}
            </Button>
          </div>
        )}
      </section>
    </Card>
  );
  return (
    <>
      <PageHeader
        title={t("nav.messages")}
        subtitle={t("broadcast.subtitle")}
        extra={
          <Button onClick={() => start()}>
            <AddCircle />
            {t("broadcast.new")}
          </Button>
        }
      />
      <ErrorAlert
        error={
          customers.error ||
          branches.error ||
          history.error ||
          campaigns.error ||
          quota.error ||
          nearby.error ||
          profile.error
        }
      />
      {summary}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="push">
            {t("broadcast.push")}
          </TabsTrigger>
          <TabsTrigger value="nearby">
            {t("broadcast.nearby")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="push" className="space-y-3">
          <Card className="gap-0 py-0">
            <div className="flex flex-wrap gap-3 p-4">
              <StatusFilter
                value={filter}
                onChange={setFilter}
                options={(["all", "scheduled", "sent", "draft"] as const).map(
                  (f) => ({
                    value: f,
                    label: (
                      <>
                        {t(`broadcast.${f === "draft" ? "drafts" : f}`)}
                        <span className="text-muted-foreground tabular-nums">
                          {items.filter((c) => matches(c, f)).length}
                        </span>
                      </>
                    ),
                  }),
                )}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-4">
                    {t("broadcast.colCampaign")}
                  </TableHead>
                  <TableHead>{t("broadcast.colAudience")}</TableHead>
                  <TableHead>{t("broadcast.when")}</TableHead>
                  <TableHead className="text-end">
                    {t("broadcast.colReached")}
                  </TableHead>
                  <TableHead>{t("broadcast.colStatus")}</TableHead>
                  <TableHead className="pe-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableState
                  loading={campaigns.isLoading || history.isLoading}
                  empty={!items.filter((c) => matches(c, filter)).length}
                  colSpan={6}
                  illustration={filter === "all" ? "send-campaign" : undefined}
                  emptyTitle={t("emptyStates.broadcastTitle")}
                  emptyText={t("broadcast.empty")}
                  action={
                    filter === "all" || filter === "draft" ? (
                      <Button size="sm" onClick={() => start()}>
                        <AddCircle />
                        {t("broadcast.new")}
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                        {t("emptyStates.clearFilters")}
                      </Button>
                    )
                  }
                />
                {!(campaigns.isLoading || history.isLoading) &&
                  items
                    .filter((c) => matches(c, filter))
                    .map((c) => {
                      const status = c.deliveryStatus ?? c.status;
                      const failed =
                        c.deliveryStatus === "failed" || c.status === "failed";
                      const badge = (
                        <Badge variant={statusVariant(status)}>
                          {t(
                            `broadcast.${c.status === "draft" ? "drafts" : status}`,
                          )}
                        </Badge>
                      );
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="max-w-80 ps-4">
                            <p className="truncate font-medium">{c.name}</p>
                            <p className="truncate text-muted-foreground">
                              {c.body}
                            </p>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {audienceName(c.audience)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                            {dateText(
                              c.nextAt ??
                                (["draft", "cancelled"].includes(c.status)
                                  ? null
                                  : c.createdAt),
                            )}
                          </TableCell>
                          <TableCell className="text-end tabular-nums">
                            {c.accepted > 0 ? (
                              c.accepted
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {failed ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">{badge}</span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-64">
                                  {t("broadcast.deliveryIssueHint")}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              badge
                            )}
                          </TableCell>
                          <TableCell className="pe-4 text-end whitespace-nowrap">
                            {c.status === "sent" ||
                            legacy.some((l) => l.id === c.id) ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => start(c, true)}
                              >
                                {t("broadcast.again")}
                              </Button>
                            ) : [
                                "draft",
                                "scheduled",
                                "repeating",
                                "failed",
                              ].includes(c.status) ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => start(c)}
                                >
                                  {t("broadcast.edit")}
                                </Button>
                                {c.status === "draft" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      start(c);
                                      setStep(2);
                                      setMode("now");
                                    }}
                                  >
                                    {t("broadcast.send")}
                                  </Button>
                                )}
                                <ConfirmAction
                                  title={t("broadcast.cancel")}
                                  description={c.name}
                                  actionLabel={t("broadcast.cancel")}
                                  trigger={
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={cancel.isPending}
                                    >
                                      {t("common.cancel")}
                                    </Button>
                                  }
                                  onConfirm={async () => {
                                    await cancel.mutateAsync(c.id);
                                  }}
                                />
                              </>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </Card>
          <ErrorAlert error={cancel.error} />
          <p className="text-xs text-muted-foreground">
            {t("broadcast.historyHint")}
          </p>
        </TabsContent>
        <TabsContent value="nearby" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>{t("broadcast.nearby")}</CardTitle>
                <Badge variant={nearby.data?.enabled ? "success" : "secondary"}>
                  {t(
                    nearby.data?.enabled
                      ? "broadcast.active"
                      : "broadcast.inactive",
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="max-w-2xl text-sm text-muted-foreground">
                {t("broadcast.nearbyHint")}
              </p>
              <p className="rounded-lg border bg-muted px-3 py-2 text-sm font-medium">
                {t("broadcast.nearbyQuota")}
              </p>
              <fieldset className="space-y-2">
                <legend className="font-medium">
                  {t("broadcast.branches")}
                </legend>
                <p className="text-sm text-muted-foreground">
                  {t("broadcast.branchesHint")}
                </p>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {eligible.map((b) => (
                    <label
                      key={b.id}
                      className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${selected.includes(b.id) ? "border-primary bg-primary/5" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={selected.includes(b.id)}
                        disabled={settings.isPending}
                        onChange={(e) =>
                          setBranchSelection(
                            e.target.checked
                              ? [...selected, b.id]
                              : selected.filter((id) => id !== b.id),
                          )
                        }
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          {b.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {b.address}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {!eligible.length && (
                  <p className="text-sm text-muted-foreground">
                    {t("broadcast.noBranches")}
                  </p>
                )}
                {selected.length > 10 && (
                  <p className="text-sm text-destructive">
                    {t("broadcast.tooManyBranches")}
                  </p>
                )}
              </fieldset>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={
                    !nearby.data ||
                    settings.isPending ||
                    !selected.length ||
                    selected.length > 10
                  }
                  onClick={() => settings.mutate(true)}
                >
                  {t(
                    nearby.data?.enabled
                      ? "broadcast.saveBranches"
                      : "broadcast.activate",
                  )}
                </Button>
                {nearby.data?.enabled && (
                  <Button
                    variant="outline"
                    disabled={settings.isPending}
                    onClick={() => settings.mutate(false)}
                  >
                    {t("broadcast.deactivate")}
                  </Button>
                )}
              </div>
              <ErrorAlert error={settings.error} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!save.isPending) {
            if (!v && autoEligible) void autosave.flush().catch(() => {});
            setOpen(v);
          }
        }}
      >
        <DialogContent className="flex max-h-[94dvh] flex-col overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="relative isolate overflow-hidden border-b p-5 pe-12">
            <BrandPattern name="paper-grid" fade="start" className="-z-10" />
            <DialogTitle>{t("broadcast.new")}</DialogTitle>
            <DialogDescription>{t("broadcast.subtitle")}</DialogDescription>
            {autoEligible && (name.trim() || body.trim()) && (
              <p role="status" className="text-xs text-muted-foreground">
                {t(
                  autosave.status === "error"
                    ? "broadcast.autosaveError"
                    : autosave.status === "saved"
                      ? "broadcast.autosaved"
                      : "broadcast.autosaving",
                )}
              </p>
            )}
          </DialogHeader>
          <div className="flex gap-2 border-b px-5 pb-4">
            {(["what", "who", "when"] as const).map((s, i) => (
              <Button
                key={s}
                className="flex-1"
                variant={i === step ? "default" : "ghost"}
                disabled={save.isPending || (i > 0 && !validContent)}
                onClick={() => setStep(i)}
              >
                {i + 1}. {t(`broadcast.${s}`)}
              </Button>
            ))}
          </div>
          <div className="grid gap-6 overflow-y-auto p-5 md:grid-cols-2">
            <div className="space-y-5">
              {step === 0 && (
                <>
                  <Field
                    htmlFor="campaign-name"
                    label={t("broadcast.name")}
                    hint={t("broadcast.nameHint")}
                  >
                    <Input
                      id="campaign-name"
                      maxLength={80}
                      value={name}
                      placeholder={t("broadcast.namePlaceholder")}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>
                  <Field
                    htmlFor="campaign-body"
                    label={t("broadcast.message")}
                    hint={t("broadcast.bodyHint", { name: merchantName })}
                  >
                    <Textarea
                      id="campaign-body"
                      rows={7}
                      maxLength={2000}
                      value={body}
                      placeholder={t("broadcast.bodyPlaceholder")}
                      onChange={(e) => setBody(e.target.value)}
                    />
                  </Field>
                  {hasMarkup && (
                    <p className="text-sm text-destructive">
                      {t("broadcast.noMarkup")}
                    </p>
                  )}
                </>
              )}
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <p className="font-medium">{t("broadcast.card")}</p>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-primary bg-primary/5 p-4">
                      <div>
                        <p className="font-semibold">{merchantName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t("broadcast.selected")}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {t("broadcast.cardCount", { count: 1, total: 1 })}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("broadcast.cardHint")}
                    </p>
                  </div>
                  <fieldset className="space-y-3">
                    <legend className="mb-3 font-medium">
                      {t("broadcast.audienceLabel")}
                    </legend>
                    <label className="flex items-center gap-3 rounded-xl border p-4">
                      <input
                        type="radio"
                        name="audience"
                        checked={audience === "all"}
                        onChange={() => setAudience("all")}
                      />
                      <span>
                        {t("broadcast.everyone")}
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {t("broadcast.customerCount", {
                            count: customers.data?.total ?? 0,
                          })}
                        </span>
                      </span>
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border p-4">
                      <input
                        type="radio"
                        name="audience"
                        checked={audience !== "all"}
                        onChange={() =>
                          setAudience(customers.data?.segments[0]?.key ?? "new")
                        }
                      />
                      <span>
                        {t("broadcast.segment")}
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {t("broadcast.segmentHint")}
                        </span>
                      </span>
                    </label>
                    {audience !== "all" && (
                      <Select value={audience} onValueChange={setAudience}>
                        <SelectTrigger
                          aria-label={t("broadcast.segment")}
                          className="h-10 w-full ps-3 pe-3"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.data?.segments.map((s) => (
                            <SelectItem key={s.key} value={s.key}>
                              {t(`customers.segments.${s.key}.label`)} (
                              {s.count})
                            </SelectItem>
                          ))}
                          {customers.data?.customSegments.map((s) => (
                            <SelectItem key={s.id} value={`custom:${s.id}`}>
                              {s.name} ({s.count})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </fieldset>
                </>
              )}
              {step === 2 && (
                <>
                  <fieldset className="space-y-3">
                    <legend className="mb-3 font-medium">
                      {t("broadcast.when")}
                    </legend>
                    {(["now", "schedule", "repeat"] as const).map((m) => (
                      <label
                        key={m}
                        className={`flex items-center gap-3 rounded-xl border p-4 ${mode === m ? "border-primary bg-primary/5" : ""}`}
                      >
                        <input
                          type="radio"
                          name="when"
                          checked={mode === m}
                          onChange={() => setMode(m)}
                        />
                        {t(`broadcast.${m}`)}
                      </label>
                    ))}
                  </fieldset>
                  {mode !== "now" && (
                    <>
                      <Field
                        htmlFor="campaign-date"
                        label={t("broadcast.date")}
                      >
                        <DatePicker
                          id="campaign-date"
                          label={t("broadcast.date")}
                          placeholder={t("broadcast.chooseDate")}
                          minDate={localDate(new Date().toISOString()).slice(
                            0,
                            10,
                          )}
                          value={nextAt.slice(0, 10)}
                          onChange={(date) =>
                            setNextAt(`${date}T${nextAt.slice(11) || "09:00"}`)
                          }
                        />
                      </Field>
                      <Field
                        htmlFor="campaign-time"
                        label={t("broadcast.sendTime")}
                      >
                        <TimePicker
                          id="campaign-time"
                          label={t("broadcast.sendTime")}
                          hoursLabel={t("broadcast.hours")}
                          minutesLabel={t("broadcast.minutes")}
                          value={nextAt.slice(11) || "09:00"}
                          onChange={(time) =>
                            setNextAt(
                              `${nextAt.slice(0, 10) || localDate(new Date().toISOString()).slice(0, 10)}T${time}`,
                            )
                          }
                        />
                      </Field>
                      <p className="text-xs text-muted-foreground">
                        {t("broadcast.timezone", {
                          zone: Intl.DateTimeFormat().resolvedOptions()
                            .timeZone,
                        })}
                      </p>
                      {!validTime && (
                        <p className="text-sm text-destructive">
                          {t("broadcast.future")}
                        </p>
                      )}
                    </>
                  )}
                  {mode === "repeat" && (
                    <Field
                      htmlFor="campaign-repeat"
                      label={t("broadcast.frequency")}
                    >
                      <Select
                        value={String(repeatDays)}
                        onValueChange={(value) => setRepeatDays(Number(value))}
                      >
                        <SelectTrigger
                          id="campaign-repeat"
                          className="h-10 w-full ps-3 pe-3"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">
                            {t("broadcast.daily")}
                          </SelectItem>
                          <SelectItem value="7">
                            {t("broadcast.weekly")}
                          </SelectItem>
                          <SelectItem value="30">
                            {t("broadcast.monthly")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                  {mode === "now" && quota.data?.remaining === 0 && (
                    <p className="text-sm text-destructive">
                      {t("broadcast.noQuota")}
                    </p>
                  )}
                </>
              )}
              <div
                className="rounded-lg bg-muted p-3 text-sm"
                aria-live="polite"
              >
                {preview.isFetching ? (
                  t("common.loading")
                ) : currentPreview ? (
                  <>
                    <p>
                      {t("broadcast.reach", {
                        count: currentPreview.matched,
                        linked: currentPreview.linked,
                      })}
                    </p>
                    {currentPreview.unavailable > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("broadcast.unavailable", {
                          count: currentPreview.unavailable,
                        })}
                      </p>
                    )}
                  </>
                ) : null}
              </div>
              {currentPreview && !currentPreview.configured && (
                <p className="text-sm text-destructive">
                  {t("messages.notConfigured")}
                </p>
              )}
              <ErrorAlert error={preview.error || save.error} />
            </div>
            <div className="self-start rounded-xl border bg-muted/50 p-4">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">{t("broadcast.preview")}</h3>
                <div className="w-full sm:w-auto sm:min-w-64">
                  <Segmented
                    label={t("broadcast.preview")}
                    value={wallet}
                    onChange={setWallet}
                    options={[
                      { value: "apple", label: t("broadcast.appleWallet") },
                      { value: "google", label: t("broadcast.googleWallet") },
                    ]}
                  />
                </div>
              </div>
              {wallet === "apple" ? (
                <div className="rounded-3xl bg-sidebar p-5 text-sidebar-foreground">
                  <p className="text-center text-xs opacity-70">
                    {new Date().toLocaleDateString(localeOf(), {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                  <p
                    className="mb-6 mt-1 text-center text-5xl font-light"
                    dir="ltr"
                  >
                    {new Date().toLocaleTimeString(localeOf(), {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </p>
                  <div className="flex gap-3 rounded-2xl border border-sidebar-foreground/20 bg-sidebar-foreground/15 p-3">
                    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground">
                      {profile.data?.logoUrl ? (
                        <img
                          src={profile.data.logoUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        merchantName.slice(0, 1)
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{merchantName}</p>
                      <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-sm">
                        {body || t("broadcast.previewBody")}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl bg-primary p-5 text-primary-foreground">
                  <p className="font-medium">{merchantName}</p>
                  <p className="my-5 text-2xl font-semibold">
                    {t("broadcast.loyalty")}
                  </p>
                  <div className="rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 p-4">
                    <p className="text-xs uppercase tracking-widest opacity-70">
                      {t("broadcast.message")}
                    </p>
                    <p className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-sm">
                      {body || t("broadcast.previewBody")}
                    </p>
                  </div>
                </div>
              )}
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                {t(
                  wallet === "apple"
                    ? "broadcast.appleHint"
                    : "broadcast.googleHint",
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 p-5">
            <Button
              variant="outline"
              disabled={(!name.trim() && !body.trim()) || save.isPending}
              onClick={() => save.mutate("draft")}
            >
              {t("broadcast.draft")}
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button
                  variant="ghost"
                  disabled={save.isPending}
                  onClick={() => setStep(step - 1)}
                >
                  {t("broadcast.back")}
                </Button>
              )}
              {step < 2 ? (
                <Button
                  disabled={!validContent || save.isPending}
                  onClick={() => setStep(step + 1)}
                >
                  {t("broadcast.next")}
                </Button>
              ) : (
                <ConfirmAction
                  title={t("broadcast.confirm")}
                  variant="default"
                  description={
                    <div className="space-y-3">
                      <p className="whitespace-pre-wrap break-words">{body}</p>
                      <p>
                        {t("broadcast.confirmText", {
                          count: currentPreview?.linked ?? 0,
                        })}
                      </p>
                      <p>
                        {mode === "now" ? t("broadcast.now") : dateText(nextAt)}
                      </p>
                    </div>
                  }
                  actionLabel={action}
                  trigger={<Button variant="brand" disabled={!canSend}>{action}</Button>}
                  onConfirm={async () => {
                    await save.mutateAsync(mode);
                  }}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Small heading of a summary column, with its fine print in an info tooltip. */
function SummaryLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {children}
      {hint ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="-m-1 inline-flex size-6 items-center justify-center rounded-full hover:text-foreground"
              aria-label={hint}
            >
              <InfoCircle className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-72">{hint}</TooltipContent>
        </Tooltip>
      ) : null}
    </p>
  );
}
