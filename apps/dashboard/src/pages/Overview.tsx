import { ShopOutlined, TeamOutlined, ThunderboltOutlined, TrophyOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Avatar, Card, Col, Empty, Flex, List, Row, Skeleton, Statistic, Typography } from 'antd';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { num, PageHeader } from '../components/PageHeader';
import { api, errorMessage } from '../lib/api';
import { brand } from '../theme';

/** Home: the whole system at a glance. */
export function Overview() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['overview'], queryFn: api.overview, refetchInterval: 60_000 });

  return (
    <>
      <PageHeader title="Overview" subtitle={`dvote today, ${dayjs().format('dddd D MMMM')}`} />
      {error ? <Alert type="error" showIcon message={errorMessage(error)} style={{ marginBottom: 16 }} /> : null}
      {isLoading || !data ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : (
        <Flex vertical gap={20}>
          <Row gutter={[20, 20]}>
            <Stat
              icon={<ShopOutlined />}
              title="Active vendors"
              value={data.vendorsActive}
              note={`${num(data.branchesOpen)} open branches · ${num(data.vendorsSuspended)} suspended`}
            />
            <Stat
              icon={<TeamOutlined />}
              title="Customers"
              value={data.customers}
              note={`+${num(data.customersNew7d)} this week · ${num(data.customersBlocked)} blocked`}
            />
            <Stat
              icon={<ThunderboltOutlined />}
              title="Collects today"
              value={data.collectsToday}
              note={`${num(data.cards)} loyalty cards in total`}
            />
            <Stat
              icon={<TrophyOutlined />}
              title="Points held by customers"
              value={data.pointsOutstanding}
              note={`${num(data.pointsEarned)} earned · ${num(data.pointsRedeemed)} redeemed`}
            />
          </Row>

          <Row gutter={[20, 20]}>
            <Col xs={24} xl={16}>
              <Card title="Points earned · last 14 days">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.days} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={brand.purple} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={brand.purple} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#EEEEF3" />
                    <XAxis dataKey="date" tickFormatter={(d: string) => dayjs(d).format('D MMM')} tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip labelFormatter={(d) => dayjs(String(d)).format('dddd D MMM')} formatter={(v) => [num(Number(v)), 'Points']} />
                    <Area type="monotone" dataKey="pointsEarned" stroke={brand.purple} strokeWidth={2.5} fill="url(#pts)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} xl={8}>
              <Card title="Busiest shops · 30 days" styles={{ body: { paddingTop: 8 } }}>
                {data.topVendors.length === 0 ? (
                  <Empty description="No collects yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <List
                    dataSource={data.topVendors}
                    renderItem={(v, i) => (
                      <List.Item style={{ cursor: 'pointer' }} onClick={() => navigate(`/vendors/${v.id}`)}>
                        <List.Item.Meta
                          avatar={
                            <Avatar src={v.logoUrl ?? undefined} style={{ background: brand.purpleSoft, color: brand.purple }}>
                              {i + 1}
                            </Avatar>
                          }
                          title={v.name}
                          description={`${num(v.collects)} collects`}
                        />
                        <Typography.Text strong>{num(v.pointsEarned)} pts</Typography.Text>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={[20, 20]}>
            <Col xs={24} xl={12}>
              <Card title="Collects per day">
                <ResponsiveContainer width="100%" height={200}>
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
            <Col xs={24} xl={12}>
              <Card title="New customers per day">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.days} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#EEEEF3" />
                    <XAxis dataKey="date" tickFormatter={(d: string) => dayjs(d).format('D')} tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip labelFormatter={(d) => dayjs(String(d)).format('D MMM')} formatter={(v) => [num(Number(v)), 'Sign-ups']} />
                    <Bar dataKey="newCustomers" fill={brand.green} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
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
