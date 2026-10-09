import { LayoutDashboard, LogOut, Store, Users } from 'lucide-react';
import type { ReactNode } from 'react';
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
import { useAuth } from '../lib/auth';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/vendors', icon: Store, label: 'Vendors' },
  { to: '/customers', icon: Users, label: 'Customers' },
];

/** Sidebar (logo, sections, signed-in admin) + a top bar (menu button, theme) above the page. */
export function AdminLayout({ children }: { children: ReactNode }) {
  const { admin, signOut } = useAuth();
  const { pathname } = useLocation();
  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-4 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <DvoteLogo height={30} className="text-primary" />
            <Badge variant="brand" className="font-bold tracking-wide">
              ADMIN
            </Badge>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {NAV.map((n) => (
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
              <AvatarFallback className="bg-primary font-semibold text-primary-foreground">{initial(admin?.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{admin?.name}</div>
              <div className="truncate text-xs text-muted-foreground">{admin?.email}</div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => void signOut()}>
                  <LogOut />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign out</TooltipContent>
            </Tooltip>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-background">
        <header className="flex h-14 items-center gap-2 px-4 md:px-8">
          <SidebarTrigger />
          <div className="flex-1" />
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 pb-12 md:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
