import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';
import { BrandIllustration, type IllustrationName } from './BrandArt';

/**
 * Loading skeleton rows, or one "nothing here" row, inside a <TableBody>. Renders nothing when there's data.
 * An empty table should say what will appear and how to get there: give `emptyTitle` + `emptyText`
 * (what fills it) and an `action` (the next step), e.g. "Add branch" or "Clear filters".
 * `illustration` adds a brand scene for a first-run empty table; leave it out for "no matches".
 */
export function TableState({
  loading,
  empty,
  colSpan,
  emptyText,
  emptyTitle,
  action,
  illustration,
}: {
  loading: boolean;
  empty: boolean;
  colSpan: number;
  emptyText: string;
  emptyTitle?: string;
  action?: ReactNode;
  illustration?: IllustrationName;
}) {
  if (loading) {
    return Array.from({ length: 4 }, (_, i) => (
      <TableRow key={i} className="hover:bg-transparent">
        <TableCell colSpan={colSpan}>
          <Skeleton className="h-8 w-full" />
        </TableCell>
      </TableRow>
    ));
  }
  if (!empty) return null;
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="h-28 py-10 text-center whitespace-normal">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-1.5">
          {illustration ? <BrandIllustration name={illustration} size="sm" className="mb-2" /> : null}
          {emptyTitle ? <p className="font-medium text-foreground">{emptyTitle}</p> : null}
          <p className="text-muted-foreground">{emptyText}</p>
          {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
