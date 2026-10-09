import { SearchOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Avatar, Button, Card, Descriptions, Drawer, Empty, Flex, Input, List, Segmented, Skeleton, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { num, PageHeader } from '../components/PageHeader';
import { api, errorMessage, type UserListItem, type UserStatus } from '../lib/api';
import { brand } from '../theme';
import { StatusTag } from './Vendors';

/** Every customer: search, filter, open one to see cards and history, block / unblock. */
export function Customers() {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UserStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  // search after a short pause in typing
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(input.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', search, status, page],
    queryFn: () => api.users({ search: search || undefined, status: status === 'all' ? undefined : status, page, pageSize: 20 }),
    placeholderData: (prev) => prev,
  });

  return (
    <>
      <PageHeader title="Customers" subtitle={data ? `${num(data.total)} customers` : 'Everyone using the dvote app'} />
      <Card styles={{ body: { padding: 0 } }}>
        <Flex gap={12} wrap style={{ padding: 16 }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search name, email or phone"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ maxWidth: 340 }}
          />
          <Segmented
            value={status}
            onChange={(v) => {
              setStatus(v as UserStatus | 'all');
              setPage(1);
            }}
            options={[
              { label: 'All', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Blocked', value: 'blocked' },
            ]}
          />
        </Flex>
        {error ? <Alert type="error" showIcon message={errorMessage(error)} style={{ margin: '0 16px 16px' }} /> : null}
        <Table<UserListItem>
          rowKey="id"
          loading={isLoading}
          dataSource={data?.items ?? []}
          rowClassName="clickable-row"
          onRow={(u) => ({ onClick: () => setOpenId(u.id) })}
          pagination={{
            current: page,
            pageSize: 20,
            total: data?.total ?? 0,
            onChange: setPage,
            showSizeChanger: false,
            hideOnSinglePage: true,
          }}
          columns={[
            {
              title: 'Customer',
              key: 'name',
              render: (_, u) => (
                <Flex align="center" gap={12}>
                  <Avatar src={u.avatarUrl ?? undefined} style={{ background: brand.purpleSoft, color: brand.purple }}>
                    {(u.name ?? u.email ?? '?').slice(0, 1).toUpperCase()}
                  </Avatar>
                  <div>
                    <div style={{ fontWeight: 600 }}>{u.name ?? 'No name'}</div>
                    <div style={{ color: brand.muted, fontSize: 12 }}>{u.email ?? u.phone ?? '—'}</div>
                  </div>
                </Flex>
              ),
            },
            { title: 'Status', dataIndex: 'status', render: (s: string) => <StatusTag status={s} /> },
            { title: 'Cards', dataIndex: 'cardsCount', align: 'right' },
            { title: 'Points', dataIndex: 'pointsBalance', align: 'right', render: (p: number) => num(p) },
            {
              title: 'Last activity',
              dataIndex: 'lastActivityAt',
              render: (d: string | null) => (d ? dayjs(d).format('D MMM YYYY') : <span style={{ color: brand.muted }}>—</span>),
            },
            { title: 'Joined', dataIndex: 'createdAt', render: (d: string) => dayjs(d).format('D MMM YYYY') },
          ]}
        />
      </Card>
      <CustomerDrawer id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

function CustomerDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const { data: u, isLoading } = useQuery({ queryKey: ['user', id], queryFn: () => api.user(id!), enabled: !!id });

  const setStatus = useMutation({
    mutationFn: (status: UserStatus) => api.setUserStatus(id!, status),
    onSuccess: (user) => {
      qc.setQueryData(['user', id], user);
      void qc.invalidateQueries({ queryKey: ['users'] });
      void message.success(user.status === 'blocked' ? 'Customer blocked' : 'Customer unblocked');
    },
    onError: (e) => void message.error(errorMessage(e)),
  });

  return (
    <Drawer open={!!id} onClose={onClose} width={560} title="Customer" destroyOnHidden>
      {isLoading || !u ? (
        <Skeleton active avatar paragraph={{ rows: 8 }} />
      ) : (
        <Flex vertical gap={24}>
          <Flex align="center" gap={16}>
            <Avatar size={64} src={u.avatarUrl ?? undefined} style={{ background: brand.purpleSoft, color: brand.purple, fontSize: 24 }}>
              {(u.name ?? u.email ?? '?').slice(0, 1).toUpperCase()}
            </Avatar>
            <div style={{ flex: 1 }}>
              <Flex align="center" gap={8}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {u.name ?? 'No name'}
                </Typography.Title>
                <StatusTag status={u.status} />
              </Flex>
              <Typography.Text type="secondary">{u.email ?? 'No email'}</Typography.Text>
            </div>
            {u.status === 'active' ? (
              <Button
                danger
                icon={<StopOutlined />}
                loading={setStatus.isPending}
                onClick={() =>
                  modal.confirm({
                    title: 'Block this customer?',
                    content: 'They can no longer use the app or collect points. Their points are kept; you can unblock them any time.',
                    okText: 'Block',
                    okButtonProps: { danger: true },
                    onOk: () => setStatus.mutateAsync('blocked'),
                  })
                }
              >
                Block
              </Button>
            ) : (
              <Button icon={<CheckCircleOutlined />} loading={setStatus.isPending} onClick={() => setStatus.mutate('active')}>
                Unblock
              </Button>
            )}
          </Flex>

          <Descriptions
            column={2}
            size="small"
            items={[
              { key: 'phone', label: 'Phone', children: u.phone ?? '—' },
              { key: 'gender', label: 'Gender', children: u.gender ? u.gender[0].toUpperCase() + u.gender.slice(1) : '—' },
              { key: 'birth', label: 'Birthday', children: u.birthDate ? dayjs(u.birthDate).format('D MMM YYYY') : '—' },
              { key: 'joined', label: 'Joined', children: dayjs(u.createdAt).format('D MMM YYYY') },
              { key: 'points', label: 'Points held', children: num(u.pointsBalance) },
              { key: 'cards', label: 'Cards', children: u.cardsCount },
            ]}
          />

          <div>
            <Typography.Title level={5}>Cards</Typography.Title>
            {u.cards.length === 0 ? (
              <Empty description="No cards yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                dataSource={u.cards}
                renderItem={(c) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar src={c.vendorLogoUrl ?? undefined}>{c.vendorName.slice(0, 1)}</Avatar>}
                      title={c.vendorName}
                      description={`${num(c.lifetimePoints)} earned in total · last visit ${dayjs(c.lastActivityAt).format('D MMM')}`}
                    />
                    <Typography.Text strong>{num(c.balance)} pts</Typography.Text>
                  </List.Item>
                )}
              />
            )}
          </div>

          <div>
            <Typography.Title level={5}>Recent activity</Typography.Title>
            {u.events.length === 0 ? (
              <Empty description="No activity yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={u.events}
                renderItem={(e) => (
                  <List.Item>
                    <div>
                      <div>
                        <Tag color={e.type === 'earn' ? 'green' : e.type === 'redeem' ? 'orange' : 'purple'} bordered={false}>
                          {e.type === 'earn' ? 'Earned' : e.type === 'redeem' ? 'Redeemed' : 'Correction'}
                        </Tag>
                        {e.vendorName}
                        {e.branchName ? ` · ${e.branchName}` : ''}
                      </div>
                      <div style={{ color: brand.muted, fontSize: 12 }}>
                        {[e.purchaseAmount ? `Bill ${e.purchaseAmount}` : null, e.rewardName, e.reason, dayjs(e.createdAt).format('D MMM YYYY, HH:mm')]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <Typography.Text strong style={{ color: e.delta > 0 ? brand.green : brand.ink }}>
                      {e.delta > 0 ? '+' : ''}
                      {num(e.delta)}
                    </Typography.Text>
                  </List.Item>
                )}
              />
            )}
          </div>
        </Flex>
      )}
    </Drawer>
  );
}
