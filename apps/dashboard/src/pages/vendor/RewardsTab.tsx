import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Col, Flex, Form, Input, InputNumber, Modal, Row, Table, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { errorMessage, type Reward } from '../../lib/api';
import type { VendorScope } from '../../lib/scope';
import { brand } from '../../theme';
import { StatusTag } from '../Vendors';

/** The reward catalogue (English + Arabic): add, edit price/texts/order, archive / restore. */
export function RewardsTab({ scope }: { scope: VendorScope }) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['rewards', scope.key], queryFn: () => scope.rewards() });

  const toggle = useMutation({
    mutationFn: (r: Reward) => scope.updateReward(r.id, { status: r.status === 'active' ? 'archived' : 'active' }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['rewards', scope.key] });
      void message.success(r.status === 'active' ? `${r.name} restored` : `${r.name} archived`);
    },
    onError: (e) => void message.error(errorMessage(e)),
  });

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <span style={{ color: brand.muted }}>Archived rewards can't be redeemed. A new price applies to future redemptions only.</span>
        {scope.can.editVendor ? (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
          Add reward
        </Button>
        ) : null}
      </Flex>
      {error ? <Alert type="error" showIcon message={errorMessage(error)} /> : null}
      <Table<Reward>
        rowKey="id"
        loading={isLoading}
        dataSource={data ?? []}
        pagination={false}
        locale={{ emptyText: 'No rewards yet' }}
        columns={([
          { title: '#', dataIndex: 'sortOrder', width: 56 },
          {
            title: 'Reward',
            key: 'name',
            render: (_, r) => (
              <div>
                <strong>{r.name}</strong>
                {r.nameAr ? (
                  <span dir="rtl" style={{ marginInlineStart: 10, color: brand.muted }}>
                    {r.nameAr}
                  </span>
                ) : (
                  <span style={{ marginInlineStart: 10, color: '#C4A000', fontSize: 12 }}>No Arabic name</span>
                )}
                {r.description ? <div style={{ color: brand.muted, fontSize: 12 }}>{r.description}</div> : null}
              </div>
            ),
          },
          { title: 'Cost', dataIndex: 'pointsCost', align: 'right', render: (c: number) => <strong>{c.toLocaleString()} pts</strong> },
          { title: 'Status', dataIndex: 'status', render: (s: string) => <StatusTag status={s} /> },
          {
            title: '',
            key: 'actions',
            align: 'right',
            render: (_, r) => (
              <Flex gap={8} justify="flex-end">
                <Button size="small" onClick={() => setEditing(r)}>
                  Edit
                </Button>
                <Button size="small" danger={r.status === 'active'} loading={toggle.isPending && toggle.variables?.id === r.id} onClick={() => toggle.mutate(r)}>
                  {r.status === 'active' ? 'Archive' : 'Restore'}
                </Button>
              </Flex>
            ),
          },
        ] as TableColumnsType<Reward>).filter((c) => scope.can.editVendor || c.key !== 'actions')}
      />
      <RewardModal scope={scope} reward={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function RewardModal({ scope, reward, onClose }: { scope: VendorScope; reward: Reward | 'new' | null; onClose: () => void }) {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const isNew = reward === 'new';
  const save = useMutation({
    mutationFn: (v: Partial<Reward>) => {
      const body = {
        name: v.name?.trim(),
        nameAr: v.nameAr?.trim() || null,
        description: v.description?.trim() || null,
        descriptionAr: v.descriptionAr?.trim() || null,
        pointsCost: v.pointsCost,
        sortOrder: v.sortOrder ?? undefined,
      };
      return isNew ? scope.createReward(body) : scope.updateReward((reward as Reward).id, body);
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['rewards', scope.key] });
      void message.success(isNew ? `${r.name} added` : 'Saved');
      onClose();
    },
  });
  return (
    <Modal
      title={isNew ? 'Add reward' : 'Edit reward'}
      open={reward !== null}
      onCancel={onClose}
      okText={isNew ? 'Add reward' : 'Save'}
      confirmLoading={save.isPending}
      onOk={() => form.submit()}
      width={640}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={reward && reward !== 'new' ? reward : {}}
        onFinish={(v) => save.mutate(v)}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="name" label="Name (English)" rules={[{ required: true, whitespace: true, max: 120 }]}>
              <Input placeholder="Free coffee" autoFocus />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="nameAr" label="Name (Arabic)" rules={[{ max: 120 }]}>
              <Input dir="rtl" placeholder="قهوة مجانية" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="description" label="Description (English)" rules={[{ max: 500 }]}>
              <Input.TextArea rows={2} placeholder="Any coffee, any size" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="descriptionAr" label="Description (Arabic)" rules={[{ max: 500 }]}>
              <Input.TextArea rows={2} dir="rtl" placeholder="أي قهوة، أي حجم" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="pointsCost" label="Cost (points)" rules={[{ required: true }]}>
              <InputNumber min={1} max={1000000} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="sortOrder" label="Display order" extra="Lower shows first">
              <InputNumber min={0} max={10000} precision={0} style={{ width: '100%' }} placeholder="Last" />
            </Form.Item>
          </Col>
        </Row>
        {save.error ? <Alert type="error" showIcon message={errorMessage(save.error)} /> : null}
      </Form>
    </Modal>
  );
}
