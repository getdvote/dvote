import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Label above a control, optional hint below: the one form row layout used by every dialog. */
export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** "" → undefined, otherwise the number (for optional number inputs). */
export const optionalNumber = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim();
  return s === '' ? undefined : Number(s);
};
