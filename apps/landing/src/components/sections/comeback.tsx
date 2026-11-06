import { CupHotIcon, RestartIcon, UserIcon } from '@solar-icons/react/linear';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Container, Reveal, Section, SectionHeading } from '@/components/common';
import { IPhone, Pixel } from '@/components/phones';
import { AndroidLockScreen, IosLockScreen, Notification } from '@/components/screens';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

/** Street blocks of the map (x, y, w, h in a 100 × 80 box). */
const BLOCKS = [
  [2, 2, 20, 14], [25, 2, 24, 14], [52, 2, 14, 14], [69, 2, 29, 14],
  [2, 19, 20, 18], [25, 19, 24, 8], [25, 30, 24, 7], [52, 19, 14, 18], [69, 19, 13, 18], [85, 19, 13, 18],
  [2, 40, 20, 15], [25, 40, 24, 15], [52, 40, 14, 6], [52, 49, 14, 6], [69, 40, 29, 15],
  [2, 58, 20, 20], [25, 58, 24, 20], [52, 58, 14, 20], [69, 58, 29, 20],
];
const SHOP = { x: 36, y: 34 };
const WALK = [
  { x: 14, y: 88 }, // far away
  { x: 24, y: 52 }, // close by
];

/**
 * 0 walking in, 1 close by (the phone wakes), 2 card shown. Plays once each time it comes on screen
 * or on Play again, then holds. Reduced motion shows the end state.
 */
function useScene() {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState(reduced ? 2 : -1);
  const [visible, setVisible] = useState(false);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  useEffect(() => {
    if (!visible || reduced) return;
    setPhase(-1);
    const t = [window.setTimeout(() => setPhase(0), 80), window.setTimeout(() => setPhase(1), 2500), window.setTimeout(() => setPhase(2), 3100)];
    return () => t.forEach(clearTimeout);
  }, [visible, reduced, run]);

  const replay = useCallback(() => setRun((n) => n + 1), []);
  return { ref, phase, replay, reduced };
}

