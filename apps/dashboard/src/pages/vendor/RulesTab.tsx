import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Empty, Flex, Form, InputNumber, Row, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { errorMessage, type PointRule } from '../../lib/api';
import type { VendorScope } from '../../lib/scope';
import { brand } from '../../theme';

const amount = (v: string) => (v.endsWith('.00') ? v.slice(0, -3) : v);

/** Same formula as the API: floor(bill / spend) × points, 0 below the minimum, capped. */
function pointsFor(bill: number, r: { spendAmount: number; pointsPerSpend: number; minPurchase?: number; maxPointsPerPurchase?: number | null }) {
  if (!r.spendAmount || bill < (r.minPurchase ?? 0)) return 0;
  const p = Math.floor(Math.round(bill * 100) / Math.round(r.spendAmount * 100)) * r.pointsPerSpend;
  return r.maxPointsPerPurchase ? Math.min(p, r.maxPointsPerPurchase) : p;
}

/** The vendor's earning rule: the active one, publish a new version, history, stop earning. */
export function RulesTab({ scope }: { scope: VendorScope }) {
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const draft = Form.useWatch([], form) as
    | { spendAmount?: number; pointsPerSpend?: number; minPurchase?: number; maxPointsPerPurchase?: number | null }
    | undefined;
  const { data, isLoading, error } = useQuery({ queryKey: ['rules', scope.key], queryFn: () => scope.pointRules() });
  const active = data?.find((r) => r.isActive) ?? null;

  const done = (text: string) => {
    void qc.invalidateQueries({ queryKey: ['rules', scope.key] });
    void message.success(text);
  };
  const publish = useMutation({
    mutationFn: (v: { spendAmount: number; pointsPerSpend: number; minPurchase?: number; maxPointsPerPurchase?: number | null }) =>
      scope.publishRule({ ...v, maxPointsPerPurchase: v.maxPointsPerPurchase || null }),
    onSuccess: (r) => done(`Rule version ${r.version} is now active`),
    onError: (e) => void message.error(errorMessage(e)),
  });
  const stop = useMutation({
    mutationFn: () => scope.deactivateRule(),
    onSuccess: () => done('Earning stopped'),
    onError: (e) => void message.error(errorMessage(e)),
  });

  return (
    <Flex vertical gap={20}>
      {error ? <Alert type="error" showIcon message={errorMessage(error)} /> : null}
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={11}>
          <Card style={{ background: active ? brand.purpleSoft : '#FAFAFC', border: 'none', height: '100%' }}>
            <Typography.Text type="secondary">Current rule</Typography.Text>
            {active ? (
              <>
                <Typography.Title level={2} style={{ margin: '6px 0 4px', color: brand.purple }}>
                  Every {amount(active.spendAmount)} {scope.currency} = {active.pointsPerSpend} point{active.pointsPerSpend === 1 ? '' : 's'}
                </Typography.Title>
                <Typography.Text type="secondary">
                  Version {active.version} · since {dayjs(active.createdAt).format('D MMM YYYY')}
                  {Number(active.minPurchase) > 0 ? ` · bills from ${amount(active.minPurchase)} ${scope.currency}` : ''}
                  {active.maxPointsPerPurchase ? ` · max ${active.maxPointsPerPurchase} per purchase` : ''}
                </Typography.Text>
                <div style={{ marginTop: 18, display: scope.can.editVendor ? undefined : 'none' }}>
                  <Button
                    danger
                    loading={stop.isPending}
                    onClick={() =>
                      modal.confirm({
                        title: 'Stop earning points here?',
                        content: 'Staff will not be able to give points until a new rule is published. Points customers already have stay.',
                        okText: 'Stop earning',
                        okButtonProps: { danger: true },
                        onOk: () => stop.mutateAsync(),
                      })
                    }
                  >
                    Stop earning
                  </Button>
                </div>
              </>
            ) : (
              <Typography.Title level={4} style={{ margin: '6px 0 0' }}>
                No active rule: customers can't earn points here yet.
              </Typography.Title>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={13} style={{ display: scope.can.editVendor ? undefined : 'none' }}>
          <Card title={active ? 'Publish a new rule' : 'Set the points rule'}>
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              initialValues={{ spendAmount: 10, pointsPerSpend: 1, minPurchase: 0 }}
              onFinish={(v) => publish.mutate(v)}
            >
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="spendAmount" label={`Every (${scope.currency})`} rules={[{ required: true }]}>
                    <InputNumber min={0.01} max={99999999} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="pointsPerSpend" label="Gives (points)" rules={[{ required: true }]}>
                    <InputNumber min={1} max={10000} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="minPurchase" label={`Minimum bill (${scope.currency})`}>
                    <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="maxPointsPerPurchase" label="Max points per purchase">
                    <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="No limit" />
                  </Form.Item>
                </Col>
              </Row>
              {draft?.spendAmount && draft.pointsPerSpend ? (
                <Alert
                  type="info"
                  style={{ marginBottom: 16 }}
                  message={[50, 95, 250]
                    .map(
                      (bill) =>
                        `${bill} ${scope.currency} → ${pointsFor(bill, {
                          spendAmount: draft.spendAmount!,
                          pointsPerSpend: draft.pointsPerSpend!,
                          minPurchase: draft.minPurchase,
                          maxPointsPerPurchase: draft.maxPointsPerPurchase,
                        })} pts`,
                    )
                    .join('   ·   ')}
                />
              ) : null}
              <Button type="primary" htmlType="submit" loading={publish.isPending}>
                {active ? 'Publish new version' : 'Publish rule'}
              </Button>
              <div style={{ color: brand.muted, fontSize: 12, marginTop: 10 }}>
                Applies to new purchases only. Points already earned don't change.
              </div>
            </Form>
          </Card>
        </Col>
      </Row>

      <div>
        <Typography.Title level={5}>History</Typography.Title>
        <Table<PointRule>
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data ?? []}
          pagination={false}
          locale={{ emptyText: <Empty description="No rules yet" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          columns={[
            { title: 'Version', dataIndex: 'version', render: (v: number, r) => <>v{v} {r.isActive ? <Tag color="purple">Active</Tag> : null}</> },
            { title: 'Rule', key: 'rule', render: (_, r) => `${amount(r.spendAmount)} ${scope.currency} = ${r.pointsPerSpend} pt` },
            { title: 'Minimum bill', dataIndex: 'minPurchase', render: (m: string) => (Number(m) > 0 ? `${amount(m)} ${scope.currency}` : '—') },
            { title: 'Max per purchase', dataIndex: 'maxPointsPerPurchase', render: (m: number | null) => m ?? '—' },
            { title: 'Published', dataIndex: 'createdAt', render: (d: string) => dayjs(d).format('D MMM YYYY, HH:mm') },
          ]}
        />
      </div>
    </Flex>
  );
}
