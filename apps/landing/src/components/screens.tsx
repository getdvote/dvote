import { AddIcon, CheckCircleIcon, CupHotIcon, LockIcon, MagnifierIcon, MenuDotsIcon, SmartphoneVibrationIcon } from '@solar-icons/react/linear';
import type { CSSProperties } from 'react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

/*
 * What the phones show (pictures, not live data). Every size is in cqw (percent of the screen
 * width), so the same screen works in a large hero phone and a small step-card phone.
 */

/** The example café's colours (a merchant picks their own; dvote's lime is not on customer cards). */
const CAFE = { bg: '#3b2a20', fg: '#f6e9d8', soft: '#d9b88f' };

/** Deterministic QR-like pattern with the three finder squares. */
export function QrGlyph({ className, seed = 7 }: { className?: string; seed?: number }) {
  const n = 21;
  const cells: [number, number][] = [];
  let x = seed;
  const finder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (finder(r, c)) continue;
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      if (x % 100 < 47) cells.push([r, c]);
    }
  const box = (r: number, c: number) => (
    <g key={`${r}-${c}`}>
      <rect x={c} y={r} width="7" height="7" rx="1.2" fill="currentColor" />
      <rect x={c + 1} y={r + 1} width="5" height="5" rx="0.8" fill="#fff" />
      <rect x={c + 2} y={r + 2} width="3" height="3" rx="0.5" fill="currentColor" />
    </g>
  );
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} className={cn('text-black', className)} aria-hidden>
      <rect x="-1" y="-1" width={n + 2} height={n + 2} rx="1.5" fill="#fff" />
      {cells.map(([r, c]) => (
        <rect key={`${r}.${c}`} x={c + 0.06} y={r + 0.06} width="0.88" height="0.88" rx="0.2" fill="currentColor" />
      ))}
      {box(0, 0)}
      {box(0, n - 7)}
      {box(n - 7, 0)}
    </svg>
  );
}

/** The example café's wallet pass (Apple style): logo, points, progress, member, QR. */
export function CafePass({ points = 240, goal = 300, qr = true, className, note, badge }: { points?: number; goal?: number; qr?: boolean; className?: string; note?: string; badge?: React.ReactNode }) {
  const { d } = useI18n();
  const w = d.wallet;
  const pct = Math.min(100, Math.round((points / goal) * 100));
  return (
    <div className={cn('rounded-[3.4cqw] p-[4.4cqw] shadow-[0_2cqw_6cqw_-2cqw_rgb(0_0_0/0.35)]', className)} style={{ background: CAFE.bg, color: CAFE.fg }}>
      <div className="flex items-center justify-between gap-[2cqw]">
        <span className="flex min-w-0 items-center gap-[2.2cqw]">
          <span className="flex size-[8cqw] shrink-0 items-center justify-center rounded-full" style={{ background: CAFE.fg, color: CAFE.bg }}>
            <CupHotIcon className="size-[4.6cqw]" />
          </span>
          <span className="truncate font-serif text-[5.4cqw] italic">{w.shop}</span>
        </span>
        <span className="text-end">
          <span className="block text-[2.4cqw] tracking-[0.12em]" style={{ color: CAFE.soft }}>
            {w.pointsLabel}
          </span>
          <span className="relative block text-[5.4cqw] leading-none font-medium tabular-nums" dir="ltr">
            {points}
            {badge}
          </span>
        </span>
      </div>
      <div className="mt-[4.5cqw] h-[1.6cqw] overflow-hidden rounded-full" style={{ background: 'rgb(246 233 216 / 0.18)' }}>
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: CAFE.fg }} />
      </div>
      <div className="mt-[4cqw] flex items-end justify-between gap-[2cqw] text-[2.4cqw]">
        <span className="min-w-0">
          <span className="block tracking-[0.12em]" style={{ color: CAFE.soft }}>
            {w.holderLabel}
          </span>
          <span className="block truncate text-[3.5cqw]">{w.holder}</span>
        </span>
        <span className="min-w-0 text-end">
          <span className="block tracking-[0.12em]" style={{ color: CAFE.soft }}>
            {w.rewardLabel}
          </span>
          <span className="block truncate text-[3.5cqw]">{note ?? w.reward}</span>
        </span>
      </div>
      {qr ? (
        <div className="mx-auto mt-[5cqw] w-[30cqw] rounded-[2cqw] bg-white p-[1.6cqw]">
          <QrGlyph className="w-full" />
        </div>
      ) : null}
    </div>
  );
}

