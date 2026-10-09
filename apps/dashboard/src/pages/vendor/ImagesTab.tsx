import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ImageIcon, Loader2, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmAction } from '../../components/ConfirmAction';
import { ErrorAlert } from '../../components/ErrorAlert';
import { errorMessage, type VendorImage } from '../../lib/api';
import type { VendorScope } from '../../lib/scope';

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/heic';

/** Same limits as the API (vendor-images.service.ts). */
const MAX_MENU_IMAGES = 20;
export const MAX_BRANCH_PHOTOS = 3;

/** Branch photos sit three to a row (as in the app). */
const BRANCH_GRID = 'grid grid-cols-3 gap-3';
const BRANCH_TILE = 'aspect-[4/3] w-full';

/** Menu pages, shown on the shop page in order. (Branch photos live on the Branches page.) */
export function ImagesTab({ scope }: { scope: VendorScope }) {
  const { data: images, isLoading, error } = useQuery({ queryKey: ['images', scope.key], queryFn: () => scope.images() });

  return (
    <div className="grid gap-8">
      <ErrorAlert error={error} />
      <Section
        title="Menu pages"
        hint={`Up to ${MAX_MENU_IMAGES} pages, shown in this order. Portrait photos of the printed menu work best.`}
        scope={scope}
        kind="menu"
        max={MAX_MENU_IMAGES}
        canEdit={scope.can.editVendor}
        images={(images ?? []).filter((i) => i.kind === 'menu')}
        loading={isLoading}
      />
    </div>
  );
}

/** One branch's photos (shown with directions on the shop page). Used on the Branches page. */
export function BranchPhotos({ scope, branchId }: { scope: VendorScope; branchId: string }) {
  const { data: images, isLoading, error } = useQuery({ queryKey: ['images', scope.key], queryFn: () => scope.images() });
  const canEdit = scope.can.branchPhotos(branchId);
  return (
    <div className="grid gap-4">
      <ErrorAlert error={error} />
      <Section
        hint={canEdit ? `Up to ${MAX_BRANCH_PHOTOS} photos per branch.` : 'Only this branch\x27s manager or the vendor admin can change these.'}
        scope={scope}
        kind="branch_photo"
        max={MAX_BRANCH_PHOTOS}
        canEdit={canEdit}
        branchId={branchId}
        images={(images ?? []).filter((i) => i.kind === 'branch_photo' && i.branchId === branchId)}
        loading={isLoading}
      />
    </div>
  );
}

/**
 * Photos for a branch that doesn't exist yet: picked and previewed here, uploaded by the
 * caller once the branch is created.
 */
export function StagedBranchPhotos({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const room = MAX_BRANCH_PHOTOS - files.length;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Up to {MAX_BRANCH_PHOTOS} photos. They upload when you add the branch.</p>
        <Button type="button" variant="outline" disabled={room <= 0} onClick={() => fileInput.current?.click()}>
          <Upload /> Upload
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length > room) toast.error(`Only ${MAX_BRANCH_PHOTOS} allowed: keeping the first ${room}.`);
            onChange([...files, ...picked.slice(0, room)]);
            e.target.value = '';
          }}
        />
      </div>
      {files.length === 0 ? (
        <Empty className="border border-dashed py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ImageIcon />
            </EmptyMedia>
            <EmptyDescription>No photos yet</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className={BRANCH_GRID}>
          {urls.map((url, i) => (
            <div key={url} className="relative">
              <img src={url} alt="" className={`${BRANCH_TILE} rounded-xl bg-muted object-cover`} />
              <div className="absolute inset-x-2 bottom-2 flex items-center justify-between">
                <span className="rounded-full bg-black/60 px-2 py-px text-xs text-white">{i + 1}</span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  className="bg-card"
                  aria-label="Remove photo"
                  onClick={() => onChange(files.filter((_, j) => j !== i))}
                >
                  <X />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Section({
  title,
  titleExtra,
  hint,
  scope,
  kind,
  max,
  branchId,
  images,
  loading,
  canEdit,
}: {
  title?: string;
  titleExtra?: React.ReactNode;
  hint: string;
  scope: VendorScope;
  kind: VendorImage['kind'];
  max: number;
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
  const room = max - images.length;
  const size = kind === 'menu' ? 'h-52 w-37' : BRANCH_TILE;
  const grid = kind === 'menu' ? 'flex flex-wrap gap-3.5' : BRANCH_GRID;

  return (
    <section>
      {title || titleExtra ? (
        <div className="mb-1 flex flex-wrap items-center gap-3">
          {title ? <h3 className="font-semibold">{title}</h3> : null}
          {titleExtra}
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{hint}</p>
        {canUpload && canEdit ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={upload.isPending || loading || room <= 0}
              title={room <= 0 ? `Limit of ${max} reached: delete one to upload another` : undefined}
              onClick={() => fileInput.current?.click()}
            >
              {upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />} Upload
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > room) toast.error(`Only ${max} allowed: uploading the first ${room}.`);
                for (const file of files.slice(0, room)) upload.mutate(file);
                e.target.value = '';
              }}
            />
          </>
        ) : null}
      </div>
      {!canUpload ? null : loading ? (
        <div className={grid}>
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
        <div className={grid}>
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
                    <Button type="button" size="icon-sm" variant="outline" className="pointer-events-auto bg-card text-destructive hover:text-destructive" aria-label="Delete image">
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
