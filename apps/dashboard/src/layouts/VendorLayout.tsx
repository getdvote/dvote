import { useQuery } from '@tanstack/react-query';
import { BookOpen, Crown, Gift, LayoutDashboard, Settings, Store, Users } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initial } from '../components/PageHeader';
import { WhatsAppSoon } from '../components/WhatsAppSoon';
import { vendorApi, type StaffMe, type Vendor } from '../lib/api';
import { useAuth } from '../lib/auth';
import { myVendorScope, type VendorScope } from '../lib/scope';
import { SideLayout, type NavItem } from './AdminLayout';

/** The signed-in vendor account (only call inside the vendor routes). */
export function useMe(): StaffMe {
  const { staff } = useAuth();
  if (!staff) throw new Error('useMe outside a vendor session');
  return staff;
}

/** This vendor's data for the shared tabs: /api/vendor only, no vendor id anywhere. */
export function useMyScope(): VendorScope {
  const me = useMe();
  return useMemo(() => myVendorScope(me), [me]);
}

/** My vendor's profile (name, logo); starts from what sign-in returned. */
export function useMyVendor(): Vendor {
  const me = useMe();
  const { data } = useQuery({ queryKey: ['vendor', 'me'], queryFn: vendorApi.profile, staleTime: 60_000 });
  return (
    data ?? {
      ...me.vendor,
      bannerUrl: null,
      category: null,
      cardDesign: null,
      contactEmail: null,
      status: 'active',
      branchCount: 0,
      staffCount: 0,
      createdAt: '',
      updatedAt: '',
    }
  );
}

export function VendorLayout({ children }: { children: ReactNode }) {
  const me = useMe();
  const vendor = useMyVendor();
  const isAdmin = me.role === 'vendor_admin';
  const nav: NavItem[] = [
    { to: '/', icon: LayoutDashboard, label: 'Overview' },
    { to: '/branches', icon: Store, label: 'Branches' },
    { to: '/rule', icon: Crown, label: 'Points rule' },
    { to: '/rewards', icon: Gift, label: 'Rewards' },
    { to: '/menu', icon: BookOpen, label: 'Menu' },
    { to: '/staff', icon: Users, label: 'Staff' },
    ...(isAdmin ? [{ to: '/profile', icon: Settings, label: 'Shop profile' }] : []),
  ];

  return (
    <SideLayout
      nav={nav}
      badge="VENDOR"
      headerExtra={<WhatsAppSoon />}
      person={{ name: me.name, email: me.email }}
      top={
        <div className="mt-5 flex items-center gap-3 rounded-lg bg-muted/60 p-2.5">
          <Avatar className="size-10">
            {vendor.logoUrl ? <AvatarImage src={vendor.logoUrl} alt="" /> : null}
            <AvatarFallback className="bg-brand-soft font-semibold text-accent-foreground">{initial(vendor.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{vendor.name}</div>
            <div className="truncate text-xs text-muted-foreground">{isAdmin ? 'Vendor admin' : `Manager · ${me.branch?.name ?? ''}`}</div>
          </div>
        </div>
      }
    >
      {children}
    </SideLayout>
  );
}
