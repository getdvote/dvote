import { BellIcon, ChartIcon, GiftIcon, HomeIcon, ScannerIcon, UsersGroupRoundedIcon } from '@solar-icons/react/linear';
import { CheckItem, Container, IconTile, Reveal, Section, SectionHeading } from '@/components/common';
import { DvoteLogo } from '@/components/dvote-logo';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

const ICONS = [GiftIcon, UsersGroupRoundedIcon, BellIcon, ScannerIcon];
const NAV_ICONS = [HomeIcon, ScannerIcon, GiftIcon, ChartIcon, UsersGroupRoundedIcon];
const LINE = [38, 44, 41, 52, 49, 58, 55, 63, 61, 70, 68, 77];
const PREV = [34, 36, 38, 37, 41, 40, 44, 43, 46, 47, 49, 51];

const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (arr.length - 1)) * 100} ${100 - v}`).join(' ');

/** The merchant dashboard as on its sign-in screen: an ink sidebar and the Insights page, tilted. */
function DashboardPicture() {
  const { d } = useI18n();
  const m = d.platform.mock;
  return (
    <div className="[perspective:1800px]" aria-hidden>
      <div className="origin-top-left overflow-hidden rounded-2xl border border-line bg-white shadow-[0_40px_80px_-40px_rgb(17_25_12/0.45)] transition duration-700 [transform:rotateY(-10deg)_rotateX(4deg)_rotateZ(-1deg)] hover:[transform:none] rtl:origin-top-right rtl:[transform:rotateY(10deg)_rotateX(4deg)_rotateZ(1deg)] rtl:hover:[transform:none]">
        <div className="grid grid-cols-[150px_1fr] max-sm:grid-cols-1">
          <div className="grid content-start gap-1 bg-ink p-3 text-[12px] text-paper max-sm:hidden">
            <DvoteLogo height={15} className="mb-3 ms-1 text-paper" />
            {m.nav.map((label, i) => {
              const I = NAV_ICONS[i];
              return (
                <span key={label} className={cn('flex items-center gap-2 rounded-md px-2 py-1.5', i === 3 ? 'bg-brand font-medium text-ink' : 'text-paper/70')}>
                  <I className="size-4" />
                  {label}
                </span>
              );
            })}
          </div>
          <div className="p-5">
            <p className="text-[15px] font-semibold">{m.title}</p>
            <p className="text-[12px] text-muted-foreground">{m.sub}</p>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {[
                { l: m.sales, v: '48,230', c: '+12%' },
                { l: m.visits, v: '1,284', c: '+8%' },
                { l: m.repeat, v: '46%', c: '+5%' },
              ].map((k) => (
                <div key={k.l} className="min-w-0 rounded-xl border border-line p-3">
                  <p className="truncate text-[11px] text-muted-foreground">{k.l}</p>
                  <p className="mt-1 text-[18px] font-semibold tabular-nums" dir="ltr">
                    {k.v}
                  </p>
                  <span className="text-[11px] font-medium text-success">{k.c}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-line p-3">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-36 w-full rtl:-scale-x-100">
                <path d={path(PREV)} fill="none" stroke="#787664" strokeWidth="1.2" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                <path d={path(LINE)} fill="none" stroke="#18100f" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One dashboard: the tilted product shot, then what's in it. */
export function Platform() {
  const { d } = useI18n();
  const p = d.platform;
  return (
    <Section id="features">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading title={p.title} lead={p.lead} />
          <Reveal className="relative isolate overflow-hidden rounded-[24px] bg-paper p-6 sm:p-10">
            <div aria-hidden className="absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)]" style={{ backgroundImage: 'radial-gradient(#cfcabe 1.1px, transparent 1.3px)', backgroundSize: '18px 18px' }} />
            <DashboardPicture />
          </Reveal>
        </div>
        <Reveal className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {p.groups.map((g, i) => (
            <div key={g.title} className="bg-white p-6 sm:p-7">
              <IconTile icon={ICONS[i]} />
              <h3 className="mt-5 text-[17px] font-semibold">{g.title}</h3>
              <ul className="mt-4 grid gap-3">
                {g.items.map((it) => (
                  <CheckItem key={it}>{it}</CheckItem>
                ))}
              </ul>
            </div>
          ))}
        </Reveal>
      </Container>
    </Section>
  );
}
