import { ArrowLeftOutlined, CameraOutlined, DeleteOutlined, EditOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Avatar, Button, Card, Flex, Form, Input, Modal, Select, Skeleton, Tabs, Typography, Upload } from 'antd';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, errorMessage, type Vendor } from '../lib/api';
import { brand } from '../theme';
import { BranchesTab } from './vendor/BranchesTab';
import { ImagesTab } from './vendor/ImagesTab';
import { RulesTab } from './vendor/RulesTab';
import { RewardsTab } from './vendor/RewardsTab';
import { StaffTab } from './vendor/StaffTab';
import { CURRENCIES, StatusTag } from './Vendors';

/** One vendor: profile, logo, status, and its branches, points rule, rewards, images and staff. */
export function VendorDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: vendor, isLoading, error } = useQuery({ queryKey: ['vendor', id], queryFn: () => api.vendor(id) });

  return (
    <>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/vendors')} style={{ marginBottom: 12, paddingLeft: 0 }}>
        All vendors
      </Button>
      {error ? <Alert type="error" showIcon message={errorMessage(error)} /> : null}
      {isLoading || !vendor ? (
        error ? null : <Skeleton active avatar paragraph={{ rows: 6 }} />
      ) : (
        <Flex vertical gap={20}>
          <VendorHeader vendor={vendor} />
          <Card styles={{ body: { paddingTop: 4 } }}>
            <Tabs
              size="large"
              items={[
                { key: 'branches', label: 'Branches', children: <BranchesTab vendorId={id} /> },
                { key: 'rule', label: 'Points rule', children: <RulesTab vendor={vendor} /> },
                { key: 'rewards', label: 'Rewards', children: <RewardsTab vendorId={id} /> },
                { key: 'images', label: 'Menu & photos', children: <ImagesTab vendorId={id} /> },
                { key: 'staff', label: 'Staff', children: <StaffTab vendorId={id} /> },
              ]}
            />
          </Card>
        </Flex>
      )}
    </>
  );
}

function VendorHeader({ vendor }: { vendor: Vendor }) {
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const [editing, setEditing] = useState(false);
  const refresh = (v: Vendor) => {
    qc.setQueryData(['vendor', v.id], v);
    void qc.invalidateQueries({ queryKey: ['vendors'] });
  };

  const logo = useMutation({
    mutationFn: (file: File) => api.uploadLogo(vendor.id, file),
    onSuccess: (v) => {
      refresh(v);
      void message.success('Logo updated');
    },
    onError: (e) => void message.error(errorMessage(e)),
  });
  const removeLogo = useMutation({
    mutationFn: () => api.removeLogo(vendor.id),
    onSuccess: (v) => {
      refresh(v);
      void message.success('Logo removed');
    },
    onError: (e) => void message.error(errorMessage(e)),
  });
  const setStatus = useMutation({
    mutationFn: (status: Vendor['status']) => api.updateVendor(vendor.id, { status }),
    onSuccess: (v) => {
      refresh(v);
      void message.success(v.status === 'active' ? `${v.name} is active` : `${v.name} is suspended`);
    },
    onError: (e) => void message.error(errorMessage(e)),
  });

  const suspended = vendor.status === 'suspended';

  return (
    <Card>
      <Flex gap={22} align="center" wrap>
        <Flex vertical align="center" gap={6}>
          <Upload
            accept="image/png,image/jpeg,image/webp,image/heic"
            showUploadList={false}
            customRequest={({ file }) => logo.mutate(file as File)}
          >
            <div style={{ position: 'relative', cursor: 'pointer' }} title="Upload logo">
              <Avatar size={88} src={vendor.logoUrl ?? undefined} style={{ background: brand.purpleSoft, color: brand.purple, fontSize: 32 }}>
                {vendor.name.slice(0, 1).toUpperCase()}
              </Avatar>
              <Avatar
                size={30}
                icon={<CameraOutlined />}
                style={{ position: 'absolute', right: -2, bottom: -2, background: '#fff', color: brand.ink, border: '2px solid #F4F4F8' }}
              />
            </div>
          </Upload>
          {vendor.logoUrl ? (
            <Button
              size="small"
              type="link"
              danger
              icon={<DeleteOutlined />}
              loading={removeLogo.isPending}
              onClick={() => removeLogo.mutate()}
            >
              Remove
            </Button>
          ) : null}
        </Flex>

        <div style={{ flex: 1, minWidth: 220 }}>
          <Flex align="center" gap={10} wrap>
            <Typography.Title level={2} className="page-title">
              {vendor.name}
            </Typography.Title>
            <StatusTag status={vendor.status} />
          </Flex>
          <Typography.Text type="secondary">
            {vendor.contactEmail ?? 'No contact email'} · {vendor.currency} · {vendor.branchCount} branches · {vendor.staffCount} staff
          </Typography.Text>
          {logo.isPending ? <div style={{ color: brand.muted, marginTop: 4 }}>Uploading logo…</div> : null}
        </div>

        <Flex gap={10}>
          <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
            Edit
          </Button>
          {suspended ? (
            <Button type="primary" icon={<CheckCircleOutlined />} loading={setStatus.isPending} onClick={() => setStatus.mutate('active')}>
              Activate
            </Button>
          ) : (
            <Button
              danger
              icon={<StopOutlined />}
              loading={setStatus.isPending}
              onClick={() =>
                modal.confirm({
                  title: `Suspend ${vendor.name}?`,
                  content:
                    'Customers stop seeing it, its staff can no longer sign in, and no points can be collected there. Nothing is deleted; you can activate it again any time.',
                  okText: 'Suspend',
                  okButtonProps: { danger: true },
                  onOk: () => setStatus.mutateAsync('suspended'),
                })
              }
            >
              Suspend
            </Button>
          )}
        </Flex>
      </Flex>
      <EditVendorModal vendor={vendor} open={editing} onClose={() => setEditing(false)} onSaved={refresh} />
    </Card>
  );
}

function EditVendorModal({
  vendor,
  open,
  onClose,
  onSaved,
}: {
  vendor: Vendor;
  open: boolean;
  onClose: () => void;
  onSaved: (v: Vendor) => void;
}) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const save = useMutation({
    mutationFn: (v: { name: string; contactEmail?: string; currency: string }) =>
      api.updateVendor(vendor.id, {
        name: v.name.trim(),
        contactEmail: v.contactEmail?.trim() || null,
        ...(v.currency !== vendor.currency ? { currency: v.currency } : {}),
      }),
    onSuccess: (v) => {
      onSaved(v);
      void message.success('Saved');
      onClose();
    },
  });
  return (
    <Modal title="Edit vendor" open={open} onCancel={onClose} okText="Save" confirmLoading={save.isPending} onOk={() => form.submit()} destroyOnHidden>
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ name: vendor.name, contactEmail: vendor.contactEmail ?? '', currency: vendor.currency }}
        onFinish={(v) => save.mutate(v)}
      >
        <Form.Item name="name" label="Brand name" rules={[{ required: true, whitespace: true, max: 120 }]}>
          <Input />
        </Form.Item>
        <Form.Item name="contactEmail" label="Contact email" rules={[{ type: 'email' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="currency" label="Currency" extra="Can't change once the vendor has a points rule.">
          <Select options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        </Form.Item>
        {save.error ? <Alert type="error" showIcon message={errorMessage(save.error)} /> : null}
      </Form>
    </Modal>
  );
}
