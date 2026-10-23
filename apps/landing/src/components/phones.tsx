import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * Device frames drawn in CSS (no images): an iPhone (titanium band, Dynamic Island, side buttons)
 * and a Google Pixel (one-piece band, punch-hole camera). Set the width with `className`; the height
 * follows the real proportions and everything inside scales with the screen width (cqw units).
 * The hardware is physical, so its buttons use left/right; the screen content follows the page
 * direction (an Arabic phone shows Arabic right to left).
 */

type Tone = 'dark' | 'light';

function SignalIcon() {
  return (
    <svg viewBox="0 0 18 12" className="h-full w-auto" aria-hidden>
      <rect x="0" y="8" width="3" height="4" rx="0.8" fill="currentColor" />
      <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" fill="currentColor" />
      <rect x="10" y="3" width="3" height="9" rx="0.8" fill="currentColor" />
      <rect x="15" y="0" width="3" height="12" rx="0.8" fill="currentColor" />
    </svg>
  );
}
function WifiIcon() {
  return (
    <svg viewBox="0 0 16 12" className="h-full w-auto" aria-hidden>
      <path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0Z M3.4 6.8a6.5 6.5 0 0 1 9.2 0l-1.3 1.3a4.7 4.7 0 0 0-6.6 0Z M1.1 4.5a9.8 9.8 0 0 1 13.8 0l-1.3 1.3a8 8 0 0 0-11.2 0Z" fill="currentColor" />
    </svg>
  );
}
function BatteryIcon() {
  return (
    <svg viewBox="0 0 27 12" className="h-full w-auto" aria-hidden>
      <rect x="0.5" y="0.5" width="23" height="11" rx="3.2" fill="none" stroke="currentColor" strokeOpacity="0.4" />
      <rect x="2" y="2" width="20" height="8" rx="2" fill="currentColor" />
      <path d="M25 4v4a2 2 0 0 0 0-4Z" fill="currentColor" fillOpacity="0.45" />
    </svg>
  );
}

function StatusBar({ tone, platform }: { tone: Tone; platform: 'ios' | 'android' }) {
  const color = tone === 'light' ? 'text-white' : 'text-black';
  if (platform === 'android')
    return (
      <div className={cn('absolute inset-x-0 top-0 z-20 flex h-[7cqw] items-center justify-between px-[6cqw] pt-[2.4cqw] text-[3.6cqw] font-medium', color)} dir="ltr">
        <span>9:41</span>
        <span className="flex h-[3cqw] items-center gap-[1.4cqw]">
          <WifiIcon />
          <SignalIcon />
          <BatteryIcon />
        </span>
      </div>
    );
  return (
    <div className={cn('absolute inset-x-0 top-0 z-20 flex h-[13cqw] items-center justify-between px-[8.5cqw] pt-[1cqw] text-[4.2cqw] font-semibold', color)} dir="ltr">
      <span className="w-[16cqw] text-center">9:41</span>
      <span className="flex h-[3.2cqw] items-center gap-[1.4cqw]">
        <SignalIcon />
        <WifiIcon />
        <BatteryIcon />
      </span>
    </div>
  );
}

/** iPhone 15 Pro style frame. */
export function IPhone({ children, className, screenClassName, tone = 'dark', interactive = false }: { children: ReactNode; className?: string; screenClassName?: string; tone?: Tone; interactive?: boolean }) {
  return (
    <div className={cn('relative aspect-[71.6/147.6] shrink-0', className)} aria-hidden={interactive ? undefined : true}>
      {/* side buttons (physical: action + volume on the left, power on the right) */}
      <span className="absolute top-[17%] -left-[1.1%] h-[3.6%] w-[1.6%] rounded-l-sm bg-gradient-to-r from-[#5b5e64] to-[#3a3c41]" />
      <span className="absolute top-[24%] -left-[1.1%] h-[7%] w-[1.6%] rounded-l-sm bg-gradient-to-r from-[#5b5e64] to-[#3a3c41]" />
      <span className="absolute top-[33%] -left-[1.1%] h-[7%] w-[1.6%] rounded-l-sm bg-gradient-to-r from-[#5b5e64] to-[#3a3c41]" />
      <span className="absolute top-[26%] -right-[1.1%] h-[11%] w-[1.6%] rounded-r-sm bg-gradient-to-l from-[#5b5e64] to-[#3a3c41]" />
      {/* titanium band */}
      <div className="relative h-full w-full rounded-[17.5%/8.5%] bg-[linear-gradient(145deg,#8e9196_0%,#4a4d52_22%,#2e3034_50%,#4a4d52_78%,#8e9196_100%)] p-[1.3%] shadow-[0_40px_80px_-30px_rgb(17_25_12/0.45),0_18px_36px_-18px_rgb(17_25_12/0.3)]">
        <div className="h-full w-full rounded-[16.6%/8.05%] bg-black p-[3.1%]">
          <div className={cn('@container relative h-full w-full overflow-hidden rounded-[13.6%/6.55%] bg-[#f2f2f7]', screenClassName)}>
            <StatusBar tone={tone} platform="ios" />
            <span className="absolute top-[2.6cqw] left-1/2 z-30 h-[8.8cqw] w-[31cqw] -translate-x-1/2 rounded-full bg-black" />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Google Pixel 9 style frame. */
export function Pixel({ children, className, screenClassName, tone = 'dark' }: { children: ReactNode; className?: string; screenClassName?: string; tone?: Tone }) {
  return (
    <div className={cn('relative aspect-[72/152.8] shrink-0', className)} aria-hidden>
      <span className="absolute top-[20%] -right-[1.2%] h-[7%] w-[1.7%] rounded-r-sm bg-gradient-to-l from-[#4d4f53] to-[#2c2d30]" />
      <span className="absolute top-[30%] -right-[1.2%] h-[13%] w-[1.7%] rounded-r-sm bg-gradient-to-l from-[#4d4f53] to-[#2c2d30]" />
      <div className="relative h-full w-full rounded-[13.5%/6.4%] bg-[linear-gradient(145deg,#5a5d61_0%,#2b2c2f_30%,#1c1d1f_55%,#3c3e41_100%)] p-[1.4%] shadow-[0_40px_80px_-30px_rgb(17_25_12/0.45),0_18px_36px_-18px_rgb(17_25_12/0.3)]">
        <div className="h-full w-full rounded-[12.4%/5.85%] bg-black p-[2.6%]">
          <div className={cn('@container relative h-full w-full overflow-hidden rounded-[10.6%/5%] bg-[#f3f3f3]', screenClassName)}>
            <StatusBar tone={tone} platform="android" />
            <span className="absolute top-[3cqw] left-1/2 z-30 size-[4.2cqw] -translate-x-1/2 rounded-full bg-black ring-[0.6cqw] ring-[#111]" />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
