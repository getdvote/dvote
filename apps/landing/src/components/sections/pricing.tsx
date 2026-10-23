import { AltArrowDownIcon, CalendarIcon, QrCodeIcon, ShieldCheckIcon } from '@solar-icons/react/linear';
import { useState } from 'react';
import { Container, Reveal, Section, SectionHeading } from '@/components/common';
import { CompareTable } from '@/components/sections/compare-table';
import { FoundingBanner } from '@/components/sections/founding-banner';
import { PricingCards } from '@/components/sections/pricing-cards';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { fill, useI18n } from '@/i18n';
import { usePlans, type Cycle } from '@/lib/plans';
import { cn } from '@/lib/utils';

const INCLUDED_ICONS = [QrCodeIcon, CalendarIcon, ShieldCheckIcon];

/** Pricing: cycle switch, Founding banner, the plan cards, what every plan includes, full comparison. */
export function Pricing() {
  const { d } = useI18n();
  const data = usePlans();
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [compare, setCompare] = useState(false);
  return (
    <Section id="pricing">
      <Container>
        <SectionHeading center title={d.pricing.title} lead={fill(d.pricing.lead, { days: data.trialDays })} />
        <div className="mt-9 flex justify-center">
          <ToggleGroup type="single" value={cycle} onValueChange={(v) => v && setCycle(v as Cycle)} className="rounded-full border border-line bg-white p-1" aria-label={`${d.pricing.monthly} / ${d.pricing.annual}`}>
            <ToggleGroupItem value="monthly" className="h-10 rounded-full px-5 text-[15px] data-[state=on]:bg-black/[0.06] data-[state=on]:font-medium">
              {d.pricing.monthly}
            </ToggleGroupItem>
            <ToggleGroupItem value="annual" className="h-10 gap-2 rounded-full px-5 text-[15px] data-[state=on]:bg-black/[0.06] data-[state=on]:font-medium">
              {d.pricing.annual}
              <span className="text-[13px] text-brand-text">{d.pricing.save}</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="mt-10">
          <FoundingBanner data={data} />
        </div>
        <Reveal className="mt-8">
          <PricingCards data={data} cycle={cycle} />
        </Reveal>
        <p className="mt-6 text-center text-[13px] text-muted-foreground">{d.pricing.vat}</p>

        <ul className="mt-14 grid grid-cols-1 gap-6 border-y border-line py-8 md:grid-cols-3">
          {d.pricing.included.map((it, i) => {
            const I = INCLUDED_ICONS[i];
            return (
              <li key={it.title} className="flex gap-3">
                <I className="mt-0.5 size-5 shrink-0 text-ink/70" aria-hidden />
                <div>
                  <p className="text-[15px] font-medium">{fill(it.title, { days: data.trialDays })}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{it.text}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setCompare((v) => !v)}
            aria-expanded={compare}
            aria-controls="compare"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-5 text-[15px] transition duration-100 hover:border-black/20"
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
