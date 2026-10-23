import { CrownStarIcon } from '@solar-icons/react/linear';
import { fill, useI18n } from '@/i18n';
import type { PlansData } from '@/lib/plans';

/** "First 10 merchants: 30% off for 6 months — N spots left"; hidden when closed or full. */
export function FoundingBanner({ data }: { data: PlansData }) {
  const { d } = useI18n();
  const f = data.founding;
  if (!f.open || f.left <= 0) return null;
  const taken = Math.min(f.total, Math.max(0, f.total - f.left));
  return (
    <div id="founding" className="flex scroll-mt-24 flex-col gap-5 rounded-[24px] border border-line bg-white p-5 sm:flex-row sm:items-center sm:p-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-ink text-brand">
        <CrownStarIcon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[17px]">{d.pricing.foundingTitle}</p>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{fill(d.pricing.foundingText, { total: f.total })}</p>
      </div>
      <div className="shrink-0 sm:w-48">
        <p className="text-[13px] font-medium" data-testid="founding-left">{fill(d.pricing.foundingLeft, { left: f.left, total: f.total })}</p>
        {f.total <= 20 ? (
          <div className="mt-2 flex gap-1" aria-hidden>
            {Array.from({ length: f.total }, (_, i) => (
              <span key={i} className={i < taken ? 'h-1.5 flex-1 rounded-full bg-black/10' : 'h-1.5 flex-1 rounded-full bg-ink'} />
            ))}
          </div>
        ) : (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10" aria-hidden>
            <div className="ms-auto h-full rounded-full bg-ink" style={{ width: `${(f.left / f.total) * 100}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
