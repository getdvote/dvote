import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Empty, Flex, Image, Popconfirm, Select, Typography, Upload } from 'antd';
import { useState } from 'react';
import { api, errorMessage, type VendorImage } from '../../lib/api';
import { brand } from '../../theme';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/heic';

/** Menu pages (shown on the shop page in order) and photos per branch. */
export function ImagesTab({ vendorId }: { vendorId: string }) {
  const { data: images, isLoading, error } = useQuery({ queryKey: ['images', vendorId], queryFn: () => api.images(vendorId) });
  const { data: branches } = useQuery({ queryKey: ['branches', vendorId], queryFn: () => api.branches(vendorId) });
  const [branchId, setBranchId] = useState<string | undefined>();
  const openBranches = (branches ?? []).filter((b) => b.status === 'active');
  const chosen = branchId ?? openBranches[0]?.id;

  return (
    <Flex vertical gap={28}>
      {error ? <Alert type="error" showIcon message={errorMessage(error)} /> : null}
      <Section
        title="Menu pages"
        hint="Up to 20 pages, shown in this order. Portrait photos of the printed menu work best."
        vendorId={vendorId}
        kind="menu"
        images={(images ?? []).filter((i) => i.kind === 'menu')}
        loading={isLoading}
      />
      <div>
        <Flex align="center" gap={12} wrap style={{ marginBottom: 4 }}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Branch photos
          </Typography.Title>
          {openBranches.length ? (
            <Select
              value={chosen}
              onChange={setBranchId}
              style={{ minWidth: 220 }}
              options={openBranches.map((b) => ({ value: b.id, label: b.name }))}
            />
          ) : null}
        </Flex>
        {chosen ? (
          <Section
            hint="Up to 10 photos per branch."
            vendorId={vendorId}
            kind="branch_photo"
            branchId={chosen}
            images={(images ?? []).filter((i) => i.kind === 'branch_photo' && i.branchId === chosen)}
            loading={isLoading}
          />
        ) : (
          <Typography.Text type="secondary">Add an open branch first.</Typography.Text>
        )}
      </div>
    </Flex>
  );
}

function Section({
  title,
  hint,
  vendorId,
  kind,
  branchId,
  images,
  loading,
}: {
  title?: string;
  hint: string;
  vendorId: string;
  kind: VendorImage['kind'];
  branchId?: string;
  images: VendorImage[];
  loading: boolean;
}) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const refresh = () => void qc.invalidateQueries({ queryKey: ['images', vendorId] });
  const upload = useMutation({
    mutationFn: (file: File) => api.uploadImage(vendorId, file, kind, branchId),
    onSuccess: () => {
      refresh();
      void message.success('Uploaded');
    },
    onError: (e) => void message.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteImage(vendorId, id),
    onSuccess: () => {
      refresh();
      void message.success('Deleted');
    },
    onError: (e) => void message.error(errorMessage(e)),
  });

  return (
    <div>
      {title ? (
        <Typography.Title level={5} style={{ marginBottom: 4 }}>
          {title}
        </Typography.Title>
      ) : null}
      <Flex justify="space-between" align="center" gap={12} wrap style={{ marginBottom: 14 }}>
        <Typography.Text type="secondary">{hint}</Typography.Text>
        <Upload accept={ACCEPT} multiple showUploadList={false} customRequest={({ file }) => upload.mutate(file as File)}>
          <Button icon={<UploadOutlined />} loading={upload.isPending}>
            Upload
          </Button>
        </Upload>
      </Flex>
      {!loading && images.length === 0 ? (
        <Empty description="Nothing uploaded yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Image.PreviewGroup>
          <Flex gap={14} wrap>
            {images.map((img, i) => (
              <div key={img.id} style={{ position: 'relative' }}>
                <Image
                  src={img.url}
                  width={kind === 'menu' ? 150 : 200}
                  height={kind === 'menu' ? 210 : 140}
                  style={{ objectFit: 'cover', borderRadius: 12, background: '#EEE' }}
                />
                <Flex
                  justify="space-between"
                  align="center"
                  style={{ position: 'absolute', left: 8, right: 8, bottom: 8, pointerEvents: 'none' }}
                >
                  <span style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, padding: '1px 8px', borderRadius: 999 }}>
                    {i + 1}
                  </span>
                  <Popconfirm title="Delete this image?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => remove.mutateAsync(img.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} style={{ pointerEvents: 'auto', background: '#fff', borderColor: brand.red }} />
                  </Popconfirm>
                </Flex>
              </div>
            ))}
          </Flex>
        </Image.PreviewGroup>
      )}
    </div>
  );
}
