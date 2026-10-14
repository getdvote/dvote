import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChartLine, Crown, Gift, HandHeart, LayoutDashboard, ReceiptText, Settings, Store, Users } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initial } from '../components/PageHeader';
import { WhatsAppSoon } from '../components/WhatsAppSoon';
import { vendorApi, type StaffMe, type Vendor } from '../lib/api';
import { useAuth } from '../lib/auth';
import { branchState, stateLabel, type BranchState } from '../lib/hours';
import { myVendorScope, type VendorScope } from '../lib/scope';
import { cn } from '@/lib/utils';
import { SideLayout, type NavItem } from './AdminLayout';
import { t } from '../i18n';

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
    { to: '/', icon: LayoutDashboard, label: t('nav.overview') },
    // How the shop is doing: customers and reports.
    { to: '/customers', icon: Users, label: t('nav.customers'), group: t('nav.insightsGroup') },
    { to: '/insights', icon: ChartLine, label: t('nav.insights'), group: t('nav.insightsGroup') },
    { to: '/activity', icon: ReceiptText, label: t('nav.activity'), group: t('nav.insightsGroup') },
    { to: '/redemptions', icon: HandHeart, label: t('nav.redemptions'), group: t('nav.insightsGroup') },
    // Everything about setting up the shop itself, together under one heading.
    ...(isAdmin ? [{ to: '/profile', icon: Settings, label: t('nav.profile'), group: t('nav.shopGroup') }] : []),
    { to: '/branches', icon: Store, label: t('nav.branches'), group: t('nav.shopGroup') },
    { to: '/menu', icon: BookOpen, label: t('nav.menu'), group: t('nav.shopGroup') },
    { to: '/staff', icon: Users, label: t('nav.staff'), group: t('nav.shopGroup') },
    { to: '/rewards', icon: Gift, label: t('nav.rewards'), group: t('nav.shopGroup') },
    { to: '/rule', icon: Crown, label: t('nav.rule'), group: t('nav.shopGroup') },
  ];

  return (
    <SideLayout
      nav={nav}
      badge={t('nav.merchantBadge')}
      languageSwitch
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
            <div className="truncate text-xs text-muted-foreground">{isAdmin ? t('nav.merchantAdmin') : t('nav.manager', { branch: me.branch?.name ?? '' })}</div>
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
    text = stateLabel(state);
  } else {
    const n = states.filter((s) => s === 'open').length;
    const paused = states.filter((s) => s === 'paused').length;
    state = paused ? 'paused' : n ? 'open' : states.every((s) => s === 'unknown') ? 'unknown' : 'closed';
    text = t('nav.branchesOpen', { n, total: open.length }) + (paused ? ` · ${t('nav.branchesPaused', { n: paused })}` : '');
  }
  return (
    <Link to="/branches" className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
      <span className={cn('size-2 shrink-0 rounded-full', DOT[state])} aria-hidden />
      <span className="truncate">{text}</span>
    </Link>
  );
}
