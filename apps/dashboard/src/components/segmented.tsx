import type { ComponentType } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

/** Two or three options in a grey track, the picked one raised (QR poster size, till scan mode…). */
export function Segmented<T extends string>({
  id,
  value,
  onChange,
  options,
  label,
  size = 'sm',
}: {
  id?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ComponentType<{ className?: string }> }[];
  label?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <ToggleGroup
      id={id}
      type="single"
      spacing={1}
      value={value}
      aria-label={label}
      onValueChange={(v) => v && onChange(v as T)}
      className="w-full rounded-lg bg-muted p-1"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className={cn(
            'flex-1 gap-2 rounded-md border border-transparent text-muted-foreground transition duration-100 ease-linear hover:bg-transparent hover:text-foreground data-[state=on]:border-border data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-xs dark:data-[state=on]:bg-input/30',
            size === 'md' ? 'h-9' : 'h-8',
          )}
        >
          {o.icon ? <o.icon className="size-4" /> : null}
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