const PASS_COLOURS = [
  'linear-gradient(135deg,#1f4f86,#2f6db3)', // bank card
  '#1c1c1e',
  '#7a3b16',
  '#f2b632',
];
const PASS_TEXT = ['#fff', '#fff', '#fbe7d3', '#2b1d05'];

/** The Wallet app with other passes stacked on top of the café's card (hero). */
export function WalletStackScreen({ animate = true, points = 240, badge, note, action }: { animate?: boolean; points?: number; badge?: React.ReactNode; note?: string; action?: React.ReactNode }) {
  const { d } = useI18n();
  return (
    <div className="absolute inset-0 bg-[#f2f2f7] px-[4.5cqw] pt-[15cqw]">
      <div className="flex items-center justify-between">
        <span className="text-[8.4cqw] font-bold tracking-tight text-black">{d.wallet.title}</span>
        <span className="flex items-center gap-[2cqw]">
          <span className="flex size-[9.5cqw] items-center justify-center rounded-full bg-white text-black shadow-sm">
            <AddIcon className="size-[5cqw]" />
          </span>
          <span className="flex h-[9.5cqw] items-center gap-[4cqw] rounded-full bg-white px-[3.6cqw] text-black shadow-sm">
            <MagnifierIcon className="size-[4.4cqw]" />
            <MenuDotsIcon className="size-[4.4cqw]" />
          </span>
        </span>
      </div>
      <div className="mt-[5cqw]">
        {d.wallet.passes.map((p, i) => (
          <div
            key={p.name}
            className={cn('-mb-[2.6cqw] flex h-[14.2cqw] items-start justify-between rounded-t-[3.4cqw] px-[4.4cqw] pt-[2.8cqw]', animate && 'animate-pass-in')}
            style={{ background: PASS_COLOURS[i], color: PASS_TEXT[i], animationDelay: `${i * 70}ms` } as CSSProperties}
          >
            <span className={cn('text-[4.4cqw] font-semibold tracking-tight', i === 0 && 'tracking-[0.04em]')}>{p.name}</span>
            {p.label ? (
              <span className="text-end leading-tight">
                <span className="block text-[2.2cqw] tracking-[0.12em] opacity-75">{p.label}</span>
                <span className="block text-[3.6cqw]">{p.value}</span>
              </span>
            ) : (
              <SmartphoneVibrationIcon className="size-[4cqw] opacity-70" />
            )}
          </div>
        ))}
        <CafePass points={points} badge={badge} note={note} className={cn('relative', animate && 'animate-pass-in')} />
        {action}
      </div>
      <span className="absolute bottom-[2.4cqw] left-1/2 h-[1.3cqw] w-[36cqw] -translate-x-1/2 rounded-full bg-black/80" />
    </div>
  );
}

/** A notification card (iOS or Android look). */
export function Notification({ title, text, time, platform = 'ios', className, app }: { title: string; text: string; time: string; platform?: 'ios' | 'android'; className?: string; app?: string }) {
  return (
    <div
      className={cn(
        'flex gap-[3cqw] p-[3.6cqw] text-black shadow-[0_2cqw_6cqw_-2cqw_rgb(0_0_0/0.3)]',
        platform === 'ios' ? 'rounded-[5cqw] bg-white/85 backdrop-blur-md' : 'rounded-[6cqw] bg-[#f4f1ea]',
        className,
      )}
    >
      <span className="flex size-[9cqw] shrink-0 items-center justify-center rounded-[2.4cqw]" style={{ background: CAFE.bg, color: CAFE.fg }}>
        <CupHotIcon className="size-[5cqw]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-[2cqw]">
          <span className="truncate text-[3.7cqw] font-semibold">{app ?? title}</span>
          <span className="shrink-0 text-[3cqw] text-black/50">{time}</span>
        </span>
        {app ? <span className="block text-[3.6cqw] font-semibold">{title}</span> : null}
        <span className="mt-[0.4cqw] block text-[3.5cqw] leading-snug text-black/80">{text}</span>
      </span>
    </div>
  );
}

