import { EnvironmentOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Col, Flex, Form, Input, InputNumber, Modal, Row, Table } from 'antd';
import { useState } from 'react';
import { api, errorMessage, type Branch } from '../../lib/api';
import { brand } from '../../theme';
import { StatusTag } from '../Vendors';

/** The vendor's shops: add, edit (address, map location), close / reopen. */
export function BranchesTab({ vendorId }: { vendorId: string }) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<Branch | 'new' | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['branches', vendorId], queryFn: () => api.branches(vendorId) });

  const toggle = useMutation({
    mutationFn: (b: Branch) => api.updateBranch(b.id, { status: b.status === 'active' ? 'closed' : 'active' }),
    onSuccess: (b) => {
      void qc.invalidateQueries({ queryKey: ['branches', vendorId] });
      void qc.invalidateQueries({ queryKey: ['vendor', vendorId] });
      void message.success(b.status === 'active' ? `${b.name} reopened` : `${b.name} closed`);
    },
    onError: (e) => void message.error(errorMessage(e)),
  });

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <span style={{ color: brand.muted }}>Customers see open branches on the shop page, with directions.</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
          Add branch
        </Button>
      </Flex>
      {error ? <Alert type="error" showIcon message={errorMessage(error)} /> : null}
      <Table<Branch>
        rowKey="id"
        loading={isLoading}
        dataSource={data ?? []}
        pagination={false}
        locale={{ emptyText: 'No branches yet' }}
        columns={[
          { title: 'Branch', dataIndex: 'name', render: (n: string) => <strong>{n}</strong> },
          { title: 'Address', dataIndex: 'address', render: (a: string | null) => a ?? <span style={{ color: brand.muted }}>—</span> },
          {
            title: 'Map',
            key: 'map',
            render: (_, b) =>
              b.lat !== null && b.lng !== null ? (
                <a href={`https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`} target="_blank" rel="noreferrer">
                  <EnvironmentOutlined /> {b.lat.toFixed(4)}, {b.lng.toFixed(4)}
                </a>
              ) : (
                <span style={{ color: brand.muted }}>Not set</span>
              ),
          },
          { title: 'Status', dataIndex: 'status', render: (s: string) => <StatusTag status={s} /> },
          {
            title: '',
            key: 'actions',
            align: 'right',
            render: (_, b) => (
              <Flex gap={8} justify="flex-end">
                <Button size="small" onClick={() => setEditing(b)}>
                  Edit
                </Button>
                <Button size="small" danger={b.status === 'active'} loading={toggle.isPending && toggle.variables?.id === b.id} onClick={() => toggle.mutate(b)}>
                  {b.status === 'active' ? 'Close' : 'Reopen'}
                </Button>
              </Flex>
            ),
          },
        ]}
      />
      <BranchModal vendorId={vendorId} branch={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function BranchModal({ vendorId, branch, onClose }: { vendorId: string; branch: Branch | 'new' | null; onClose: () => void }) {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const isNew = branch === 'new';
  const save = useMutation({
    mutationFn: (v: { name: string; address?: string; lat?: number | null; lng?: number | null }) => {
      const body = { name: v.name.trim(), address: v.address?.trim() || null, lat: v.lat ?? null, lng: v.lng ?? null };
      return isNew ? api.createBranch(vendorId, body) : api.updateBranch((branch as Branch).id, body);
    },
    onSuccess: (b) => {
      void qc.invalidateQueries({ queryKey: ['branches', vendorId] });
      void qc.invalidateQueries({ queryKey: ['vendor', vendorId] });
      void message.success(isNew ? `${b.name} added` : 'Saved');
      onClose();
    },
  });
  return (
    <Modal
      title={isNew ? 'Add branch' : 'Edit branch'}
      open={branch !== null}
      onCancel={onClose}
      okText={isNew ? 'Add branch' : 'Save'}
      confirmLoading={save.isPending}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={branch && branch !== 'new' ? { name: branch.name, address: branch.address ?? '', lat: branch.lat, lng: branch.lng } : {}}
        onFinish={(v) => save.mutate(v)}
      >
        <Form.Item name="name" label="Branch name" rules={[{ required: true, whitespace: true, max: 120 }]}>
          <Input placeholder="e.g. Joy Corner Smouha" autoFocus />
        </Form.Item>
        <Form.Item name="address" label="Address" rules={[{ max: 500 }]}>
          <Input.TextArea rows={2} placeholder="Street, area, city" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="lat" label="Latitude">
              <InputNumber style={{ width: '100%' }} min={-90} max={90} step={0.0001} placeholder="31.2156" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="lng" label="Longitude">
              <InputNumber style={{ width: '100%' }} min={-180} max={180} step={0.0001} placeholder="29.9553" />
            </Form.Item>
          </Col>
        </Row>
        <div style={{ color: brand.muted, fontSize: 12, marginTop: -8, marginBottom: 12 }}>
          Tip: in Google Maps, right-click the shop and click the numbers to copy them.
        </div>
        {save.error ? <Alert type="error" showIcon message={errorMessage(save.error)} /> : null}
      </Form>
    </Modal>
  );
}