function NearbyScene() {
  const { d, language } = useI18n();
  const n = d.comeback.nearby;
  const { ref, phase, replay, reduced } = useScene();
  const at = phase >= 0 ? WALK[1] : WALK[0];
  return (
    <div ref={ref}>
      <div className="relative aspect-[5/4] overflow-hidden rounded-[20px] bg-white" dir="ltr" aria-hidden>
        <svg viewBox="0 0 100 80" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
          {BLOCKS.map(([x, y, w, h], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} rx="1.4" fill="#f8f4f1" />
          ))}
        </svg>
        <span
          className={cn(
            'absolute aspect-square w-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-dashed transition duration-700',
            phase >= 1 ? 'border-blue bg-blue/[0.06]' : 'border-ink/20 bg-transparent',
          )}
          style={{ left: `${SHOP.x}%`, top: `${SHOP.y}%` }}
        />
        <div className="absolute grid -translate-x-1/2 -translate-y-1/2 justify-items-center gap-1 text-[12px] font-medium text-ink" style={{ left: `${SHOP.x}%`, top: `${SHOP.y}%` }}>
          <span className="flex size-10 items-center justify-center rounded-full bg-blue text-white">
            <CupHotIcon className="size-5" />
          </span>
          <span className="rounded-md bg-white/85 px-1.5" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            {n.venue}
          </span>
        </div>
        <div
          className="absolute grid -translate-x-1/2 -translate-y-1/2 justify-items-center gap-1 text-[12px] text-muted-foreground ease-[cubic-bezier(0.45,0,0.2,1)]"
          style={{ left: `${at.x}%`, top: `${at.y}%`, transition: phase === -1 ? 'none' : 'left 2.4s, top 2.4s' }}
        >
          <span className={cn('flex size-8 items-center justify-center rounded-full border-2 bg-white transition duration-500', phase >= 1 ? 'border-blue text-blue' : 'border-ink/30 text-ink')}>
            <UserIcon className="size-4" />
          </span>
          <span className="rounded-md bg-white/85 px-1.5 whitespace-nowrap" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            {n.customer}
          </span>
        </div>
        <div className="absolute right-[5%] -bottom-[38%] w-[36%]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <Pixel className="w-full" tone="light">
            <AndroidLockScreen date={n.date} wallpaper="#1b2433">
              <div className={cn('transition duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]', phase >= 2 ? 'translate-y-0 opacity-100' : '-translate-y-[8cqw] opacity-0')}>
                <Notification platform="android" app="Google Wallet" title={d.wallet.shop} text={n.notif} time={d.steps.screen.now} />
              </div>
            </AndroidLockScreen>
            <span className={cn('pointer-events-none absolute inset-0 bg-black transition-opacity duration-700', phase >= 1 ? 'opacity-0' : 'opacity-60')} />
          </Pixel>
        </div>
      </div>
      <div className="mt-2 flex min-h-9 items-center justify-between gap-4">
        <p className="text-[12px] text-muted-foreground">{n.caption}</p>
        {!reduced ? (
          <button type="button" onClick={replay} className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground transition duration-150 hover:bg-white hover:text-ink">
            <RestartIcon className="size-4" aria-hidden />
            {n.replay}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** SMS vs WhatsApp vs a wallet notification: a table from md, stacked rows on phones. */
function ChannelCompare() {
  const { d } = useI18n();
  const c = d.compare;
  const wallet = c.channels.length - 1;
  return (
    <div className="mt-20 sm:mt-24">
      <h3 className="max-w-[24ch] text-[26px] leading-snug font-semibold tracking-[-0.02em] text-balance sm:text-[34px]">{c.title}</h3>
      <table className="mt-8 hidden w-full table-fixed border-collapse text-start md:table">
        <caption className="sr-only">{c.caption}</caption>
        <thead>
          <tr className="border-b border-ink/15">
            <th scope="col" className="w-[25%]" />
            {c.channels.map((ch, i) => (
              <th key={ch} scope="col" className={cn('px-5 py-3 text-start text-[14px] font-semibold', i === wallet ? 'text-brand-text' : 'text-muted-foreground')}>
                {ch}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {c.rows.map((row) => (
            <tr key={row.label} className="border-b border-line">
              <th scope="row" className="py-5 pe-6 text-start align-top text-[15px] font-medium">
                {row.label}
              </th>
              {row.values.map((v, i) => (
                <td key={i} className={cn('px-5 py-5 align-top text-[15px] leading-relaxed', i === wallet ? 'font-medium text-ink' : 'text-muted-foreground')}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-8 grid border-t border-line md:hidden">
        {c.rows.map((row) => (
          <div key={row.label} className="border-b border-line py-5">
            <p className="text-[15px] font-semibold">{row.label}</p>
            <dl className="mt-3 grid gap-2">
              {row.values.map((v, i) => (
                <div key={i} className={cn('grid grid-cols-[6.5rem_1fr] gap-3 text-[14px] leading-snug', i === wallet ? 'font-medium text-ink' : 'text-muted-foreground')}>
                  <dt className={i === wallet ? 'text-brand-text' : undefined}>{c.channels[i]}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Bringing them back: the lock-screen message, the nearby reminder, then what it costs against SMS and WhatsApp. */
export function Comeback() {
  const { d } = useI18n();
  const c = d.comeback;
  return (
    <Section id="comeback">
      <Container>
        <SectionHeading title={c.title} lead={c.lead} />
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col rounded-[24px] bg-paper p-6 sm:p-8">
            <h3 className="text-[20px] font-semibold">{c.message.title}</h3>
            <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">{c.message.text}</p>
            <Reveal className="relative mt-8 h-[380px] overflow-hidden rounded-[20px] bg-white pt-8">
              <IPhone className="mx-auto w-[280px]" tone="light">
                <IosLockScreen date={c.message.date} top={<Notification className="pop" title={d.wallet.shop} text={c.message.notif} time={d.steps.screen.now} />} />
              </IPhone>
            </Reveal>
          </div>
          <div className="flex flex-col rounded-[24px] bg-paper p-6 sm:p-8">
            <h3 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[20px] font-semibold">
              {c.nearby.title}
              <span className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-medium text-muted-foreground">{c.nearby.plan}</span>
            </h3>
            <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">{c.nearby.text}</p>
            <div className="mt-8">
              <NearbyScene />
            </div>
          </div>
        </div>
        <ChannelCompare />
      </Container>
    </Section>
  );
}
