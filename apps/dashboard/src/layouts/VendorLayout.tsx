import {
  CrownOutlined,
  DashboardOutlined,
  GiftOutlined,
  PictureOutlined,
  SettingOutlined,
  ShopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Flex, Typography } from 'antd';
import { useMemo, type ReactNode } from 'react';
import { vendorApi, type StaffMe } from '../lib/api';
import { useAuth } from '../lib/auth';
import { myVendorScope, type VendorScope } from '../lib/scope';
import { brand } from '../theme';
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
export function useMyVendor() {
  const me = useMe();
  return useQuery({ queryKey: ['vendor', 'me'], queryFn: vendorApi.profile, staleTime: 60_000 }).data ?? {
    ...me.vendor,
    contactEmail: null,
    status: 'active' as const,
    branchCount: 0,
    staffCount: 0,
    createdAt: '',
    updatedAt: '',
  };
}

export function VendorLayout({ children }: { children: ReactNode }) {
  const me = useMe();
  const vendor = useMyVendor();
  const isAdmin = me.role === 'vendor_admin';
  const nav: NavItem[] = [
    { key: '/', icon: <DashboardOutlined />, label: 'Overview' },
    { key: '/branches', icon: <ShopOutlined />, label: 'Branches' },
    { key: '/rule', icon: <CrownOutlined />, label: 'Points rule' },
    { key: '/rewards', icon: <GiftOutlined />, label: 'Rewards' },
    { key: '/images', icon: <PictureOutlined />, label: 'Menu & photos' },
    { key: '/staff', icon: <TeamOutlined />, label: 'Staff' },
    ...(isAdmin ? [{ key: '/profile', icon: <SettingOutlined />, label: 'Shop profile' }] : []),
  ];

  return (
    <SideLayout
      nav={nav}
      badge="VENDOR"
      person={{ name: me.name, email: me.email }}
      top={
        <Flex align="center" gap={12} style={{ padding: '0 10px 20px' }}>
          <Avatar size={42} src={vendor.logoUrl ?? undefined} style={{ background: brand.purpleSoft, color: brand.purple, flexShrink: 0 }}>
            {vendor.name.slice(0, 1).toUpperCase()}
          </Avatar>
          <Flex vertical style={{ minWidth: 0 }}>
            <Typography.Text strong ellipsis>
              {vendor.name}
            </Typography.Text>
            <Typography.Text type="secondary" ellipsis style={{ fontSize: 12 }}>
              {isAdmin ? 'Vendor admin' : `Manager · ${me.branch?.name ?? ''}`}
            </Typography.Text>
          </Flex>
        </Flex>
      }
    >
      {children}
    </SideLayout>
  );
}
