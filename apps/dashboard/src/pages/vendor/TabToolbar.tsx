import type { ReactNode } from 'react';

/** One line of guidance on the left, the tab's main action on the right. */
export function TabToolbar({ hint, children }: { hint: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{hint}</p>
      {children}
    </div>
  );
}
