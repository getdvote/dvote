import { WORKSPACE_PAGES } from '../lib/workspace-pages';
import { useContentMotion } from '../hooks/use-content-motion';
import {
  WidgetIcon as LayoutDashboardActive,
  ShopIcon as StoreActive,
  UsersGroupRoundedIcon as UsersActive,
  ChartIcon as ChartColumnActive,
  ChatRoundLikeIcon as FeedbackActive,
  ServerIcon as ServerActive,
  ScannerIcon as ScannerActive,
  MapPointIcon as MapPinActive,
  CardIcon as CardActive,
  GiftIcon as GiftActive,
  SmartphoneVibrationIcon as BroadcastActive,
  BillListIcon as ActivityActive,
  SettingsIcon as SettingsActive,
  BoxIcon as KitActive,
} from '@solar-icons/react/bold-duotone';
import {
  ArrowRightUpIcon as ArrowUpRight,
  ChartIcon as ChartColumn,
  ChatRoundLikeIcon as FeedbackIcon,
  ChevronsUpDownIcon as ChevronsUpDown,
  GlobeIcon,
  WidgetIcon as LayoutDashboard,
  LogoutIcon as LogOut,
  ServerIcon as Server,
  ScannerIcon as Scanner,
  MapPointIcon as MapPin,
  CardIcon as Card,
  GiftIcon as Gift,
  SmartphoneVibrationIcon as Broadcast,
  BillListIcon as Activity,
  SettingsIcon as Settings,
  BoxIcon as Kit,
  ShopIcon as Store,
  Sun2Icon as SunMoon,
  MenuDotsIcon as More,
  UsersGroupRoundedIcon as Users,
} from '@solar-icons/react/linear';
import { Fragment, useState, useRef, type ComponentType, type ReactNode } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { NavLink, useLocation } from 'react-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ConfirmAction } from '../components/ConfirmAction';
import { DvoteLogo } from '../components/DvoteLogo';
import { initial } from '../components/PageHeader';
import { ThemeSwitch } from '../components/ThemeToggle';
import { LanguageSwitch } from '../components/LanguageToggle';
import { t, useEnglishOnly, useI18n } from '../i18n';
import { useAuth } from '../lib/auth';
import { LockKeyholeMinimalisticIcon } from '@solar-icons/react/linear';

function NavIcon({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = active ? (item.activeIcon ?? item.icon) : item.icon;
  return <Icon />;
}

export interface NavItem {
  to: string;
  icon: ComponentType;
  activeIcon?: ComponentType;
  label: string;
  /** A main tab of the phone bottom bar (the first four); everything else goes under More. */
  tab?: boolean;
  /** Section heading; items with the same group sit together under it (none = top section). */
  group?: string;
  /** A small button at the end of the row (e.g. preview), hidden when the sidebar is collapsed. */
  /** Not in the merchant's plan: a small lock after the label (the page explains and links to Billing). */
  locked?: boolean;
  action?: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
  };
}

/** Merchant sections mirror the merchant dashboard; platform tools have their own group. */
function workspaceNav(section: string, icon: ComponentType, activeIcon: ComponentType, group?: string): NavItem {
  return { to: `/${section}`, label: WORKSPACE_PAGES.find(page => page.section === section)!.label, icon, activeIcon, group };
}

