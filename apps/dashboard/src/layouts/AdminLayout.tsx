import { ChartColumn, ChevronRight, LayoutDashboard, LogOut, Server, Store, Users } from 'lucide-react';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DvoteLogo } from '../components/DvoteLogo';
import { initial } from '../components/PageHeader';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageToggle } from '../components/LanguageToggle';
import { t, useEnglishOnly, useI18n } from '../i18n';
import { useAuth } from '../lib/auth';

export interface NavItem {
  to: string;
  icon: ComponentType;
  label: string;
  /** Section heading; items with the same group sit together under it (none = top section). */
  group?: string;
}

const NAV: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/merchants', icon: Store, label: 'Merchants' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/statistics', icon: ChartColumn, label: 'Statistics' },
  { to: '/system', icon: Server, label: 'System' },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  useEnglishOnly();
  const { admin } = useAuth();
  return (
    <SideLayout nav={NAV} badge="ADMIN" person={{ name: admin?.name ?? '', email: admin?.email ?? '' }}>
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

/**
 * One entry of the sidebar tree: a page, or a branch (`group`) that opens and closes like a
 * folder when clicked (▶ closed, ▼ open), its pages indented under it on a guide line. A branch
 * opens by itself when one of its pages is shown, and remembers open/closed in this browser.
 */
function NavBranch({ group, items, isActive }: { group: string; items: NavItem[]; isActive: (to: string) => boolean }) {
  const holdsCurrent = items.some((n) => isActive(n.to));
  const key = `dvote-nav-open:${items[0].to}`;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== '0';
    } catch {
      return true;
    }
  });
  // landing on one of its pages (link, back button) opens the branch
  useEffect(() => {
    if (holdsCurrent) setOpen(true);
  }, [holdsCurrent]);
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(key, o ? '0' : '1');
      } catch {
        // private mode: just not remembered
      }
      return !o;
    });
  };
  const id = `nav-${key.replace(/W/g, '')}`;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton size='lg' className='h-10 font-medium' onClick={toggle} aria-expanded={open} aria-controls={id} isActive={!open && holdsCurrent}>
        <ChevronRight className={`text-primary transition-transform duration-200 ${open ? 'rotate-90' : 'rtl:rotate-180'}`} />
        <span>{group}</span>
      </SidebarMenuButton>
      <SidebarMenuSub id={id} hidden={!open} className='ms-5 me-0 translate-x-0 gap-0.5 border-s border-l-0 ps-2 pe-0 rtl:border-r-0'>
        {items.map((n) => (
          <SidebarMenuSubItem key={n.to}>
            <SidebarMenuSubButton asChild isActive={isActive(n.to)} className='h-9 translate-x-0 font-medium'>
              <NavLink to={n.to}>
                <n.icon />
                <span>{n.label}</span>
              </NavLink>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        ))}
      </SidebarMenuSub>
    </SidebarMenuItem>
  );
}

/** Sidebar (logo, sections, signed-in person) + a top bar (menu button, theme) above the page. */
export function SideLayout({
  nav,
  badge,
  top,
  headerExtra,
  person,
  languageSwitch,
  children,
}: {
  nav: NavItem[];
  badge: string;
  /** Extra buttons in the top bar, before the theme switch. */
  headerExtra?: ReactNode;
  /** Shown under the logo (e.g. the vendor's logo and name). */
  top?: ReactNode;
  person: { name: string; email: string };
  /** Show the English / Arabic switch (merchant pages are translated; admin pages are English). */
  languageSwitch?: boolean;
  children: ReactNode;
}) {
  const { signOut } = useAuth();
  const { rtl } = useI18n();
  const { pathname } = useLocation();
  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  return (
    <SidebarProvider>
      <Sidebar side={rtl ? 'right' : 'left'}>
        <SidebarHeader className="px-4 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <DvoteLogo height={30} className="text-primary" />
            <Badge variant="brand" className="font-bold tracking-wide">
              {badge}
            </Badge>
          </div>
          {top}
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {sections(nav).map((sec) =>
                  sec.group ? (
                    <NavBranch key={sec.group} group={sec.group} items={sec.items} isActive={isActive} />
                  ) : (
                    sec.items.map((n) => (
                      <SidebarMenuItem key={n.to}>
                        <SidebarMenuButton asChild isActive={isActive(n.to)} size="lg" className="h-10 font-medium">
                          <NavLink to={n.to}>
                            <n.icon />
                            <span>{n.label}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  ),
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-3">
          <Separator className="mb-2" />
          <div className="flex items-center gap-2.5 px-1">
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary font-semibold text-primary-foreground">{initial(person.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{person.name}</div>
              <div className="truncate text-xs text-muted-foreground">{person.email}</div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('common.signOut')} onClick={() => void signOut()}>
                  <LogOut className="rtl:rotate-180" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('common.signOut')}</TooltipContent>
            </Tooltip>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-background">
        <header className="flex h-14 items-center gap-2 px-4 md:px-8">
          <SidebarTrigger />
          <div className="flex-1" />
          {headerExtra}
          {languageSwitch ? <LanguageToggle /> : null}
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 pb-12 md:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
