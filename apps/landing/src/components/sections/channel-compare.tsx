import { ChatRoundDotsIcon, ChatSquareIcon, WalletIcon } from '@solar-icons/react/linear';
import { Container, Reveal, Section } from '@/components/common';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

const ICONS = [ChatSquareIcon, ChatRoundDotsIcon, WalletIcon];
const WALLET = 2;

/** SMS vs WhatsApp vs a wallet notification: a table from md, stacked rows on phones. */
export function ChannelCompare() {
  const { d } = useI18n();
  const c = d.compare;
  return (
    <Section className="pt-4 sm:pt-8">
      <Container>
        <h2 className="mx-auto max-w-4xl text-center text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{c.title}</h2>
        <Reveal className="mt-14 hidden md:block">
          <table className="w-full table-fixed border-separate border-spacing-0 text-start">
            <caption className="sr-only">{c.caption}</caption>
            <thead>
              <tr>
                <th scope="col" className="w-[25%] border-b border-line" />
                {c.channels.map((ch, i) => {
                  const I = ICONS[i];
                  return (
                    <th key={ch} scope="col" className={cn('border-b border-line px-5 py-4 text-start text-[13px] font-medium', i === WALLET ? 'rounded-t-2xl border-ink bg-ink text-paper [&_svg]:text-brand' : 'text-muted-foreground')}>
                      <span className="inline-flex items-center gap-2">
                        <I className="size-[18px]" aria-hidden />
                        {ch}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {c.rows.map((row, r) => (
                <tr key={row.label}>
                  <th scope="row" className="border-b border-line py-6 pe-6 text-start align-top text-[16px] font-normal">
                    {row.label}
                  </th>
                  {row.values.map((v, i) => (
                    <td
                      key={i}
                      className={cn(
                        'border-b px-5 py-6 align-top text-[15px] leading-relaxed',
                        i === WALLET ? 'border-ink/10 bg-paper font-medium text-ink' : 'border-line text-muted-foreground',
                        i === WALLET && r === c.rows.length - 1 && 'rounded-b-2xl border-b-0',
                      )}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
        <div className="mt-10 grid gap-3 md:hidden">
          {c.rows.map((row) => (
            <div key={row.label} className="rounded-2xl border border-line bg-white p-5">
              <p className="text-[16px]">{row.label}</p>
              <dl className="mt-3 grid gap-2.5">
                {row.values.map((v, i) => (
                  <div key={i} className={cn('grid grid-cols-[6.5rem_1fr] gap-3 text-[14px] leading-snug', i === WALLET ? 'rounded-lg bg-ink px-2.5 py-2 text-paper' : 'text-muted-foreground')}>
                    <dt className="font-medium">{c.channels[i]}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
