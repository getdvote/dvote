import type { ReactNode } from 'react';

/** Page title + one line of context on the left, actions on the right. */
export function PageHeader({ title, subtitle, extra }: { title: ReactNode; subtitle?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-muted-foreground">{subtitle}</p> : null}
      </div>
      {extra}
    </div>
  );
}

/** Small numbers formatted the same everywhere: 12,345. */
export const num = (n: number) => n.toLocaleString('en-US');

/** First letter for avatar fallbacks. */
export const initial = (s: string | null | undefined) => (s ?? '?').slice(0, 1).toUpperCase();
