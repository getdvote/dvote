import { Badge } from '@/components/ui/badge';

type Variant = 'success' | 'destructive' | 'muted';

const MAP: Record<string, { variant: Variant; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  suspended: { variant: 'destructive', label: 'Suspended' },
  closed: { variant: 'muted', label: 'Closed' },
  archived: { variant: 'muted', label: 'Archived' },
  disabled: { variant: 'destructive', label: 'Disabled' },
  blocked: { variant: 'destructive', label: 'Blocked' },
};

/** One colour per status, used by every list (vendors, branches, rewards, staff, customers). */
export function StatusTag({ status }: { status: string }) {
  const s = MAP[status] ?? { variant: 'muted', label: status };
  return (
    <Badge variant={s.variant} className="font-semibold">
      {s.label}
    </Badge>
  );
}
