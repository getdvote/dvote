import { CheckCircleIcon, CheckIcon, GiftIcon, RestartIcon, ScannerIcon, SendSquareIcon } from '@solar-icons/react/linear';
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, FoundingPill, TrialButton } from '@/components/common';
import { IPhone } from '@/components/phones';
import { JoinScreen, Notification, SaveScreen, WalletStackScreen } from '@/components/screens';
import { fill, useI18n } from '@/i18n';
import { whatsappLink } from '@/lib/config';
import { formatMoney, usePlans } from '@/lib/plans';
import { cn } from '@/lib/utils';

const PER_VISIT = 60; // a EGP 600 bill at 1 point per EGP 10
const GOAL = 300;

type Step = 'join' | 'save' | 'wallet';

/**
 * The hero phone is a working demo: join on the business page, add the card to the wallet, then the
 * buttons under the phone play the till (scan a visit, give the reward) and the owner (send an offer).
 */
function useDemo() {
  const [step, setStep] = useState<Step>('join');
  const [points, setPoints] = useState(0);
  const [chip, setChip] = useState(0); // bumps to replay the "+60" chip
  const [offer, setOffer] = useState(false);
  const [toast, setToast] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  return {
    step,
    points,
    chip,
    offer,
    toast,
    join: () => setStep('save'),
    save: () => setStep('wallet'),
    visit: () => {
      setPoints((p) => Math.min(GOAL, p + PER_VISIT));
      setChip((c) => c + 1);
    },
    redeem: () => {
      setPoints((p) => Math.max(0, p - GOAL));
      setToast(true);
      later(() => setToast(false), 2600);
    },
    sendOffer: () => {
      setOffer(true);
      later(() => setOffer(false), 4200);
    },
    restart: () => {
      timers.current.forEach(clearTimeout);
      setStep('join');
      setPoints(0);
      setOffer(false);
      setToast(false);
    },
  };
}

function DemoPhone() {
  const { d } = useI18n();
  const demo = useDemo();
  const inWallet = demo.step === 'wallet';
  const ready = demo.points >= GOAL;
  const stepIndex = demo.step === 'join' ? 0 : demo.step === 'save' ? 1 : ready ? 3 : 2;

  const chip =
    demo.chip > 0 ? (
      <span key={demo.chip} className="absolute -top-[6.5cqw] end-0 animate-in rounded-full bg-brand px-[2cqw] py-[0.6cqw] text-[2.8cqw] font-semibold whitespace-nowrap text-ink duration-500 fade-in-0 slide-in-from-bottom-2">
        +{PER_VISIT}
      </span>
    ) : null;

  const ctrl = 'flex h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-[14px] font-medium transition duration-150 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="relative isolate overflow-hidden rounded-[24px] bg-paper px-4 pt-6 pb-5 sm:px-8">
      <div aria-hidden className="absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)]" style={{ backgroundImage: 'radial-gradient(#e7cda2 1.1px, transparent 1.3px)', backgroundSize: '18px 18px' }} />

      {/* where the visitor is in the flow */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-[13px] font-medium text-ink">{d.demo.label}</p>
        <ol className="flex flex-wrap justify-center gap-1.5">
          {d.demo.steps.map((label, i) => (
            <li
              key={label}
              aria-current={i === stepIndex ? 'step' : undefined}
              className={cn(
                'flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium transition duration-300',
                i < stepIndex ? 'bg-ink/10 text-ink' : i === stepIndex ? 'bg-ink text-paper' : 'bg-white text-muted-foreground',
              )}
            >
              {i < stepIndex ? <CheckIcon className="size-3" aria-hidden /> : null}
              {label}
            </li>
          ))}
        </ol>
      </div>

      <IPhone interactive className="mx-auto mt-5 w-[74%] max-w-[270px]">
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
            'absolute inset-x-[3cqw] top-[12cqw] z-40 transition duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
            demo.offer ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-[12cqw] opacity-0',
          )}
          aria-live="polite"
        >
          {demo.offer ? <Notification title={d.demo.offerTitle} text={d.demo.offerText} time={d.steps.screen.now} /> : null}
        </div>
      </IPhone>

      {/* the till and the owner */}
      <div className="mt-5 grid gap-2">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={demo.visit} disabled={!inWallet || ready} className={cn(ctrl, 'bg-ink text-paper hover:bg-ink-soft')}>
            <ScannerIcon className="size-[18px]" aria-hidden />
            {d.demo.visit}
          </button>
          {ready ? (
            <button type="button" onClick={demo.redeem} className={cn(ctrl, 'demo-tap bg-brand text-ink hover:bg-brand-hover')}>
              <GiftIcon className="size-[18px]" aria-hidden />
              {d.demo.redeem}
            </button>
          ) : (
            <button type="button" onClick={demo.sendOffer} className={cn(ctrl, 'border border-line bg-white text-ink hover:border-ink/30')}>
              <SendSquareIcon className="size-[18px]" aria-hidden />
              {d.demo.offer}
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 px-1 text-[12px] text-muted-foreground">
          <span aria-live="polite">{inWallet ? d.demo.visitNote : d.demo.tapHint}</span>
          <button type="button" onClick={demo.restart} className="flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-ink/70 transition duration-150 hover:bg-ink/5 hover:text-ink">
            <RestartIcon className="size-4" aria-hidden />
            {d.demo.restart}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const { d, language } = useI18n();
  const plans = usePlans();
  const from = language === 'ar' ? `${formatMoney(plans.plans[0].monthly)} ج.م` : `${plans.currency} ${formatMoney(plans.plans[0].monthly)}`;
  const facts = [fill(d.hero.from, { price: from }), fill(d.hero.trial, { days: plans.trialDays }), d.hero.languages];

  return (
    <section id="top" className="scroll-mt-20 px-4 pt-14 pb-16 sm:px-8 sm:pt-20 lg:px-12 lg:pb-12">
      <div className="mx-auto grid max-w-[1160px] items-center gap-14 lg:grid-cols-[1fr_minmax(0,480px)]">
        <div>
          <FoundingPill />
          <h1 className="mt-7 text-[42px] leading-[1.03] font-semibold tracking-[-0.035em] text-balance sm:text-[60px] lg:text-[64px]">{d.hero.title}</h1>
          <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-pretty text-muted-foreground">
            <span className="font-medium text-ink">{d.hero.accent}</span> {d.hero.lead}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <TrialButton />
            <ExternalLink href={whatsappLink(d.contact.whatsappMessage)} className="inline-flex h-12 items-center justify-center rounded-xl px-5 text-[15px] font-medium text-ink underline decoration-line decoration-2 underline-offset-[6px] transition duration-150 hover:decoration-ink">
              {d.hero.talk}
            </ExternalLink>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t-2 border-dotted border-line pt-6 text-[14px] text-muted-foreground">
            {facts.map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <CheckCircleIcon className="size-4 text-ink/60" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <DemoPhone />
      </div>
    </section>
  );
}
