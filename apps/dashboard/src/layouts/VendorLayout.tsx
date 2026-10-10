import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChartLine, Crown, Gift, HandHeart, LayoutDashboard, ReceiptText, Settings, Store, Users } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initial } from '../components/PageHeader';
import { WhatsAppSoon } from '../components/WhatsAppSoon';
import { vendorApi, type StaffMe, type Vendor } from '../lib/api';
import { useAuth } from '../lib/auth';
import { branchState, STATE_LABEL, type BranchState } from '../lib/hours';
import { myVendorScope, type VendorScope } from '../lib/scope';
import { cn } from '@/lib/utils';
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
    { to: '/customers', icon: Users, label: 'Customers' },
    { to: '/insights', icon: ChartLine, label: 'Insights' },
    { to: '/activity', icon: ReceiptText, label: 'Activity' },
    { to: '/branches', icon: Store, label: 'Branches' },
    { to: '/rule', icon: Crown, label: 'Points rule' },
    { to: '/rewards', icon: Gift, label: 'Rewards' },
    { to: '/redemptions', icon: HandHeart, label: 'Redemptions' },
    { to: '/menu', icon: BookOpen, label: 'Menu' },
    { to: '/staff', icon: Users, label: 'Staff' },
    ...(isAdmin ? [{ to: '/profile', icon: Settings, label: 'Shop profile' }] : []),
  ];

  return (
    <SideLayout
      nav={nav}
      badge="MERCHANT"
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
            <div className="truncate text-xs text-muted-foreground">{isAdmin ? 'Merchant admin' : `Manager · ${me.branch?.name ?? ''}`}</div>
            <BranchesNow />
          </div>
        </div>
      }
    >
      {children}
    </SideLayout>
  );
}

const DOT: Record<BranchState, string> = {
  open: 'bg-success',
  paused: 'bg-warning',
  closed: 'bg-muted-foreground/50',
  unknown: 'border border-muted-foreground/60 bg-transparent',
};

/**
 * Always-visible store status under the shop name: a manager's branch (open now / closed /
 * temporarily closed), or for a merchant admin how many branches are open. Links to Branches,
 * where it can be changed. Re-read every minute so it follows the clock.
 */
function BranchesNow() {
  const me = useMe();
  const scope = useMyScope();
  const { data } = useQuery({ queryKey: ['branches', scope.key], queryFn: () => scope.branches(), refetchInterval: 60_000 });
  const open = (data ?? []).filter((b) => b.status === 'active' && (me.role === 'vendor_admin' || b.id === me.branchId));
  if (!open.length) return null;

  const states = open.map((b) => branchState(b));
  let state: BranchState;
  let text: string;
  if (open.length === 1) {
    state = states[0];
    text = STATE_LABEL[state];
  } else {
    const n = states.filter((s) => s === 'open').length;
    const paused = states.filter((s) => s === 'paused').length;
    state = paused ? 'paused' : n ? 'open' : states.every((s) => s === 'unknown') ? 'unknown' : 'closed';
    text = `${n} of ${open.length} open now${paused ? ` · ${paused} paused` : ''}`;
  }
  return (
    <Link to="/branches" className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
      <span className={cn('size-2 shrink-0 rounded-full', DOT[state])} aria-hidden />
      <span className="truncate">{text}</span>
    </Link>
  );
}
