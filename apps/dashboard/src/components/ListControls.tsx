import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

/** Search box with a magnifier and a clear button. */
export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 pr-8 pl-9" aria-label={placeholder} />
      {value ? (
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}

/** "All / Active / Suspended"-style filter. */
export function StatusFilter<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label="Filter by status"
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className="h-9 px-3 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Previous / next with "Page 2 of 5". Hidden when everything fits on one page. */
export function Pager({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
      <span className="mr-2">
        Page {page} of {pages}
      </span>
      <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft />
      </Button>
      <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        <ChevronRight />
      </Button>
    </div>
  );
}