const NAV: NavItem[] = [
  { to: '/', icon: LayoutDashboard, activeIcon: LayoutDashboardActive, label: 'Overview', tab: true },
  workspaceNav('scan', Scanner, ScannerActive),

  { to: '/merchants', icon: Store, activeIcon: StoreActive, label: 'Merchants', group: 'Management', tab: true },
  workspaceNav('merchant-home', LayoutDashboard, LayoutDashboardActive, 'Management'),
  workspaceNav('storefront', Store, StoreActive, 'Management'),
  workspaceNav('branches', MapPin, MapPinActive, 'Management'),
  workspaceNav('customer-feedback', FeedbackIcon, FeedbackActive, 'Management'),
  workspaceNav('team', Users, UsersActive, 'Management'),
  workspaceNav('settings', Settings, SettingsActive, 'Management'),
  workspaceNav('kit', Kit, KitActive, 'Management'),

  workspaceNav('card', Card, CardActive, 'Loyalty'),
  workspaceNav('rewards', Gift, GiftActive, 'Loyalty'),
  workspaceNav('redemptions', Activity, ActivityActive, 'Loyalty'),
  workspaceNav('broadcast', Broadcast, BroadcastActive, 'Loyalty'),

  workspaceNav('insights', ChartColumn, ChartColumnActive, 'Workspace'),
  { to: '/customers', icon: Users, activeIcon: UsersActive, label: 'Customers', group: 'Workspace', tab: true },
  workspaceNav('members', Users, UsersActive, 'Workspace'),
  workspaceNav('activity', Activity, ActivityActive, 'Workspace'),
  { to: '/statistics', icon: ChartColumn, activeIcon: ChartColumnActive, label: 'Statistics', group: 'Workspace' },

  { to: '/feedback', icon: FeedbackIcon, activeIcon: FeedbackActive, label: 'Merchant support', group: 'Platform' },
  workspaceNav('audit', Activity, ActivityActive, 'Platform'),
  { to: '/system', icon: Server, activeIcon: ServerActive, label: 'System', group: 'Platform', tab: true },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  useEnglishOnly();
  const { admin } = useAuth();
  return (
    <SideLayout nav={NAV} badge="ADMIN" identity={{ name: admin?.name ?? '', subtitle: admin?.email ?? '' }}>
      {children}
    </SideLayout>
  );
}

/** Nav items split into sections by `group`, keeping their order (the first section has no heading). */
function sections(nav: NavItem[]) {
  const out: { group?: string; items: NavItem[] }[] = [];
  for (const n of nav) {
    const s = out.find((x) => x.group === n.group);
    if (s) s.items.push(n);
    else out.push({ group: n.group, items: [n] });
  }
  return out;
}