/** iPhone lock screen: lock, date, big clock, optional notification near the bottom. */
export function IosLockScreen({ date, children, top, wallpaper = 'linear-gradient(170deg,#1b2433 0%,#233b5c 45%,#5a6f8f 100%)' }: { date: string; children?: React.ReactNode; top?: React.ReactNode; wallpaper?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center text-white" style={{ background: wallpaper }}>
      <LockIcon className="mt-[16cqw] size-[5cqw]" />
      <p className="mt-[2cqw] text-[4.6cqw] font-medium">{date}</p>
      <p className="text-[24cqw] leading-none font-semibold tracking-tight" dir="ltr">
        9:41
      </p>
      {top ? <div className="mt-[6cqw] w-full px-[3cqw]">{top}</div> : null}
      <div className="mt-auto mb-[16cqw] w-full px-[3cqw]">{children}</div>
      <span className="absolute bottom-[2.4cqw] h-[1.3cqw] w-[36cqw] rounded-full bg-white/90" />
    </div>
  );
}

/** Android (Pixel) lock screen: date + stacked clock, notifications under it. */
export function AndroidLockScreen({ date, children, wallpaper = 'linear-gradient(170deg,#141b12 0%,#22301c 50%,#3c4a2c 100%)' }: { date: string; children?: React.ReactNode; wallpaper?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col text-white" style={{ background: wallpaper }}>
      <div className="px-[7cqw] pt-[20cqw]" dir="ltr">
        <p className="text-[34cqw] leading-[0.85] font-light tracking-tight">09</p>
        <p className="text-[34cqw] leading-[0.85] font-light tracking-tight">41</p>
      </div>
      <p className="mt-[4cqw] px-[7cqw] text-[4.2cqw]">{date}</p>
      <div className="mt-[6cqw] px-[3cqw]">{children}</div>
      <span className="absolute bottom-[2.4cqw] left-1/2 h-[1.1cqw] w-[30cqw] -translate-x-1/2 rounded-full bg-white/80" />
    </div>
  );
}

/** Step 1: lock screen with the NFC tag banner. */
export function TapScreen() {
  const { d } = useI18n();
  const s = d.steps.screen;
  return (
    <IosLockScreen
      date={s.date}
      top={
      <div className="pop hover-nudge flex items-center gap-[3cqw] rounded-[5cqw] bg-white/85 p-[3.4cqw] text-black backdrop-blur-md">
        <span className="flex size-[9cqw] shrink-0 items-center justify-center rounded-[2.4cqw] bg-[#1c1c1e] text-white">
          <SmartphoneVibrationIcon className="size-[5cqw]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex justify-between text-[3.6cqw] font-semibold">
            {s.nfcTitle}
            <span className="text-[3cqw] font-normal text-black/50">{s.now}</span>
          </span>
          <span className="block truncate text-[3.4cqw] text-black/75">{s.nfcText}</span>
        </span>
      </div>
      }
    />
  );
}

