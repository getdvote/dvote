import { useContentMotion } from '../hooks/use-content-motion';
import { WidgetIcon as LayoutDashboardActive, ShopIcon as StoreActive, UsersGroupRoundedIcon as UsersActive, ChartIcon as ChartColumnActive, ServerIcon as ServerActive } from '@solar-icons/react/bold-duotone';
import { ArrowRightUpIcon as ArrowUpRight, ChartIcon as ChartColumn, ChevronsUpDownIcon as ChevronsUpDown, GlobeIcon, WidgetIcon as LayoutDashboard, LogoutIcon as LogOut, ServerIcon as Server, ShopIcon as Store, Sun2Icon as SunMoon, UsersGroupRoundedIcon as Users } from '@solar-icons/react/linear';
import { Fragment, useState, useRef, type ComponentType, type ReactNode } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { NavLink, useLocation } from 'react-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

function NavIcon({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = active ? (item.activeIcon ?? item.icon) : item.icon;
  return <Icon />;
}

export interface NavItem {
  to: string;
  icon: ComponentType;
  activeIcon?: ComponentType;
  label: string;
  /** Section heading; items with the same group sit together under it (none = top section). */
  group?: string;
  /** A small button at the end of the row (e.g. preview), hidden when the sidebar is collapsed. */
  action?: { icon: ComponentType<{ className?: string }>; label: string; onClick: () => void };
}

const NAV: NavItem[] = [
  { to: '/', icon: LayoutDashboard, activeIcon: LayoutDashboardActive, label: 'Overview' },
  { to: '/merchants', icon: Store, activeIcon: StoreActive, label: 'Merchants' },
  { to: '/customers', icon: Users, activeIcon: UsersActive, label: 'Customers' },
  { to: '/statistics', icon: ChartColumn, activeIcon: ChartColumnActive, label: 'Statistics' },
  { to: '/system', icon: Server, activeIcon: ServerActive, label: 'System' },
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
                className={cn(
                  'relative h-9 gap-3 px-3 font-medium data-active:bg-transparent [&_svg]:size-[18px] [&>*:not([data-pill])]:relative',
                  n.action && 'pe-10',
                )}
              >
                <NavLink to={n.to}>
                  {/* the highlight glides from the old page to the new one */}
                  {isActive(n.to) ? (
                    <motion.span
                      data-pill
                      layoutId="nav-active"
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                      className="absolute inset-0 rounded-md bg-sidebar-accent"
                    />
                  ) : null}
                  <NavIcon item={n} active={isActive(n.to)} />
                  <span data-nav-label>{n.label}</span>
                </NavLink>
              </SidebarMenuButton>
              {n.action ? (
                <SidebarMenuAction
                  title={n.action.label}
                  aria-label={n.action.label}
                  onClick={n.action.onClick}
                  className="top-1.5 right-1.5 size-6 w-6 text-muted-foreground hover:text-foreground rtl:right-auto rtl:left-1.5"
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
  identity: { name: string; subtitle: string; imageUrl?: string | null; extra?: ReactNode };
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
      <SidebarProvider className="h-dvh min-h-0 overflow-hidden">
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
            <ProfileMenu identity={identity} accountNav={accountNav} menuLinks={menuLinks} badge={badge} languageSwitch={languageSwitch} isActive={isActive} />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="min-h-0 min-w-0 overflow-hidden bg-card md:border md:shadow-xs">
          {/* phones only: the menu button that slides the sidebar in */}
          <header className="flex h-14 shrink-0 items-center gap-3 px-4 md:hidden">
            <SidebarTrigger />
            <DvoteLogo height={22} className="text-foreground" />
          </header>
          <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain motion-safe:scroll-smooth">
          <div className="mx-auto w-full max-w-7xl px-4 pb-12 md:px-8 md:pt-8">
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
        <SidebarTrigger data-expanded={state === 'expanded'} className="sidebar-collapse-toggle ms-auto hidden text-muted-foreground md:inline-flex group-data-[collapsible=icon]:ms-0 rtl:rotate-180" />
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

function IdentityRow({ identity }: { identity: { name: string; subtitle: string; imageUrl?: string | null; extra?: ReactNode } }) {
  return (
    <>
      <Avatar className="size-10 rounded-lg after:rounded-lg">
        {identity.imageUrl ? <AvatarImage src={identity.imageUrl} alt="" className="rounded-lg" /> : null}
        <AvatarFallback className="rounded-lg bg-brand-soft font-semibold text-accent-foreground">{initial(identity.name)}</AvatarFallback>
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
  identity: { name: string; subtitle: string; imageUrl?: string | null; extra?: ReactNode };
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