/** One section of the sidebar: a small uppercase heading (if any) over its pages. */
function NavSection({ group, items, isActive }: { group?: string; items: NavItem[]; isActive: (to: string) => boolean }) {
  return (
    <SidebarGroup className="py-1">
      {group ? <SidebarGroupLabel className="h-7 px-3 text-xs font-medium text-muted-foreground">{group}</SidebarGroupLabel> : null}
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((n) => (
            <SidebarMenuItem key={n.to}>
              <SidebarMenuButton
                asChild
                isActive={isActive(n.to)}
                tooltip={n.label}
                className="relative h-9 gap-3 px-3 font-medium data-active:bg-transparent data-[active=true]:text-sidebar-primary-foreground data-[active=true]:hover:text-sidebar-primary-foreground [&_svg]:size-[18px] [&>*:not([data-pill])]:relative"
              >
                <NavLink to={n.to}>
                  {/* the highlight glides from the old page to the new one */}
                  {isActive(n.to) ? (
                    <motion.span
                      data-pill
                      layoutId="nav-active"
                      transition={{
                        type: 'spring',
                        bounce: 0.15,
                        duration: 0.35,
                      }}
                      className="absolute inset-0 rounded-md bg-sidebar-primary"
                    />
                  ) : null}
                  <NavIcon item={n} active={isActive(n.to)} />
                  <span data-nav-label>{n.label}</span>
                  {n.locked ? <LockKeyholeMinimalisticIcon data-nav-label className="ms-auto size-3.5 opacity-60" aria-label={t('planLock.locked')} /> : null}
                </NavLink>
              </SidebarMenuButton>
              {n.action ? (
                <SidebarMenuAction
                  title={n.action.label}
                  aria-label={n.action.label}
                  onClick={n.action.onClick}
                  className="top-1.5 end-1.5 size-6 w-6 text-muted-foreground hover:text-foreground peer-data-[active=true]/menu-button:text-sidebar-primary-foreground"
                >
                  <n.action.icon />
                </SidebarMenuAction>
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/**
 * Stone canvas with the sidebar on it, the page on a white panel beside it. The sidebar: the dvote
 * logo at the top, the pages in headed sections, and at the bottom whose dashboard this is (it
 * opens the profile menu upwards: account pages, links, language, theme, sign out). It never collapses on a computer; on a phone it
 * slides in from the menu button in the top bar.
 */
export function SideLayout({
  nav,
  accountNav,
  badge,
  identity,
  menuLinks,
  overlays,
  languageSwitch,
  children,
}: {
  nav: NavItem[];
  /** Pages in the profile menu (e.g. team, settings). */
  accountNav?: NavItem[];
  /** Dashboard role badge (e.g. ADMIN). */
  badge?: string;
  /** The top of the sidebar: whose dashboard this is. */
  identity: {
    name: string;
    subtitle: string;
    imageUrl?: string | null;
    extra?: ReactNode;
  };
  /** More rows in the account menu, after the account pages (e.g. storefront preview, get help). */
  menuLinks?: MenuLink[];
  /** Rendered beside the layout (e.g. dialogs those menu rows open). */
  overlays?: ReactNode;
  /** Show the English / Arabic switch (merchant pages are translated; admin pages are English). */
  languageSwitch?: boolean;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  useContentMotion(contentRef);
  const { rtl } = useI18n();
  const { pathname } = useLocation();
  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  return (
    // collapses to icons on a computer (button or Cmd/Ctrl+B, remembered); the phone menu slides in
    // motion follows the computer's "reduce motion" setting
    <MotionConfig reducedMotion="user">
      <SidebarProvider className="h-dvh min-h-0 overflow-hidden bg-sidebar">
        {/* `dark`: the sidebar always uses the dark tokens, whatever the theme */}
        <Sidebar side={rtl ? 'right' : 'left'} variant="inset" collapsible="icon" className="dark">
          <SidebarHeader className="flex-row items-center gap-2 px-4 pt-4 pb-3 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0">
            <DvoteLogo spinOnHover height={24} className="text-foreground group-data-[collapsible=icon]:hidden" />
            <DvoteLogo spinOnHover height={26} wordmark={false} className="hidden text-foreground group-data-[collapsible=icon]:block" />
            {badge ? (
              <Badge variant="brand" className="font-bold tracking-wide group-data-[collapsible=icon]:hidden">
                {badge}
              </Badge>
            ) : null}
            <CollapseButton rtl={rtl} />
          </SidebarHeader>
          <SidebarContent className="gap-2 px-1 group-data-[collapsible=icon]:px-0">
            {sections(nav).map((sec, i) => (
              <Fragment key={sec.group ?? ''}>
                {/* dotted line between sections */}
                {i > 0 ? <div className="mx-3 border-t-2 border-dotted border-border group-data-[collapsible=icon]:mx-2" aria-hidden /> : null}
                <NavSection group={sec.group} items={sec.items} isActive={isActive} />
              </Fragment>
            ))}
          </SidebarContent>
          <SidebarFooter className="gap-2 px-2 pb-3">
            <ProfileMenu
              identity={identity}
              accountNav={accountNav}
              menuLinks={menuLinks}
              badge={badge}
              languageSwitch={languageSwitch}
              isActive={isActive}
            />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="min-h-0 min-w-0 overflow-hidden bg-transparent md:border md:bg-card md:shadow-xs">
          <MobileHeader
            identity={identity}
            accountNav={accountNav}
            menuLinks={menuLinks}
            badge={badge}
            languageSwitch={languageSwitch}
            isActive={isActive}
          />
          {/* phones: the white page sits in the dark frame with rounded top corners */}
          <div
            ref={contentRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-card motion-safe:scroll-smooth max-md:rounded-t-2xl max-md:pt-5 md:bg-transparent"
          >
            <div className="mx-auto w-full max-w-7xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pt-8 md:pb-12">
              {/* each page settles in: a short fade and rise when it opens */}
              <motion.div
                data-page-content
                key={pathname.split('/')[1]}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                {children}
              </motion.div>
            </div>
          </div>
        </SidebarInset>
        <BottomNav nav={nav} isActive={isActive} />
        {overlays}
      </SidebarProvider>
    </MotionConfig>
  );
}

/** The collapse / expand button by the logo, with a hover label saying which it will do. */
function CollapseButton({ rtl }: { rtl: boolean }) {
  const { state } = useSidebar();
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <SidebarTrigger
          data-expanded={state === 'expanded'}
          className="sidebar-collapse-toggle ms-auto hidden text-muted-foreground md:inline-flex group-data-[collapsible=icon]:ms-0 rtl:rotate-180"
        />
      </TooltipTrigger>
      <TooltipContent side={rtl ? 'left' : 'right'} className="gap-2">
        {state === 'expanded' ? t('nav.collapse') : t('nav.expand')}
        <kbd dir="ltr" className="rounded bg-background/15 px-1 font-sans text-[10px]">
          {mac ? '⌘B' : 'Ctrl+B'}
        </kbd>
      </TooltipContent>
    </Tooltip>
  );
}

function IdentityRow({
  identity,
}: {
  identity: {
    name: string;
    subtitle: string;
    imageUrl?: string | null;
    extra?: ReactNode;
  };
}) {
  return (
    <>
      <Avatar className="size-10 rounded-lg after:rounded-lg">
        {identity.imageUrl ? <AvatarImage src={identity.imageUrl} alt="" className="rounded-lg" /> : null}
        <AvatarFallback className="rounded-lg bg-secondary font-semibold text-accent-foreground">{initial(identity.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-start group-data-[collapsible=icon]:hidden">
        <div className="truncate text-sm font-semibold">{identity.name}</div>
        <div className="truncate text-xs text-muted-foreground">{identity.subtitle}</div>
        {identity.extra}
      </div>
    </>
  );
}

/** The card at the top of the sidebar, and the menu it opens. */
/** A row of the account menu that isn't a page: an outside link (arrow), or an action. */
export interface MenuLink {
  icon: ComponentType;
  label: string;
  /** Opens in a new tab ("#" = not live yet: does nothing). */
  href?: string;
  onSelect?: () => void;
}

function ProfileMenu({
  identity,
  accountNav,
  menuLinks,
  badge,
  languageSwitch,
  isActive,
}: {
  identity: {
    name: string;
    subtitle: string;
    imageUrl?: string | null;
    extra?: ReactNode;
  };
  accountNav?: NavItem[];
  menuLinks?: MenuLink[];
  badge?: string;
  languageSwitch?: boolean;
  isActive: (to: string) => boolean;
}) {
  const { signOut } = useAuth();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl border bg-card p-2.5 shadow-xs transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-[state=open]:bg-muted/60 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none"
          >
            <IdentityRow identity={identity} />
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          sideOffset={6}
          className="w-(--radix-dropdown-menu-trigger-width) min-w-64 overflow-hidden rounded-xl p-0"
        >
          <div className="flex items-center gap-3 border-b p-3">
            <IdentityRow identity={{ ...identity, extra: null }} />
          </div>
          <div className="grid gap-0.5 p-1.5">
            {accountNav?.map((n) => (
              <DropdownMenuItem key={n.to} asChild className={cn('h-9 gap-2.5 px-2.5', isActive(n.to) && 'bg-accent')}>
                <NavLink to={n.to}>
                  <NavIcon item={n} active={isActive(n.to)} />
                  {n.label}
                </NavLink>
              </DropdownMenuItem>
            ))}
            {menuLinks?.map((l) =>
              l.href ? (
                <DropdownMenuItem key={l.label} asChild className="h-9 gap-2.5 px-2.5">
                  <a href={l.href} target="_blank" rel="noreferrer" onClick={(e) => l.href === '#' && e.preventDefault()}>
                    <l.icon />
                    <span className="flex-1">{l.label}</span>
                    <ArrowUpRight className="rtl:-scale-x-100" />
                  </a>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem key={l.label} className="h-9 gap-2.5 px-2.5" onSelect={l.onSelect}>
                  <l.icon />
                  {l.label}
                </DropdownMenuItem>
              ),
            )}
            {languageSwitch ? (
              <div className="flex h-10 items-center justify-between gap-2 px-2.5 text-sm">
                <span className="flex items-center gap-2.5">
                  <GlobeIcon className="size-4 text-muted-foreground" />
                  {t('common.language')}
                </span>
                <LanguageSwitch />
              </div>
            ) : null}
            <div className="flex h-10 items-center justify-between gap-2 px-2.5 text-sm">
              <span className="flex items-center gap-2.5">
                <SunMoon className="size-4 text-muted-foreground" />
                {t('common.theme')}
              </span>
              <ThemeSwitch />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="h-9 gap-2.5 px-2.5" onSelect={() => setConfirmSignOut(true)}>
              <LogOut className="rtl:rotate-180" />
              {t('common.signOut')}
            </DropdownMenuItem>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t bg-muted/50 px-3 py-2.5">
            <span className="text-xs text-muted-foreground">{t('common.madeInAlexandria')}</span>
            {badge ? (
              <Badge variant="brand" className="font-bold tracking-wide">
                {badge}
              </Badge>
            ) : null}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmAction
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title={t('common.signOutTitle')}
        description={t('common.signOutText', { email: identity.subtitle })}
        actionLabel={t('common.signOut')}
        onConfirm={signOut}
      />
    </>
  );
}

type Identity = { name: string; subtitle: string; imageUrl?: string | null; extra?: ReactNode };

const sheetRow =
  'flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-muted [&_svg]:size-5';

/** A bottom sheet with a grab handle; closes when one of its links is followed. */
function PhoneSheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)] md:hidden">
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <SheetDescription className="sr-only">{title}</SheetDescription>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" aria-hidden />
        {children}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Phones only: the dark band at the top, part of the dark frame the white page sits in. The dvote
 * logo on one side, the account toggle on the other; the toggle opens the account sheet (account
 * pages, links, language, theme, sign out).
 */
function MobileHeader({
  identity,
  accountNav,
  menuLinks,
  badge,
  languageSwitch,
  isActive,
}: {
  identity: Identity;
  accountNav?: NavItem[];
  menuLinks?: MenuLink[];
  badge?: string;
  languageSwitch?: boolean;
  isActive: (to: string) => boolean;
}) {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  return (
    <>
      <header className="dark flex h-16 shrink-0 items-center justify-between gap-3 px-4 text-foreground md:hidden">
        <DvoteLogo height={24} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={identity.name}
          className="flex min-w-0 items-center gap-2 rounded-full border bg-card/60 py-1 ps-1 pe-2.5 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Avatar className="size-8 rounded-full after:rounded-full">
            {identity.imageUrl ? <AvatarImage src={identity.imageUrl} alt="" className="rounded-full" /> : null}
            <AvatarFallback className="rounded-full bg-secondary text-sm font-semibold text-accent-foreground">{initial(identity.name)}</AvatarFallback>
          </Avatar>
          <span className="max-w-32 truncate text-sm font-semibold">{identity.name}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </header>

      <PhoneSheet open={open} onOpenChange={setOpen} title={identity.name}>
        <div className="flex items-center gap-3 border-b px-4 py-4">
          <IdentityRow identity={identity} />
          {badge ? (
            <Badge variant="brand" className="font-bold tracking-wide">
              {badge}
            </Badge>
          ) : null}
        </div>
        <div className="grid gap-3 px-2 py-3">
          {accountNav?.length || menuLinks?.length ? (
            <div>
              {accountNav?.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={cn(sheetRow, isActive(n.to) && 'bg-muted')}
                  aria-current={isActive(n.to) ? 'page' : undefined}
                >
                  <NavIcon item={n} active={isActive(n.to)} />
                  {n.label}
                </NavLink>
              ))}
              {menuLinks?.map((l) =>
                l.href ? (
                  <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className={sheetRow} onClick={(e) => l.href === '#' && e.preventDefault()}>
                    <l.icon />
                    <span className="flex-1">{l.label}</span>
                    <ArrowUpRight className="text-muted-foreground rtl:-scale-x-100" />
                  </a>
                ) : (
                  <button
                    key={l.label}
                    type="button"
                    className={sheetRow}
                    onClick={() => {
                      setOpen(false);
                      l.onSelect?.();
                    }}
                  >
                    <l.icon />
                    {l.label}
                  </button>
                ),
              )}
            </div>
          ) : null}
          <div className="grid border-t pt-3">
            {languageSwitch ? (
              <div className="flex h-11 items-center justify-between gap-2 px-3 text-sm font-medium">
                <span className="flex items-center gap-3">
                  <GlobeIcon className="size-5 text-muted-foreground" />
                  {t('common.language')}
                </span>
                <LanguageSwitch />
              </div>
            ) : null}
            <div className="flex h-11 items-center justify-between gap-2 px-3 text-sm font-medium">
              <span className="flex items-center gap-3">
                <SunMoon className="size-5 text-muted-foreground" />
                {t('common.theme')}
              </span>
              <ThemeSwitch />
            </div>
            <button type="button" className={cn(sheetRow, 'text-destructive')} onClick={() => setConfirmSignOut(true)}>
              <LogOut className="rtl:rotate-180" />
              {t('common.signOut')}
            </button>
          </div>
        </div>
        <p className="border-t bg-muted/50 px-4 py-3 text-xs text-muted-foreground">{t('common.madeInAlexandria')}</p>
      </PhoneSheet>
      <ConfirmAction
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title={t('common.signOutTitle')}
        description={t('common.signOutText', { email: identity.subtitle })}
        actionLabel={t('common.signOut')}
        onConfirm={signOut}
      />
    </>
  );
}

/**
 * Phones only: the app-style bar at the bottom. Up to four main tabs (nav items with `tab`), then
 * More, a bottom sheet with every other page in its sections. Replaces the sidebar on small screens.
 */
function BottomNav({ nav, isActive }: { nav: NavItem[]; isActive: (to: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const tabs = nav.filter((n) => n.tab).slice(0, 4);
  const rest = nav.filter((n) => !tabs.includes(n));
  const moreActive = rest.some((n) => isActive(n.to));
  const tabClass =
    'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors data-[active=true]:text-foreground [&_svg]:relative [&_svg]:size-[22px]';
  const pill = (
    <motion.span
      layoutId="tab-active"
      transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
      className="absolute top-1.5 h-8 w-14 rounded-full bg-muted"
      aria-hidden
    />
  );

  return (
    <>
      <nav
        data-bottom-nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {tabs.map((n) => {
          const active = isActive(n.to) && !open;
          return (
            <NavLink key={n.to} to={n.to} data-active={active} className={tabClass} aria-current={active ? 'page' : undefined}>
              {active ? pill : null}
              <NavIcon item={n} active={active} />
              <span className="relative max-w-full truncate px-1">{n.label}</span>
            </NavLink>
          );
        })}
        {rest.length ? (
          <button type="button" data-active={moreActive || open} className={tabClass} onClick={() => setOpen(true)} aria-haspopup="dialog">
            {moreActive || open ? pill : null}
            <More />
            <span className="relative">{t('nav.more')}</span>
          </button>
        ) : null}
      </nav>

      <PhoneSheet open={open} onOpenChange={setOpen} title={t('nav.more')}>
        <div className="grid gap-4 px-2 pt-3 pb-4">
          {sections(rest).map((sec) => (
            <div key={sec.group ?? ''}>
              {sec.group ? <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{sec.group}</p> : null}
              {sec.items.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={cn(sheetRow, isActive(n.to) && 'bg-muted')}
                  aria-current={isActive(n.to) ? 'page' : undefined}
                >
                  <NavIcon item={n} active={isActive(n.to)} />
                  {n.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      </PhoneSheet>
    </>
  );
}
