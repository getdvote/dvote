import { ChartColumn, LayoutDashboard, LogOut, Server, Store, Users } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
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
                {nav.map((n) => (
                  <SidebarMenuItem key={n.to}>
                    <SidebarMenuButton asChild isActive={isActive(n.to)} size="lg" className="h-10 font-medium">
                      <NavLink to={n.to}>
                        <n.icon />
                        <span>{n.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
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
