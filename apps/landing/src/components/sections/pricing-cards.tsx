import { CheckIcon } from '@solar-icons/react/linear';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { fill, useI18n } from '@/i18n';
import { signupUrl } from '@/lib/config';
import { formatMoney, foundingPrice, MAX_BRANCHES, monthlyPrice, PLAN_IDS, planById, yearlyPrice, type Cycle, type Plan, type PlansData } from '@/lib/plans';
import { cn } from '@/lib/utils';

/** The three plans side by side. Each card has a branch slider (1–20); they move together. */
export function PricingCards({ data, cycle }: { data: PlansData; cycle: Cycle }) {
  const [branches, setBranches] = useState(1);
  return (
    <ul className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {PLAN_IDS.map((id, i) => (
        <PlanCard key={id} index={i} plan={planById(data, id)} data={data} cycle={cycle} branches={branches} setBranches={setBranches} />
      ))}
    </ul>
  );
}

function PlanCard({ plan, index, data, cycle, branches, setBranches }: { plan: Plan; index: number; data: PlansData; cycle: Cycle; branches: number; setBranches: (n: number) => void }) {
  const { d, language } = useI18n();
  const copy = d.pricing.plans[index];
  const popular = plan.id === 'loyal';
  const cur = language === 'ar' ? 'ج.م' : data.currency;
  const money = (n: number) => (language === 'ar' ? `${formatMoney(n)} ${cur}` : `${cur} ${formatMoney(n)}`);
  const foundingOpen = data.founding.open && data.founding.left > 0;
  const price = monthlyPrice(plan, cycle, branches);
  const founding = foundingOpen && cycle === 'monthly' ? foundingPrice(plan, branches) : null;
  const extra = cycle === 'annual' ? plan.extraBranch.annual : plan.extraBranch.monthly;
  const branchLabel = branches === 1 ? fill(d.pricing.branchCount, { count: 1 }) : fill(d.pricing.branchCountPlural, { count: branches });

  return (
    <li
      className={cn(
        'relative flex flex-col rounded-2xl border bg-white p-7 sm:p-8',
        popular ? 'border-ink shadow-[0_30px_60px_-30px_rgb(17_25_12/0.35)]' : 'border-line',
      )}
    >
      {popular ? (
        <span className="absolute -top-3.5 start-1/2 -translate-x-1/2 rounded-full bg-brand px-3.5 py-1 text-[12px] font-semibold text-ink ring-4 ring-white rtl:translate-x-1/2">
          {d.pricing.popular}
        </span>
      ) : null}
      <h3 className="text-[15px] font-semibold text-ink">{copy.name}</h3>
      <p className="mt-1.5 min-h-10 text-[14px] leading-snug text-muted-foreground">{copy.who}</p>

      <div className="mt-6">
        {founding !== null ? (
          <p className="text-[15px] text-muted-foreground line-through" data-testid={`list-${plan.id}`}>
            {money(price)}
          </p>
        ) : null}
        <p className="flex flex-wrap items-baseline gap-x-1">
          <span key={`${cycle}-${branches}`} className="animate-in text-[44px] leading-none font-semibold tracking-[-0.035em] tabular-nums duration-300 fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none" data-testid={`price-${plan.id}`}>
            {money(founding ?? price)}
          </span>
          <span className="text-[15px] text-muted-foreground">{d.pricing.perMonth}</span>
        </p>
        <p className="mt-2 text-[14px] text-muted-foreground">
          {founding !== null
            ? d.pricing.foundingPrice
            : cycle === 'annual'
              ? fill(d.pricing.perYear, { currency: cur, amount: formatMoney(yearlyPrice(plan, branches)) })
              : d.pricing.billedMonthly}
        </p>
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <div className="flex items-center justify-between text-[14px]">
          <span className="text-muted-foreground">{d.pricing.branches}</span>
          <span className="font-medium" data-testid={`branches-${plan.id}`}>
            {branchLabel}
          </span>
        </div>
        <Slider
          value={[branches]}
          min={1}
          max={MAX_BRANCHES}
          step={1}
          onValueChange={([n]) => setBranches(n)}
          dir={language === 'ar' ? 'rtl' : 'ltr'}
          className="mt-4"
          thumbLabel={`${copy.name} · ${d.pricing.branches}`}
          thumbValueText={branchLabel}
        />
        <div className="mt-2 flex justify-between px-[6px]" aria-hidden>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="size-1 rounded-full bg-black/15" />
          ))}
        </div>
        <p className="mt-3 text-[13px] text-muted-foreground">{fill(d.pricing.extraBranch, { currency: cur, amount: formatMoney(extra) })}</p>
      </div>

      <Button asChild size="xl" variant={popular ? 'default' : 'outline'} className="mt-6 w-full rounded-xl">
        <a href={signupUrl(plan.id, cycle)}>{d.pricing.cta}</a>
      </Button>
      <p className="mt-3 text-center text-[13px] text-muted-foreground">{fill(d.pricing.trialNote, { days: data.trialDays })}</p>

      <div className="mt-6 border-t border-line pt-6">
        <p className="text-[13px] text-muted-foreground">{copy.lead}</p>
        <ul className="mt-4 grid gap-3">
          {copy.features.map((f) => (
            <li key={f} className="flex gap-2.5 text-[15px] leading-snug">
              <CheckIcon className="mt-0.5 size-[18px] shrink-0 text-ink/70" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
