import { GiftOutlined, TeamOutlined, ThunderboltOutlined, TrophyOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Avatar, Card, Col, Empty, Flex, Row, Skeleton, Statistic, Table, Typography } from 'antd';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { num, PageHeader } from '../../components/PageHeader';
import { useMe, useMyVendor } from '../../layouts/VendorLayout';
import { errorMessage, vendorApi } from '../../lib/api';
import { brand } from '../../theme';

/** Vendor home: my shop's activity (counts only, never who the customers are). */
export function MyHome() {
  const me = useMe();
  const vendor = useMyVendor();
  const { data, isLoading, error } = useQuery({ queryKey: ['summary', 'me'], queryFn: vendorApi.summary, refetchInterval: 60_000 });
  const branchOnly = me.role !== 'vendor_admin';

  return (
    <>
      <PageHeader
        title={`Hi ${me.name.split(' ')[0]}`}
        subtitle={`${branchOnly ? me.branch?.name : vendor.name} today, ${dayjs().format('dddd D MMMM')}`}
      />
      {error ? <Alert type="error" showIcon message={errorMessage(error)} style={{ marginBottom: 16 }} /> : null}
      {isLoading || !data ? (
        error ? null : <Skeleton active paragraph={{ rows: 10 }} />
      ) : (
        <Flex vertical gap={20}>
          <Row gutter={[20, 20]}>
            <Stat icon={<ThunderboltOutlined />} title="Collects today" value={data.collectsToday} note={`${num(data.pointsToday)} points given today`} />
            <Stat icon={<TeamOutlined />} title="Customers" value={data.customers} note={`+${num(data.newCustomers7d)} new this week`} />
            <Stat icon={<TrophyOutlined />} title="Points earned · 30 days" value={data.pointsEarned30d} note={branchOnly ? 'At your branch' : 'All branches'} />
            <Stat
              icon={<GiftOutlined />}
              title="Points held by customers"
              value={data.pointsOutstanding}
              note={`${num(data.pointsRedeemed30d)} redeemed in 30 days`}
            />
          </Row>

          <Row gutter={[20, 20]}>
            <Col xs={24} xl={16}>
              <Card title="Points earned · last 14 days">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.days} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="mypts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={brand.purple} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={brand.purple} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#EEEEF3" />
                    <XAxis dataKey="date" tickFormatter={(d: string) => dayjs(d).format('D MMM')} tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip labelFormatter={(d) => dayjs(String(d)).format('dddd D MMM')} formatter={(v) => [num(Number(v)), 'Points']} />
                    <Area type="monotone" dataKey="pointsEarned" stroke={brand.purple} strokeWidth={2.5} fill="url(#mypts)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} xl={8}>
              <Card title="Collects per day">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.days} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#EEEEF3" />
                    <XAxis dataKey="date" tickFormatter={(d: string) => dayjs(d).format('D')} tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip labelFormatter={(d) => dayjs(String(d)).format('D MMM')} formatter={(v) => [num(Number(v)), 'Collects']} />
                    <Bar dataKey="collects" fill={brand.purple} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          <Card title={branchOnly ? 'My branch · 30 days' : 'Branches · 30 days'}>
            <Table
              rowKey="id"
              size="middle"
              pagination={false}
              dataSource={data.branches}
              locale={{ emptyText: <Empty description="No open branches" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              columns={[
                { title: 'Branch', dataIndex: 'name', render: (n: string) => <strong>{n}</strong> },
                { title: 'Collects', dataIndex: 'collects', align: 'right', render: (n: number) => num(n) },
                { title: 'Points given', dataIndex: 'pointsEarned', align: 'right', render: (n: number) => <strong>{num(n)}</strong> },
              ]}
            />
          </Card>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Customers and points held count everyone with a card at {vendor.name}. dvote never shows you who your customers are.
          </Typography.Text>
        </Flex>
      )}
    </>
  );
}

function Stat({ icon, title, value, note }: { icon: ReactNode; title: string; value: number; note: string }) {
  return (
    <Col xs={24} sm={12} xl={6}>
      <Card className="stat-card">
        <Flex gap={14} align="flex-start">
          <Avatar size={44} icon={icon} style={{ background: brand.purpleSoft, color: brand.purple, flexShrink: 0 }} />
          <div>
            <Statistic title={title} value={value} formatter={(v) => num(Number(v))} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {note}
            </Typography.Text>
          </div>
        </Flex>
      </Card>
    </Col>
  );
}
