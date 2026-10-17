import { HomeIcon as HouseActive, ScannerIcon as ScanLineActive, ShopIcon as StoreActive, MapPointIcon as MapPinActive, ChatSquareWarningIcon as MessageSquareWarningActive, CardIcon as CreditCardActive, GiftIcon as GiftActive, SmartphoneVibrationIcon as MegaphoneActive, GraphUpIcon as ChartLineActive, UsersGroupRoundedIcon as UsersActive, BillListIcon as ReceiptTextActive, BoxIcon as KitActive, SettingsIcon as SettingsActive } from '@solar-icons/react/bold-duotone';
import { useQuery } from '@tanstack/react-query';
import { BoxIcon as KitIcon, GraphUpIcon as ChartLine, QuestionCircleIcon as CircleHelp, SmartphoneVibrationIcon as Megaphone, MapPointIcon as MapPin, ChatSquareWarningIcon as MessageSquareWarning, CardIcon as CreditCard, GiftIcon as Gift, HomeIcon as House, BillListIcon as ReceiptText, ScannerIcon as ScanLine, SettingsIcon as Settings, ShopIcon as Store, UsersGroupRoundedIcon as Users } from '@solar-icons/react/linear';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ContactDvote } from '../components/ContactDvote';
import { vendorApi, type StaffMe, type Vendor } from '../lib/api';
import { useAuth } from '../lib/auth';
import { branchState, OPENING_HOURS, stateLabel, type BranchState } from '../lib/hours';
import { myVendorScope, type VendorScope } from '../lib/scope';
import { cn } from '@/lib/utils';
import { SideLayout, type NavItem } from './AdminLayout';
import { t } from '../i18n';
import { config } from '../lib/config';
import { StorefrontPreviewDialog } from '../pages/my/storefront-editor';
import { EyeIcon as Eye } from '@solar-icons/react/linear';

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
      slug: '',
      pageStyle: null,
      brandPrimary: null,
      brandSecondary: null,
      brandFont: null,
      contactEmail: null,
      contactPhone: null,
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const till: NavItem = { to: '/scan', icon: ScanLine, activeIcon: ScanLineActive, label: t('nav.till') };
  const cashier = me.role === 'staff';
  const viewer = me.role === 'viewer'; // read-only: no till, no team
  const nav: NavItem[] = cashier ? [till] : [
    { to: '/', icon: House, activeIcon: HouseActive, label: t('nav.home') },
    ...(viewer ? [] : [till]),
    // The shop as customers see it.
    ...(isAdmin
      ? [
          {
            to: '/storefront',
            icon: Store,
            activeIcon: StoreActive,
            label: t('nav.profile'),
            group: t('nav.hubGroup'),
            // the eye: the customer page in a phone, without leaving the current page
            action: { icon: Eye, label: t('storefront.preview'), onClick: () => setPreviewOpen(true) },
          },
        ]
      : []),
    { to: '/branches', icon: MapPin, activeIcon: MapPinActive, label: t('nav.branches'), group: t('nav.hubGroup') },
    { to: '/feedback', icon: MessageSquareWarning, activeIcon: MessageSquareWarningActive, label: t('nav.feedback'), group: t('nav.hubGroup') },
    // The loyalty program: the card (design + points rule), and rewards (catalogue + given).
    { to: '/card', icon: CreditCard, activeIcon: CreditCardActive, label: t('nav.card'), group: t('nav.loyaltyGroup') },
    { to: '/rewards', icon: Gift, activeIcon: GiftActive, label: t('nav.rewards'), group: t('nav.loyaltyGroup') },
    { to: '/broadcast', icon: Megaphone, activeIcon: MegaphoneActive, label: t('nav.messages'), group: t('nav.loyaltyGroup') },
    // How the shop is doing.
    { to: '/insights', icon: ChartLine, activeIcon: ChartLineActive, label: t('nav.insights'), group: t('nav.workspaceGroup') },
    { to: '/customers', icon: Users, activeIcon: UsersActive, label: t('nav.customers'), group: t('nav.workspaceGroup') },
    { to: '/activity', icon: ReceiptText, activeIcon: ReceiptTextActive, label: t('nav.activity'), group: t('nav.workspaceGroup') },
    { to: '/kit', icon: KitIcon, activeIcon: KitActive, label: t('nav.storeIds'), group: t('nav.workspaceGroup') },
  ];
  // In the profile menu (the shop card at the top of the sidebar).
  // the team lives in Settings → Team
  const account: NavItem[] = cashier ? [] : [
    { to: '/settings', icon: Settings, activeIcon: SettingsActive, label: t('nav.settings') },
  ];

  return (
    <SideLayout
      nav={nav}
      accountNav={account}
      languageSwitch
      menuLinks={[
        // the shop's public page on the customer website (opens in a new tab)
        ...(vendor.slug ? [{ icon: Store, label: t('nav.storefrontPreview'), href: `${config.webUrl}/${vendor.slug}` }] : []),
        { icon: CircleHelp, label: t('nav.getHelp'), onSelect: () => setHelpOpen(true) },
      ]}
      overlays={
        <>
          <ContactDvote name={me.name} shop={vendor.name} open={helpOpen} onOpenChange={setHelpOpen} />
          {isAdmin ? <StorefrontPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} /> : null}
        </>
      }
      identity={{ name: vendor.name, subtitle: me.email, imageUrl: vendor.logoUrl, extra: cashier || !OPENING_HOURS ? null : <BranchesNow /> }}
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
  const open = (data ?? []).filter((b) => b.status === 'active' && (me.branchId === null || b.id === me.branchId));
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
