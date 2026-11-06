import { AltArrowDownIcon } from '@solar-icons/react/linear';
import { useState } from 'react';
import { Container, Section, SectionHeading } from '@/components/common';
import { CompareTable } from '@/components/sections/compare-table';
import { FoundingBanner } from '@/components/sections/founding-banner';
import { PricingCards } from '@/components/sections/pricing-cards';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { fill, useI18n } from '@/i18n';
import { usePlans, type Cycle } from '@/lib/plans';
import { cn } from '@/lib/utils';

/** Pricing: cycle switch, Launch Partners banner, the plan cards, full comparison on request. */
export function Pricing() {
  const { d } = useI18n();
  const data = usePlans();
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [compare, setCompare] = useState(false);
  return (
    <Section id="pricing">
      <Container>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading title={d.pricing.title} lead={fill(d.pricing.lead, { days: data.trialDays })} />
          <ToggleGroup type="single" value={cycle} onValueChange={(v) => v && setCycle(v as Cycle)} className="shrink-0 self-start rounded-full border border-line bg-white p-1 md:self-end" aria-label={`${d.pricing.monthly} / ${d.pricing.annual}`}>
            <ToggleGroupItem value="monthly" className="h-10 rounded-full px-5 text-[15px] data-[state=on]:bg-paper data-[state=on]:font-medium">
              {d.pricing.monthly}
            </ToggleGroupItem>
            <ToggleGroupItem value="annual" className="h-10 gap-2 rounded-full px-5 text-[15px] data-[state=on]:bg-paper data-[state=on]:font-medium">
              {d.pricing.annual}
              <span className="text-[13px] text-brand-text">{d.pricing.save}</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="mt-10">
          <FoundingBanner data={data} />
        </div>
        <div className="mt-6">
          <PricingCards data={data} cycle={cycle} />
        </div>
        <p className="mt-6 text-[13px] text-muted-foreground">{d.pricing.vat}</p>

        <div className="mt-8">
          <button
            type="button"
            onClick={() => setCompare((v) => !v)}
            aria-expanded={compare}
            aria-controls="compare"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-white px-5 text-[15px] transition duration-100 hover:border-ink/30"
          >
            {d.pricing.compareToggle}
            <AltArrowDownIcon className={cn('size-4 transition duration-200', compare && 'rotate-180')} aria-hidden />
          </button>
        </div>
        <div id="compare" hidden={!compare} className="mt-8 scroll-mt-24">
          <CompareTable />
        </div>
      </Container>
    </Section>
  );
}
