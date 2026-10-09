import { MailOutlined, UserAddOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Flex, Form, Input, Modal, Select, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { errorMessage, type Staff, type StaffRole } from '../../lib/api';
import type { VendorScope } from '../../lib/scope';
import { brand } from '../../theme';
import { StatusTag } from '../Vendors';

const ROLE: Record<StaffRole, { label: string; color: string }> = {
  vendor_admin: { label: 'Vendor admin', color: 'purple' },
  branch_manager: { label: 'Branch manager', color: 'blue' },
  staff: { label: 'Staff', color: 'default' },
};

/** Everyone working at the vendor. The platform invites the vendor admin; they invite the rest. */
export function StaffTab({ scope, selfId }: { scope: VendorScope; selfId?: string }) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [inviting, setInviting] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ['staff', scope.key], queryFn: () => scope.staff() });
  const { data: branches } = useQuery({ queryKey: ['branches', scope.key], queryFn: () => scope.branches() });
  const branchName = (id: string | null) => (id ? branches?.find((b) => b.id === id)?.name ?? '—' : 'All branches');
  const onlyAdmins = scope.can.inviteRoles.length === 1 && scope.can.inviteRoles[0] === 'vendor_admin';

  const toggle = useMutation({
    mutationFn: (s: Staff) => scope.updateStaff(s.id, { status: s.status === 'active' ? 'disabled' : 'active' }),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['staff', scope.key] });
      void message.success(s.status === 'active' ? `${s.name} can sign in again` : `${s.name} is disabled`);
    },
    onError: (e) => void message.error(errorMessage(e)),
  });

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <span style={{ color: brand.muted }}>
          {onlyAdmins
            ? 'Invite the owner as vendor admin; they add managers and staff from their side.'
            : 'People you invite get an email to set a password, then sign in to the staff app.'}
        </span>
        {scope.can.inviteRoles.length ? (
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => setInviting(true)}>
            {onlyAdmins ? 'Invite vendor admin' : 'Invite'}
          </Button>
        ) : null}
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
                <strong>{s.name}</strong> {s.id === selfId ? <Tag>You</Tag> : null}
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
            render: (_, s) =>
              s.id === selfId ? null : (
                <Button size="small" danger={s.status === 'active'} loading={toggle.isPending && toggle.variables?.id === s.id} onClick={() => toggle.mutate(s)}>
                  {s.status === 'active' ? 'Disable' : 'Enable'}
                </Button>
              ),
          },
        ]}
      />
      <InviteModal
        scope={scope}
        branches={(branches ?? []).filter((b) => b.status === 'active')}
        open={inviting}
        onClose={() => setInviting(false)}
      />
    </>
  );
}

function InviteModal({
  scope,
  branches,
  open,
  onClose,
}: {
  scope: VendorScope;
  branches: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const roles = scope.can.inviteRoles;
  const role = (Form.useWatch('role', form) as StaffRole | undefined) ?? roles[0];
  const pickBranch = role !== 'vendor_admin' && !scope.can.fixedBranchId;

  const invite = useMutation({
    mutationFn: (v: { name: string; email: string; role?: StaffRole; branchId?: string }) => {
      const r = v.role ?? roles[0];
      return scope.inviteStaff({
        name: v.name.trim(),
        email: v.email.trim(),
        role: r,
        branchId: r === 'vendor_admin' ? undefined : (scope.can.fixedBranchId ?? v.branchId),
      });
    },
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['staff', scope.key] });
      void qc.invalidateQueries({ queryKey: ['vendor', scope.key] });
      void message.success(s.invited ? `Invite email sent to ${s.email}` : `${s.email} already had an account: linked, no email sent`);
      form.resetFields();
      onClose();
    },
  });
  return (
    <Modal title="Invite" open={open} onCancel={onClose} okText="Send invite" confirmLoading={invite.isPending} onOk={() => form.submit()} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ role: roles[0] }} onFinish={(v) => invite.mutate(v)}>
        <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, max: 120 }]}>
          <Input placeholder="Full name" autoFocus />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
          <Input prefix={<MailOutlined />} placeholder="name@shop.com" />
        </Form.Item>
        {roles.length > 1 ? (
          <Form.Item name="role" label="Role" extra="Branch managers run one branch and its staff. Staff only scan in the staff app.">
            <Select options={roles.map((r) => ({ value: r, label: ROLE[r].label }))} />
          </Form.Item>
        ) : null}
        {pickBranch ? (
          <Form.Item name="branchId" label="Branch" rules={[{ required: true, message: 'Choose a branch' }]}>
            <Select placeholder="Choose a branch" options={branches.map((b) => ({ value: b.id, label: b.name }))} />
          </Form.Item>
        ) : null}
        {invite.error ? <Alert type="error" showIcon message={errorMessage(invite.error)} /> : null}
      </Form>
      <div style={{ color: brand.muted, fontSize: 13 }}>They get an email to set their password, then sign in.</div>
    </Modal>
  );
}
