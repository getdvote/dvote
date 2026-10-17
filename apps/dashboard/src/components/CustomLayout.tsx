import { ArrowDownIcon as ArrowDown, ArrowUpIcon as ArrowUp } from '@solar-icons/react/linear';
import { useCallback, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { t } from '../i18n';

/** Widths on a 12-column grid (large screens; smaller screens always stack full width). */
export const SIZES = ['third', 'half', 'twoThirds', 'full'] as const;
export type Size = (typeof SIZES)[number];
const SPAN: Record<Size, string> = { third: 'lg:col-span-4', half: 'lg:col-span-6', twoThirds: 'lg:col-span-8', full: 'lg:col-span-12' };

export interface LayoutSection {
  key: string;
  title: string;
  /** The narrowest it may be, so its content still fits. */
  min: Size;
  /** Start size (default full). */
  size?: Size;
  node: ReactNode;
}

interface Saved {
  order: string[];
  sizes: Record<string, Size>;
}

const atLeast = (size: Size, min: Size) => (SIZES.indexOf(size) < SIZES.indexOf(min) ? min : size);

/**
 * A page made of sections the user can reorder and resize, saved in this browser (`storageKey`).
 * Sections added later go to the end; removed ones are dropped; a size below a section's minimum
 * is raised to it.
 */
export function useCustomLayout(storageKey: string) {
  const [saved, setSaved] = useState<Saved | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Saved) : null;
    } catch {
      return null;
    }
  });
  const [editing, setEditing] = useState(false);

  const store = useCallback(
    (next: Saved | null) => {
      setSaved(next);
      try {
        if (next) localStorage.setItem(storageKey, JSON.stringify(next));
        else localStorage.removeItem(storageKey);
      } catch {
        // private mode: kept for this visit only
      }
    },
    [storageKey],
  );

  return { saved, store, editing, setEditing, reset: () => store(null) };
}

export function CustomLayout({ sections, layout }: { sections: LayoutSection[]; layout: ReturnType<typeof useCustomLayout> }) {
  const { saved, store, editing } = layout;
  const known = new Map(sections.map((s) => [s.key, s]));
  const order = [...(saved?.order ?? []).filter((k) => known.has(k)), ...sections.map((s) => s.key).filter((k) => !saved?.order.includes(k))];
  const sizeOf = (s: LayoutSection) => atLeast(saved?.sizes[s.key] ?? s.size ?? 'full', s.min);

  const save = (nextOrder: string[], sizes: Record<string, Size>) => store({ order: nextOrder, sizes });
  const allSizes = () => Object.fromEntries(sections.map((s) => [s.key, sizeOf(s)]));
  const move = (key: string, by: -1 | 1) => {
    const i = order.indexOf(key);
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    save(next, allSizes());
  };
  const resize = (key: string, size: Size) => save(order, { ...allSizes(), [key]: size });

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {order.map((key, i) => {
        const s = known.get(key)!;
        const size = sizeOf(s);
        return (
          <section
            key={key}
            aria-label={s.title}
            className={cn('@container flex min-w-0 flex-col', SPAN[size], editing && 'rounded-2xl p-2 outline-2 outline-primary/25 outline-dashed')}
          >
            {editing ? (
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-muted px-2 py-1.5">
                <span className="me-auto truncate ps-1 text-sm font-medium">{s.title}</span>
                <div role="group" aria-label={t('layout.size')} className="flex items-center rounded-full bg-foreground/[0.06] p-0.5">
                  {SIZES.filter((z) => SIZES.indexOf(z) >= SIZES.indexOf(s.min)).map((z) => (
                    <button
                      key={z}
                      type="button"
                      aria-pressed={size === z}
                      onClick={() => resize(key, z)}
                      className="h-7 rounded-full px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-xs"
                    >
                      {t(`layout.sizes.${z}`)}
                    </button>
                  ))}
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={t('layout.moveUp')} disabled={i === 0} onClick={() => move(key, -1)}>
                  <ArrowUp />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={t('layout.moveDown')} disabled={i === order.length - 1} onClick={() => move(key, 1)}>
                  <ArrowDown />
                </Button>
              </div>
            ) : null}
            {/* sections bring their own bottom margin from the stacked layout: the grid gap replaces it */}
            <div className="flex min-w-0 flex-1 flex-col [&>*]:mb-0 [&>*:last-child]:flex-1">{s.node}</div>
          </section>
        );
      })}
    </div>
  );
}
