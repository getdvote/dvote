import { MailOutlined, UserAddOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Flex, Form, Input, Modal, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { api, errorMessage, type Staff, type StaffRole } from '../../lib/api';
import { brand } from '../../theme';
import { StatusTag } from '../Vendors';

const ROLE: Record<StaffRole, { label: string; color: string }> = {
  vendor_admin: { label: 'Vendor admin', color: 'purple' },
  branch_manager: { label: 'Branch manager', color: 'blue' },
  staff: { label: 'Staff', color: 'default' },
};

/** Everyone working at the vendor. The platform invites the vendor admin; they invite the rest. */
export function StaffTab({ vendorId }: { vendorId: string }) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [inviting, setInviting] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ['staff', vendorId], queryFn: () => api.staff(vendorId) });
  const { data: branches } = useQuery({ queryKey: ['branches', vendorId], queryFn: () => api.branches(vendorId) });
  const branchName = (id: string | null) => (id ? branches?.find((b) => b.id === id)?.name ?? '—' : 'All branches');

  const toggle = useMutation({
    mutationFn: (s: Staff) => api.updateStaff(s.id, { status: s.status === 'active' ? 'disabled' : 'active' }),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['staff', vendorId] });
      void message.success(s.status === 'active' ? `${s.name} can sign in again` : `${s.name} is disabled`);
    },
    onError: (e) => void message.error(errorMessage(e)),
  });

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <span style={{ color: brand.muted }}>Invite the owner as vendor admin; they add managers and staff from their side.</span>
        <Button type="primary" icon={<UserAddOutlined />} onClick={() => setInviting(true)}>
          Invite vendor admin
        </Button>
      </Flex>
      {error ? <Alert type="error" showIcon message={errorMessage(error)} /> : null}
      <Table<Staff>
        rowKey="id"
        loading={isLoading}
        dataSource={data ?? []}
        pagination={false}
        locale={{ emptyText: 'No staff yet' }}
        columns={[
          {
            title: 'Name',
            key: 'name',
            render: (_, s) => (
              <div>
                <strong>{s.name}</strong>
                <div style={{ color: brand.muted, fontSize: 12 }}>{s.email}</div>
              </div>
            ),
          },
          { title: 'Role', dataIndex: 'role', render: (r: StaffRole) => <Tag color={ROLE[r].color}>{ROLE[r].label}</Tag> },
          { title: 'Branch', dataIndex: 'branchId', render: (id: string | null) => branchName(id) },
          { title: 'Status', dataIndex: 'status', render: (s: string) => <StatusTag status={s} /> },
          { title: 'Added', dataIndex: 'createdAt', render: (d: string) => dayjs(d).format('D MMM YYYY') },
          {
            title: '',
            key: 'actions',
            align: 'right',
            render: (_, s) => (
              <Button size="small" danger={s.status === 'active'} loading={toggle.isPending && toggle.variables?.id === s.id} onClick={() => toggle.mutate(s)}>
                {s.status === 'active' ? 'Disable' : 'Enable'}
              </Button>
            ),
          },
        ]}
      />
      <InviteModal vendorId={vendorId} open={inviting} onClose={() => setInviting(false)} />
    </>
  );
}

function InviteModal({ vendorId, open, onClose }: { vendorId: string; open: boolean; onClose: () => void }) {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const invite = useMutation({
    mutationFn: (v: { name: string; email: string }) => api.inviteVendorAdmin(vendorId, { name: v.name.trim(), email: v.email.trim() }),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['staff', vendorId] });
      void qc.invalidateQueries({ queryKey: ['vendor', vendorId] });
      void message.success(s.invited ? `Invite email sent to ${s.email}` : `${s.email} already had an account: linked, no email sent`);
      form.resetFields();
      onClose();
    },
  });
  return (
    <Modal title="Invite vendor admin" open={open} onCancel={onClose} okText="Send invite" confirmLoading={invite.isPending} onOk={() => form.submit()} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => invite.mutate(v)}>
        <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, max: 120 }]}>
          <Input placeholder="Owner's name" autoFocus />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
          <Input prefix={<MailOutlined />} placeholder="owner@shop.com" />
        </Form.Item>
        {invite.error ? <Alert type="error" showIcon message={errorMessage(invite.error)} /> : null}
      </Form>
      <div style={{ color: brand.muted, fontSize: 13 }}>They get an email to set their password, then sign in to the staff app and the dashboard.</div>
    </Modal>
  );
}
