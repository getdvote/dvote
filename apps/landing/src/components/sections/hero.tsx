import { GiftIcon, RestartIcon, ScannerIcon, SendSquareIcon } from '@solar-icons/react/linear';
import { useEffect, useRef, useState } from 'react';
import { Container, FoundingPill, TrialButton } from '@/components/common';
import { IPhone } from '@/components/phones';
import { JoinScreen, Notification, SaveScreen, WalletStackScreen } from '@/components/screens';
import { fill, useI18n } from '@/i18n';
import { formatMoney, usePlans } from '@/lib/plans';
import { cn } from '@/lib/utils';

const PER_VISIT = 60; // an EGP 600 bill at 1 point per EGP 10
const GOAL = 300;
const FEED_ROWS = 5;

type Step = 'join' | 'save' | 'wallet';
type FeedKind = 'join' | 'save' | 'visit' | 'offer' | 'redeem';

/**
 * The hero is one working demo in two halves: the customer's phone and the owner's dashboard. The
 * dashboard starts empty, so every number on it is one the visitor made by pressing a button.
 */
function useDemo() {
  const [step, setStep] = useState<Step>('join');
  const [points, setPoints] = useState(0);
  const [stats, setStats] = useState({ visits: 0, points: 0, rewards: 0 });
  const [feed, setFeed] = useState<{ id: number; kind: FeedKind }[]>([]);
  const [chip, setChip] = useState(0); // bumps to replay the "+60" chip
  const [offer, setOffer] = useState(false);
  const [toast, setToast] = useState(false);
  const timers = useRef<number[]>([]);
  const nextId = useRef(0);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const log = (kind: FeedKind) => setFeed((rows) => [{ id: nextId.current++, kind }, ...rows].slice(0, FEED_ROWS));

  return {
    step,
    points,
    stats,
    feed,
    chip,
    offer,
    toast,
    join: () => {
      setStep('save');
      log('join');
    },
    save: () => {
      setStep('wallet');
      log('save');
    },
    visit: () => {
      setPoints((p) => Math.min(GOAL, p + PER_VISIT));
      setStats((s) => ({ ...s, visits: s.visits + 1, points: s.points + PER_VISIT }));
      setChip((c) => c + 1);
      later(() => setChip(0), 1200);
      log('visit');
    },
    redeem: () => {
      setPoints((p) => Math.max(0, p - GOAL));
      setStats((s) => ({ ...s, rewards: s.rewards + 1 }));
      setToast(true);
      log('redeem');
      later(() => setToast(false), 2600);
    },
    sendOffer: () => {
      setOffer(true);
      log('offer');
      later(() => setOffer(false), 4200);
    },
    restart: () => {
      timers.current.forEach(clearTimeout);
      setStep('join');
      setPoints(0);
      setStats({ visits: 0, points: 0, rewards: 0 });
      setFeed([]);
      setChip(0);
      setOffer(false);
      setToast(false);
    },
  };
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-xl border border-line p-3 sm:p-4">
      <p className="truncate text-[13px] text-muted-foreground">{label}</p>
      <p key={value} className="mt-1 animate-in text-[26px] leading-none font-semibold tabular-nums duration-300 fade-in-0 motion-reduce:animate-none" dir="ltr">
        {value.toLocaleString('en-US')}
      </p>
    </div>
  );
}

