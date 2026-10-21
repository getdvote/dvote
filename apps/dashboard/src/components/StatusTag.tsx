import { Badge } from '@/components/ui/badge';
import { t } from '../i18n';

type Variant = 'success' | 'destructive' | 'muted';

const MAP = {
  active: 'success',
  suspended: 'destructive',
  closed: 'muted',
  archived: 'muted',
  disabled: 'destructive',
  blocked: 'destructive',
} satisfies Record<string, Variant>;

/** One colour per status, used by every list (vendors, branches, rewards, staff, customers). */
export function StatusTag({ status }: { status: string }) {
  const known = status in MAP ? (status as keyof typeof MAP) : null;
  return (
    <Badge variant={known ? MAP[known] : 'muted'} className="font-semibold">
      {known ? t(`status.${known}`) : status}
    </Badge>
  );
}
