import { CameraOutlined, DeleteOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Avatar, Button, Card, Flex, Form, Input, Typography, Upload } from 'antd';
import { PageHeader } from '../../components/PageHeader';
import { useMyVendor } from '../../layouts/VendorLayout';
import { errorMessage, vendorApi, type Vendor } from '../../lib/api';
import { brand } from '../../theme';

/** Vendor admin: my shop's name, contact email and logo (status and currency stay with dvote). */
export function MyProfile() {
  const vendor = useMyVendor();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const done = (v: Vendor, text: string) => {
    qc.setQueryData(['vendor', 'me'], v);
    void message.success(text);
  };

  const logo = useMutation({
    mutationFn: vendorApi.uploadLogo,
    onSuccess: (v) => done(v, 'Logo updated'),
    onError: (e) => void message.error(errorMessage(e)),
  });
  const removeLogo = useMutation({
    mutationFn: vendorApi.removeLogo,
    onSuccess: (v) => done(v, 'Logo removed'),
    onError: (e) => void message.error(errorMessage(e)),
  });
  const save = useMutation({
    mutationFn: (v: { name: string; contactEmail?: string }) =>
      vendorApi.updateProfile({ name: v.name.trim(), contactEmail: v.contactEmail?.trim() || null }),
    onSuccess: (v) => done(v, 'Saved'),
  });

  return (
    <>
      <PageHeader title="Shop profile" subtitle="How your shop appears in the dvote app." />
      <Card style={{ maxWidth: 720 }}>
        <Flex gap={28} wrap>
          <Flex vertical align="center" gap={6}>
            <Upload accept="image/png,image/jpeg,image/webp,image/heic" showUploadList={false} customRequest={({ file }) => logo.mutate(file as File)}>
              <div style={{ position: 'relative', cursor: 'pointer' }} title="Upload logo">
                <Avatar size={104} src={vendor.logoUrl ?? undefined} style={{ background: brand.purpleSoft, color: brand.purple, fontSize: 38 }}>
                  {vendor.name.slice(0, 1).toUpperCase()}
                </Avatar>
                <Avatar
                  size={32}
                  icon={<CameraOutlined />}
                  style={{ position: 'absolute', right: -2, bottom: -2, background: '#fff', color: brand.ink, border: '2px solid #F4F4F8' }}
                />
              </div>
            </Upload>
            {logo.isPending ? <Typography.Text type="secondary">Uploading…</Typography.Text> : null}
            {vendor.logoUrl ? (
              <Button size="small" type="link" danger icon={<DeleteOutlined />} loading={removeLogo.isPending} onClick={() => removeLogo.mutate()}>
                Remove
              </Button>
            ) : null}
          </Flex>

          <Form
            key={vendor.updatedAt}
            layout="vertical"
            requiredMark={false}
            style={{ flex: 1, minWidth: 260 }}
            initialValues={{ name: vendor.name, contactEmail: vendor.contactEmail ?? '' }}
            onFinish={(v) => save.mutate(v)}
          >
            <Form.Item name="name" label="Shop name" rules={[{ required: true, whitespace: true, max: 120 }]}>
              <Input />
            </Form.Item>
            <Form.Item name="contactEmail" label="Contact email" rules={[{ type: 'email' }]}>
              <Input placeholder="hello@shop.com" />
            </Form.Item>
            <Form.Item label="Currency" extra="Set by dvote. Contact support to change it.">
              <Input value={vendor.currency} disabled />
            </Form.Item>
            {save.error ? <Alert type="error" showIcon message={errorMessage(save.error)} style={{ marginBottom: 12 }} /> : null}
            <Button type="primary" htmlType="submit" loading={save.isPending}>
              Save
            </Button>
          </Form>
        </Flex>
      </Card>
    </>
  );
}