/** Step 2: the café's join page. */
export function JoinScreen({ onJoin }: { onJoin?: () => void }) {
  const { d } = useI18n();
  const s = d.steps.screen;
  return (
    <div className="absolute inset-0 bg-[#f2f2f7] px-[4cqw] pt-[16cqw]">
      <div className="rounded-[5cqw] bg-white p-[5cqw]">
        <span className="flex size-[11cqw] items-center justify-center rounded-full" style={{ background: CAFE.bg, color: CAFE.fg }}>
          <CupHotIcon className="size-[6cqw]" />
        </span>
        <p className="mt-[3cqw] text-[3cqw] tracking-[0.14em] text-black/50 uppercase">{s.joinEyebrow}</p>
        <p className="mt-[1cqw] text-[6.4cqw] font-semibold text-black">{s.joinTitle}</p>
        <p className="mt-[1.4cqw] text-[3.6cqw] leading-snug text-black/60">{s.joinText}</p>
        <p className="mt-[4.5cqw] text-[3.4cqw] text-black/70">{s.name}</p>
        <p className="mt-[1.4cqw] rounded-[2.4cqw] bg-[#f2f2f7] px-[3.4cqw] py-[2.8cqw] text-[3.8cqw] text-black">{s.nameValue}</p>
        <p className="mt-[3.4cqw] text-[3.4cqw] text-black/70">{s.mobile}</p>
        <p className="mt-[1.4cqw] rounded-[2.4cqw] bg-[#f2f2f7] px-[3.4cqw] py-[2.8cqw] text-[3.8cqw] text-black" dir="ltr">
          {s.mobileValue}
        </p>
        {onJoin ? (
          <button type="button" onClick={onJoin} className="demo-tap mt-[5cqw] block min-h-6 w-full rounded-[3cqw] py-[3.4cqw] text-center text-[3.9cqw] font-semibold transition duration-150 active:scale-[0.98]" style={{ background: CAFE.bg, color: CAFE.fg }}>
            {s.joinButton}
          </button>
        ) : (
          <p className="hover-nudge mt-[5cqw] rounded-[3cqw] py-[3.4cqw] text-center text-[3.9cqw] font-semibold" style={{ background: CAFE.bg, color: CAFE.fg }}>
            {s.joinButton}
          </p>
        )}
      </div>
    </div>
  );
}

/** "Add to Apple Wallet" badge (black, Apple's style). */
export function AddToAppleWallet({ className, onClick }: { className?: string; onClick?: () => void }) {
  const { d } = useI18n();
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn('inline-flex items-center gap-[2.4cqw] rounded-[2.4cqw] bg-black px-[3.6cqw] py-[1.8cqw] text-white', onClick && 'demo-tap min-h-6 transition duration-150 active:scale-[0.97]', className)}
      dir="ltr"
    >
      <span className="relative h-[6cqw] w-[8cqw] overflow-hidden rounded-[1cqw] bg-white">
        <span className="absolute inset-x-0 top-0 h-1/4 bg-[#4c9be8]" />
        <span className="absolute inset-x-0 top-1/4 h-1/4 bg-[#f4b740]" />
        <span className="absolute inset-x-0 top-2/4 h-1/4 bg-[#e45d4e]" />
        <span className="absolute inset-x-0 top-3/4 h-1/4 bg-[#5bbf6a]" />
      </span>
      <span className="text-start leading-[1.05]">
        <span className="block text-[2.6cqw]">{d.steps.screen.addTo}</span>
        <span className="block text-[4cqw] font-medium">{d.steps.screen.appleWallet}</span>
      </span>
    </Tag>
  );
}

/** Step 3: card ready + Add to Apple Wallet. */
export function SaveScreen({ onAdd }: { onAdd?: () => void }) {
  const { d } = useI18n();
  return (
    <div className="absolute inset-0 flex flex-col items-center bg-[#f2f2f7] px-[5cqw] pt-[18cqw]">
      <p className="text-[5.2cqw] font-medium text-black">{d.steps.screen.ready}</p>
      <AddToAppleWallet className="hover-nudge mt-[4cqw]" onClick={onAdd} />
      <CafePass points={0} className="mt-[5cqw] w-full" />
    </div>
  );
}

/** Step 4: Wallet, scanned, reward ready. */
export function ReturnScreen() {
  const { d } = useI18n();
  return (
    <div className="absolute inset-0 bg-[#f2f2f7] px-[4.5cqw] pt-[15cqw]">
      <p className="text-[8.4cqw] font-bold tracking-tight text-black">{d.wallet.title}</p>
      <div className="pop hover-nudge mt-[3cqw] flex items-center gap-[2cqw] rounded-full bg-white px-[3.6cqw] py-[2.4cqw] text-[3.3cqw] text-black shadow-sm">
        <CheckCircleIcon className="size-[4.2cqw] shrink-0 text-[#2f9e55]" />
        <span className="truncate">{d.steps.screen.scanned}</span>
      </div>
      <CafePass points={300} className="mt-[3cqw]" note={d.steps.screen.rewardReady} />
    </div>
  );
}
