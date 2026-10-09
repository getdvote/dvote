import { DashboardOutlined, LogoutOutlined, ShopOutlined, TeamOutlined } from '@ant-design/icons';
import { Avatar, Button, Flex, Layout, Menu, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { DvoteLogo } from '../components/DvoteLogo';
import { useAuth } from '../lib/auth';
import { brand } from '../theme';

const { Sider, Content } = Layout;

const NAV = [
  { key: '/', icon: <DashboardOutlined />, label: 'Overview' },
  { key: '/vendors', icon: <ShopOutlined />, label: 'Vendors' },
  { key: '/customers', icon: <TeamOutlined />, label: 'Customers' },
];

/** White sidebar (logo, sections, signed-in admin) + grey canvas for the page. */
export function AdminLayout({ children }: { children: ReactNode }) {
  const { admin, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const selected = NAV.filter((n) => (n.key === '/' ? pathname === '/' : pathname.startsWith(n.key))).map((n) => n.key);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={248} breakpoint="lg" collapsedWidth={0} style={{ borderRight: '1px solid #ECECF1' }}>
        <Flex vertical style={{ height: '100%', padding: '24px 14px 18px' }}>
          <Flex align="center" gap={10} style={{ padding: '0 10px 28px' }}>
            <DvoteLogo height={30} color={brand.purple} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: brand.purple,
                background: brand.purpleSoft,
                padding: '2px 8px',
                borderRadius: 999,
                letterSpacing: 0.4,
              }}
            >
              ADMIN
            </span>
          </Flex>
          <Menu
            mode="inline"
            selectedKeys={selected}
            items={NAV}
            onClick={(e) => navigate(e.key)}
            style={{ border: 'none', flex: 1 }}
          />
          <Flex align="center" gap={10} style={{ padding: '12px 10px', borderTop: '1px solid #ECECF1' }}>
            <Avatar style={{ background: brand.purple, flexShrink: 0 }}>{admin?.name.slice(0, 1).toUpperCase()}</Avatar>
            <Flex vertical style={{ minWidth: 0, flex: 1 }}>
              <Typography.Text strong ellipsis>
                {admin?.name}
              </Typography.Text>
              <Typography.Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                {admin?.email}
              </Typography.Text>
            </Flex>
            <Button type="text" icon={<LogoutOutlined />} title="Sign out" onClick={() => void signOut()} />
          </Flex>
        </Flex>
      </Sider>
      <Content style={{ padding: '28px 32px 48px', maxWidth: 1280, width: '100%', margin: '0 auto' }}>{children}</Content>
    </Layout>
  );
}
