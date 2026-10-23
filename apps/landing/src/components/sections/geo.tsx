import { CupHotIcon, RestartIcon, UserIcon } from '@solar-icons/react/linear';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pixel } from '@/components/phones';
import { AndroidLockScreen, Notification } from '@/components/screens';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

/** Street blocks of the map (x, y, w, h in a 100 × 80 box). */
const BLOCKS = [
  [2, 2, 20, 14], [25, 2, 24, 14], [52, 2, 14, 14], [69, 2, 29, 14],
  [2, 19, 20, 18], [25, 19, 24, 8], [25, 30, 24, 7], [52, 19, 14, 18], [69, 19, 13, 18], [85, 19, 13, 18],
  [2, 40, 20, 15], [25, 40, 24, 15], [52, 40, 14, 6], [52, 49, 14, 6], [69, 40, 29, 15],
  [2, 58, 20, 20], [25, 58, 24, 20], [52, 58, 14, 20], [69, 58, 29, 20],
];

/** Where things sit on the map, in % of its box. */
const CAFE = { x: 36, y: 36 };
const WALK = [
  { x: 16, y: 90 }, // far away
  { x: 24, y: 55 }, // inside the orbit
];

/**
 * The phases of the scene: 0 walking in, 1 inside the orbit (the phone wakes),
 * 2 notification shown, then it loops. Runs only while on screen; reduced motion shows phase 2.
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
    const t: number[] = [];
    const loop = () => {
      setPhase(-1);
      t.push(window.setTimeout(() => setPhase(0), 80));
      t.push(window.setTimeout(() => setPhase(1), 2600));
      t.push(window.setTimeout(() => setPhase(2), 3300));
      t.push(window.setTimeout(loop, 8200));
    };
    loop();
    return () => t.forEach(clearTimeout);
  }, [visible, reduced, run]);

  const replay = useCallback(() => setRun((n) => n + 1), []);
  return { ref, phase, replay, reduced };
}

/** "They're nearby": numbered steps, and the animated map with an Android lock screen. */
export function Geo() {
  const { d, language } = useI18n();
  const g = d.geo;
  const { ref, phase, replay, reduced } = useScene();
  const at = phase >= 0 ? WALK[1] : WALK[0];

  return (
    <section className="px-1.5 py-1.5 md:px-3 md:py-3">
      <div className="relative isolate overflow-hidden rounded-[20px] bg-ink px-5 py-16 text-paper sm:px-10 sm:py-24 md:rounded-[24px]">
        <div className="mx-auto grid max-w-[1120px] items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-[44px]">{g.title}</h2>
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-paper/70">{g.lead}</p>
            <ol className="mt-10 grid">
              {g.steps.map((s, i) => (
                <li key={s.title} className="relative flex gap-4 pb-7 last:pb-0">
                  {i < g.steps.length - 1 ? <span className="absolute start-[15px] top-9 bottom-1 border-s-2 border-dotted border-paper/20" aria-hidden /> : null}
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold transition duration-500',
                      phase >= i ? 'bg-brand text-ink' : 'bg-paper/10 text-paper',
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="pt-0.5">
                    <h3 className="text-[17px] font-semibold">{s.title}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-paper/65">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <ul className="mt-9 flex flex-wrap gap-2">
              {g.pills.map((p) => (
                <li key={p} className="rounded-full bg-paper/[0.08] px-3.5 py-1.5 text-[13px] text-paper/80">
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div ref={ref}>
            <div className="relative aspect-[1/1] overflow-hidden rounded-[20px] bg-[#18210f] ring-1 ring-paper/10 sm:aspect-[5/4]" dir="ltr" aria-hidden>
              <svg viewBox="0 0 100 80" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
                {BLOCKS.map(([x, y, w, h], i) => (
                  <rect key={i} x={x} y={y} width={w} height={h} rx="1.4" fill="#1f2a18" />
                ))}
                <path d="M-4 66 L64 -4" stroke="#26331d" strokeWidth="3.4" />
                <path d={`M16 92 Q 16 68 24 55`} stroke="#ff5500" strokeOpacity="0.35" strokeWidth="0.45" strokeDasharray="1.1 1.1" fill="none" />
              </svg>

              {/* the orbit: lime rings radiating from the café (the brand pattern, here meaning "nearby") */}
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn('absolute aspect-square w-[58%] rounded-full border-[1.5px] border-brand/70', reduced ? 'hidden' : 'animate-orbit-out')}
                  style={{ left: `${CAFE.x}%`, top: `${CAFE.y}%`, animationDelay: `${i * 1.6}s` }}
                />
              ))}
              <span
                className={cn(
                  'absolute aspect-square w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-dashed transition duration-700',
                  phase >= 1 ? 'border-brand bg-brand/[0.08]' : 'border-paper/25 bg-transparent',
                )}
                style={{ left: `${CAFE.x}%`, top: `${CAFE.y}%` }}
              />

              <div className="absolute grid -translate-x-1/2 -translate-y-1/2 justify-items-center gap-1.5 text-[12px] font-medium text-paper" style={{ left: `${CAFE.x}%`, top: `${CAFE.y}%` }}>
                <span className="flex size-11 items-center justify-center rounded-full bg-brand text-ink shadow-[0_0_0_6px_rgb(255_85_0/0.15)]">
                  <CupHotIcon className="size-5" />
                </span>
                <span className="rounded-md bg-ink/70 px-1.5">{g.venue}</span>
              </div>

              {/* the member walking in */}
              <div
                className="absolute grid -translate-x-1/2 -translate-y-1/2 justify-items-center gap-1.5 text-[12px] text-paper/80 ease-[cubic-bezier(0.45,0,0.2,1)]"
                style={{ left: `${at.x}%`, top: `${at.y}%`, transition: phase === -1 ? 'none' : 'left 2.4s, top 2.4s' }}
              >
                <span className={cn('flex size-8 items-center justify-center rounded-full border-2 bg-ink transition duration-500', phase >= 1 ? 'border-brand text-brand' : 'border-paper/50 text-paper')}>
                  <UserIcon className="size-4" />
                </span>
                <span className="rounded-md bg-ink/70 px-1.5 whitespace-nowrap">{g.customer}</span>
              </div>

              {/* their phone: dim until they are nearby, then the card comes up */}
              <div className="absolute right-[4%] -bottom-[16%] w-[38%] sm:-bottom-[22%] sm:w-[34%]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                <Pixel className="w-full" tone="light">
                  <AndroidLockScreen date={g.date}>
                    <div
                      className={cn(
                        'transition duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                        phase >= 2 ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-[10cqw] scale-95 opacity-0',
                      )}
                    >
                      <Notification platform="android" app="Google Wallet" title={g.notifTitle} text={g.notifText} time={d.steps.screen.now} />
                    </div>
                  </AndroidLockScreen>
                  <span className={cn('pointer-events-none absolute inset-0 rounded-[13.5%/6.4%] bg-black transition-opacity duration-700', phase >= 1 ? 'opacity-0' : 'opacity-60')} />
                </Pixel>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-[13px] text-paper/55">{g.caption}</p>
              {!reduced ? (
                <button type="button" onClick={replay} className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-paper/70 transition duration-150 hover:bg-paper/10 hover:text-paper">
                  <RestartIcon className="size-4" aria-hidden />
                  {g.replay}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
