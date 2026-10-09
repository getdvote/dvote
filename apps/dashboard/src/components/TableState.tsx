import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';

/** Loading skeleton rows, or one "nothing here" row, inside a <TableBody>. Renders nothing when there's data. */
export function TableState({ loading, empty, colSpan, emptyText }: { loading: boolean; empty: boolean; colSpan: number; emptyText: string }) {
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
      <TableCell colSpan={colSpan} className="h-28 text-center text-muted-foreground">
        {emptyText}
      </TableCell>
    </TableRow>
  );
}
