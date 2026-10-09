import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmAction } from '../../components/ConfirmAction';
import { ErrorAlert } from '../../components/ErrorAlert';
import { errorMessage, type VendorImage } from '../../lib/api';
import type { VendorScope } from '../../lib/scope';

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/heic';

/** Menu pages (shown on the shop page in order) and photos per branch. */
export function ImagesTab({ scope }: { scope: VendorScope }) {
  const { data: images, isLoading, error } = useQuery({ queryKey: ['images', scope.key], queryFn: () => scope.images() });
  const { data: branches } = useQuery({ queryKey: ['branches', scope.key], queryFn: () => scope.branches() });
  const [branchId, setBranchId] = useState<string | undefined>();
  const openBranches = (branches ?? []).filter((b) => b.status === 'active');
  const chosen = branchId ?? openBranches[0]?.id;

  return (
    <div className="grid gap-8">
      <ErrorAlert error={error} />
      <Section
        title="Menu pages"
        hint="Up to 20 pages, shown in this order. Portrait photos of the printed menu work best."
        scope={scope}
        kind="menu"
        canEdit={scope.can.editVendor}
        images={(images ?? []).filter((i) => i.kind === 'menu')}
        loading={isLoading}
      />
      <Section
        title="Branch photos"
        titleExtra={
          openBranches.length ? (
            <Select value={chosen} onValueChange={setBranchId}>
              <SelectTrigger className="min-w-56" aria-label="Branch">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {openBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
        hint={chosen ? 'Up to 10 photos per branch.' : 'Add an open branch first.'}
        scope={scope}
        kind="branch_photo"
        canEdit={!!chosen && scope.can.branchPhotos(chosen)}
        branchId={chosen}
        images={(images ?? []).filter((i) => i.kind === 'branch_photo' && i.branchId === chosen)}
        loading={isLoading}
      />
    </div>
  );
}

function Section({
  title,
  titleExtra,
  hint,
  scope,
  kind,
  branchId,
  images,
  loading,
  canEdit,
}: {
  title: string;
  titleExtra?: React.ReactNode;
  hint: string;
  scope: VendorScope;
  kind: VendorImage['kind'];
  branchId?: string;
  images: VendorImage[];
  loading: boolean;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['images', scope.key] });
  const upload = useMutation({
    mutationFn: (file: File) => scope.uploadImage(file, kind, branchId),
    onSuccess: () => {
      refresh();
      toast.success('Uploaded');
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => scope.deleteImage(id),
    onSuccess: () => {
      refresh();
      toast.success('Deleted');
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const canUpload = kind === 'menu' || !!branchId;
  const size = kind === 'menu' ? 'h-52 w-37' : 'h-36 w-50';

  return (
    <section>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h3 className="font-semibold">{title}</h3>
        {titleExtra}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{hint}</p>
        {canUpload && canEdit ? (
          <>
            <Button variant="outline" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
              {upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />} Upload
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                for (const file of Array.from(e.target.files ?? [])) upload.mutate(file);
                e.target.value = '';
              }}
            />
          </>
        ) : null}
      </div>
      {!canUpload ? null : loading ? (
        <div className="flex flex-wrap gap-3.5">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className={`${size} rounded-xl`} />
          ))}
        </div>
      ) : images.length === 0 ? (
        <Empty className="border border-dashed py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ImageIcon />
            </EmptyMedia>
            <EmptyDescription>Nothing uploaded yet</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-wrap gap-3.5">
          {images.map((img, i) => (
            <div key={img.id} className="group relative">
              <button
                type="button"
                className={`${size} overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50`}
                onClick={() => setViewing(i)}
                aria-label={`View image ${i + 1}`}
              >
                <img src={img.url} alt="" className="size-full object-cover transition-transform group-hover:scale-[1.02]" />
              </button>
              <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between">
                <span className="rounded-full bg-black/60 px-2 py-px text-xs text-white">{i + 1}</span>
                {canEdit ? (
                <ConfirmAction
                  title="Delete this image?"
                  description="It is removed from the shop page and can't be recovered."
                  actionLabel="Delete"
                  onConfirm={() => remove.mutateAsync(img.id)}
                  trigger={
                    <Button size="icon-sm" variant="outline" className="pointer-events-auto bg-card text-destructive hover:text-destructive" aria-label="Delete image">
                      <Trash2 />
                    </Button>
                  }
                />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
      <ImageViewer images={images} index={viewing} onChange={setViewing} />
    </section>
  );
}

/** Full-size view with previous / next (arrow keys work too). */
function ImageViewer({ images, index, onChange }: { images: VendorImage[]; index: number | null; onChange: (i: number | null) => void }) {
  const img = index !== null ? images[index] : undefined;
  const go = (d: number) => index !== null && images.length && onChange((index + d + images.length) % images.length);
  return (
    <Dialog open={!!img} onOpenChange={(o) => !o && onChange(null)}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] bg-transparent p-0 ring-0 sm:max-w-3xl"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(1);
          if (e.key === 'ArrowLeft') go(-1);
        }}
      >
        <DialogTitle className="sr-only">Image {index !== null ? index + 1 : ''}</DialogTitle>
        {img ? <img src={img.url} alt="" className="max-h-[85vh] w-full rounded-xl object-contain" /> : null}
        {images.length > 1 ? (
          <div className="flex items-center justify-center gap-3">
            <Button variant="secondary" size="icon" aria-label="Previous image" onClick={() => go(-1)}>
              <ChevronLeft />
            </Button>
            <span className="text-sm text-white tabular-nums">
              {(index ?? 0) + 1} / {images.length}
            </span>
            <Button variant="secondary" size="icon" aria-label="Next image" onClick={() => go(1)}>
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