function LiveDemo() {
  const { d } = useI18n();
  const demo = useDemo();
  const inWallet = demo.step === 'wallet';
  const ready = demo.points >= GOAL;

  const chip =
    demo.chip > 0 ? (
      <span key={demo.chip} className="absolute -top-[6.5cqw] end-0 animate-in rounded-full bg-brand px-[2cqw] py-[0.6cqw] text-[2.8cqw] font-semibold whitespace-nowrap text-brand-foreground duration-500 fade-in-0 slide-in-from-bottom-2">
        +{PER_VISIT}
      </span>
    ) : null;

  const ctrl = 'flex h-11 items-center justify-center gap-2 rounded-full px-4 text-[14px] font-medium transition duration-150 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="rounded-[28px] bg-paper p-3 sm:p-5 lg:p-6">
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10 lg:pe-6">
        {/* the customer: first on phones, at the far side on large screens */}
        <IPhone interactive className="mx-auto mt-4 w-[72%] max-w-[280px] lg:order-2 lg:my-3 lg:w-full">
          <div key={demo.step} className="absolute inset-0 animate-in duration-500 fade-in-0 motion-reduce:animate-none">
            {demo.step === 'join' ? <JoinScreen onJoin={demo.join} /> : null}
            {demo.step === 'save' ? <SaveScreen onAdd={demo.save} /> : null}
            {inWallet ? (
              <WalletStackScreen
                points={demo.points}
                badge={chip}
                note={ready ? d.demo.rewardReady : undefined}
                action={
                  demo.toast ? (
                    <p className="mt-[3cqw] animate-in rounded-full bg-white px-[3.6cqw] py-[2.4cqw] text-center text-[3.4cqw] text-black shadow-sm duration-300 fade-in-0 zoom-in-95">{d.demo.redeemed}</p>
                  ) : null
                }
              />
            ) : null}
          </div>
          {/* the owner's offer dropping in over whatever is on screen */}
          <div
            className={cn(
              'absolute inset-x-[3cqw] top-[12cqw] z-40 transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
              demo.offer ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-[12cqw] opacity-0',
            )}
            aria-live="polite"
          >
            {demo.offer ? <Notification title={d.demo.offerTitle} text={d.demo.offerText} time={d.steps.screen.now} /> : null}
          </div>
        </IPhone>

        {/* the owner */}
        <div className="min-w-0 lg:order-1">
          <div className="px-2 pt-2 sm:px-1">
            <h2 className="text-[22px] leading-snug font-semibold text-balance sm:text-[26px]">{d.demo.title}</h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{d.demo.text}</p>
          </div>

          <div className="mt-5 rounded-2xl border border-line bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-semibold">{d.demo.dashboard}</p>
              <span className="rounded-full bg-paper px-2.5 py-0.5 text-[12px] text-muted-foreground">{d.demo.sample}</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
              <Stat label={d.demo.stats.members} value={demo.step === 'join' ? 0 : 1} />
              <Stat label={d.demo.stats.visits} value={demo.stats.visits} />
              <Stat label={d.demo.stats.points} value={demo.stats.points} />
              <Stat label={d.demo.stats.rewards} value={demo.stats.rewards} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {ready ? (
                <button type="button" onClick={demo.redeem} className={cn(ctrl, 'demo-tap bg-brand text-brand-foreground hover:bg-brand-hover')}>
                  <GiftIcon className="size-[18px] shrink-0" aria-hidden />
                  {d.demo.redeem}
                </button>
              ) : (
                <button type="button" onClick={demo.visit} disabled={!inWallet} className={cn(ctrl, 'bg-ink text-paper hover:bg-ink-soft')}>
                  <ScannerIcon className="size-[18px] shrink-0" aria-hidden />
                  {d.demo.visit}
                </button>
              )}
              <button type="button" onClick={demo.sendOffer} disabled={!inWallet} className={cn(ctrl, 'border border-line bg-white text-ink hover:border-ink/30')}>
                <SendSquareIcon className="size-[18px] shrink-0" aria-hidden />
                {d.demo.offer}
              </button>
            </div>

            {/* fixed height, so the page doesn't jump as rows arrive */}
            <div className="mt-4 h-[196px] overflow-hidden border-t border-line pt-1" aria-live="polite">
              {demo.feed.length === 0 ? (
                <p className="pt-4 text-[14px] leading-relaxed text-muted-foreground">{d.demo.empty}</p>
              ) : (
                <ul>
                  {demo.feed.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 border-b border-line/60 py-2 text-[14px] last:border-b-0 animate-in duration-300 fade-in-0 slide-in-from-top-1 motion-reduce:animate-none">
                      <span className="truncate">{d.demo.feed[row.kind]}</span>
                      <span className="shrink-0 text-[12px] text-muted-foreground">{d.steps.screen.now}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-1 flex justify-end">
              <button type="button" onClick={demo.restart} className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] text-muted-foreground transition duration-150 hover:bg-paper hover:text-ink">
                <RestartIcon className="size-4" aria-hidden />
                {d.demo.restart}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const { d, language } = useI18n();
  const plans = usePlans();
  const from = language === 'ar' ? `${formatMoney(plans.plans[0].monthly)} ج.م` : `${plans.currency} ${formatMoney(plans.plans[0].monthly)}`;

  return (
    <section id="top" className="scroll-mt-24 pt-10 pb-6 sm:pt-16">
      <Container>
        <FoundingPill />
        <h1 className="mt-6 max-w-[17ch] text-[42px] leading-[1.08] font-semibold tracking-[-0.03em] text-balance sm:text-[64px]">{d.hero.title}</h1>
        <p className="mt-5 max-w-[58ch] text-[17px] leading-relaxed text-pretty text-muted-foreground sm:text-[18px]">{d.hero.lead}</p>
        <div className="mt-8 flex flex-col gap-x-6 gap-y-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <TrialButton />
            <p className="max-w-[30ch] text-[13px] leading-snug text-muted-foreground">{fill(d.hero.note, { price: from })}</p>
          </div>
          <a href="#how" className="inline-flex h-12 items-center justify-center rounded-full border border-line px-6 text-[15px] font-medium transition duration-150 hover:border-ink/30">
            {d.hero.how}
          </a>
        </div>
        <div className="mt-10 sm:mt-12">
          <LiveDemo />
        </div>
      </Container>
    </section>
  );
}
