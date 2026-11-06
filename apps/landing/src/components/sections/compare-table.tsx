import { CheckCircleIcon, MinusCircleIcon } from '@solar-icons/react/linear';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

function Value({ v }: { v: string }) {
  const { d } = useI18n();
  if (v === 'yes')
    return (
      <span className="inline-flex text-ink">
        <CheckCircleIcon className="size-5" aria-hidden />
        <span className="sr-only">{d.pricing.yes}</span>
      </span>
    );
  if (v === 'no')
    return (
      <span className="inline-flex text-muted-foreground/60">
        <MinusCircleIcon className="size-5" aria-hidden />
        <span className="sr-only">{d.pricing.no}</span>
      </span>
    );
  return <span>{v}</span>;
}

/** Full plan comparison: a table from md, one accordion per plan on phones. */
export function CompareTable() {
  const { d } = useI18n();
  const names = d.pricing.plans.map((p) => p.name);
  return (
    <div>

        <div className="hidden rounded-[24px] border border-line bg-white md:block">
          <table className="w-full table-fixed border-separate border-spacing-0 text-start text-[15px]">
            <caption className="sr-only">{d.pricing.compareTitle}</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky top-[76px] z-10 w-[34%] rounded-ss-[24px] border-b border-line bg-white px-6 py-4 text-start text-[13px] font-medium text-muted-foreground">
                  {d.pricing.feature}
                </th>
                {names.map((n, i) => (
                  <th key={n} scope="col" className={cn('sticky top-[76px] z-10 border-b border-line bg-white px-6 py-4 text-start text-[15px] font-medium', i === 2 && 'rounded-se-[24px]', i === 1 && 'bg-[#fafaf8]')}>
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.pricing.compare.map((row) => (
                <tr key={row.label} className="[&:not(:first-child)>*]:border-t [&>*]:border-line">
                  <th scope="row" className="px-6 py-3.5 align-top text-start text-[14px] font-normal">{row.label}</th>
                  {row.values.map((v, i) => (
                    <td key={i} className={cn('px-6 py-3.5 align-top text-[14px] text-muted-foreground', i === 1 && 'bg-[#fafaf8]')}>
                      <Value v={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Accordion type="multiple" defaultValue={['1']} className="grid gap-3 md:hidden">
          {names.map((n, p) => (
            <AccordionItem key={n} value={String(p)} className="rounded-[20px] border border-line bg-white px-5 not-last:border-b">
              <AccordionTrigger className="py-4 text-[17px] font-medium hover:no-underline">{n}</AccordionTrigger>
              <AccordionContent className="pb-4">
                <dl className="grid divide-y divide-black/[0.06]">
                  {d.pricing.compare.map((row) => (
                    <div key={row.label} className="py-3 text-[14px]">
                      <dt className="text-muted-foreground">{row.label}</dt>
                      <dd className="mt-1 font-medium">
                        <Value v={row.values[p]} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
    </div>
  );
}
