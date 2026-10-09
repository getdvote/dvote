import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Avatar, Button, Card, Flex, Form, Input, Modal, Segmented, Select, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { api, errorMessage, type Vendor, type VendorStatus } from '../lib/api';
import { brand } from '../theme';

export const CURRENCIES = ['EGP', 'SAR', 'AED', 'USD', 'EUR'];

/** Every vendor (brand) on dvote: search, filter by status, create a new one. */
export function Vendors() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<VendorStatus | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['vendors', search.trim(), status],
    queryFn: () => api.vendors({ search: search.trim() || undefined, status: status === 'all' ? undefined : status }),
  });

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle="Coffee shop brands on dvote"
        extra={
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setCreating(true)}>
            New vendor
          </Button>
        }
      />
      <Card styles={{ body: { padding: 0 } }}>
        <Flex gap={12} wrap style={{ padding: 16 }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <Segmented
            value={status}
            onChange={(v) => setStatus(v as VendorStatus | 'all')}
            options={[
              { label: 'All', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Suspended', value: 'suspended' },
            ]}
          />
        </Flex>
        {error ? <Alert type="error" showIcon message={errorMessage(error)} style={{ margin: '0 16px 16px' }} /> : null}
        <Table<Vendor>
          rowKey="id"
          loading={isLoading}
          dataSource={data ?? []}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          rowClassName="clickable-row"
          onRow={(v) => ({ onClick: () => navigate(`/vendors/${v.id}`) })}
          columns={[
            {
              title: 'Vendor',
              key: 'name',
              render: (_, v) => (
                <Flex align="center" gap={12}>
                  <Avatar size={40} src={v.logoUrl ?? undefined} style={{ background: brand.purpleSoft, color: brand.purple }}>
                    {v.name.slice(0, 1).toUpperCase()}
                  </Avatar>
                  <div>
                    <div style={{ fontWeight: 600 }}>{v.name}</div>
                    <div style={{ color: brand.muted, fontSize: 12 }}>{v.contactEmail ?? 'No contact email'}</div>
                  </div>
                </Flex>
              ),
            },
            { title: 'Status', dataIndex: 'status', render: (s: VendorStatus) => <StatusTag status={s} /> },
            { title: 'Branches', dataIndex: 'branchCount', align: 'right' },
            { title: 'Staff', dataIndex: 'staffCount', align: 'right' },
            { title: 'Currency', dataIndex: 'currency' },
            { title: 'Joined', dataIndex: 'createdAt', render: (d: string) => dayjs(d).format('D MMM YYYY') },
          ]}
        />
      </Card>
      <CreateVendorModal open={creating} onClose={() => setCreating(false)} onCreated={(v) => navigate(`/vendors/${v.id}`)} />
    </>
  );
}

export function StatusTag({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    active: { color: 'green', label: 'Active' },
    suspended: { color: 'red', label: 'Suspended' },
    closed: { color: 'default', label: 'Closed' },
    archived: { color: 'default', label: 'Archived' },
    disabled: { color: 'red', label: 'Disabled' },
    blocked: { color: 'red', label: 'Blocked' },
  };
  const s = map[status] ?? { color: 'default', label: status };
  return (
    <Tag color={s.color} bordered={false} style={{ fontWeight: 600 }}>
      {s.label}
    </Tag>
  );
}

function CreateVendorModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (v: Vendor) => void }) {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const create = useMutation({
    mutationFn: (v: { name: string; contactEmail?: string; currency: string }) =>
      api.createVendor({ name: v.name.trim(), contactEmail: v.contactEmail?.trim() || undefined, currency: v.currency }),
    onSuccess: (v) => {
      void qc.invalidateQueries({ queryKey: ['vendors'] });
      void message.success(`${v.name} created`);
      form.resetFields();
      onClose();
      onCreated(v);
    },
  });
  return (
    <Modal
      title="New vendor"
      open={open}
      onCancel={onClose}
      okText="Create vendor"
      confirmLoading={create.isPending}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ currency: 'EGP' }} onFinish={(v) => create.mutate(v)}>
        <Form.Item name="name" label="Brand name" rules={[{ required: true, whitespace: true, max: 120 }]}>
          <Input placeholder="e.g. Joy Corner" autoFocus />
        </Form.Item>
        <Form.Item name="contactEmail" label="Contact email" rules={[{ type: 'email' }]}>
          <Input placeholder="owner@shop.com (optional)" />
        </Form.Item>
        <Form.Item name="currency" label="Currency" extra="Locked once the vendor has a points rule.">
          <Select options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        </Form.Item>
        {create.error ? <Alert type="error" showIcon message={errorMessage(create.error)} /> : null}
      </Form>
      <div style={{ color: brand.muted, fontSize: 13 }}>
        Next, on the vendor page: add branches, a points rule and rewards, then invite the owner.
      </div>
    </Modal>
  );
}
