import type { ReactNode } from 'react';

/** iPhone 15 screen in CSS points; the page inside renders at this real size and is scaled down. */
const SCREEN_W = 393;
const SCREEN_H = 852;
const STATUS_H = 54;
const BEZEL = 11;

/**
 * A realistic iPhone (titanium frame, side buttons, Dynamic Island, status bar, home indicator)
 * showing a web page at a real phone width, scaled to `width` px so it reads like the real thing.
 */
export function IPhoneMockup({ src, width = 300, reloadKey = 0, title, empty }: { src: string | null; width?: number; reloadKey?: number; title: string; empty?: ReactNode }) {
  const scale = width / SCREEN_W;
  const frame = { width: width + BEZEL * 2, height: SCREEN_H * scale + BEZEL * 2 };
  return (
    <div className="relative shrink-0" style={frame} dir="ltr">
      {/* side buttons: action + volume on the left, power on the right */}
      <span className="absolute top-[17%] -left-[3px] h-[3.5%] w-[3px] rounded-l-sm bg-neutral-700" aria-hidden />
      <span className="absolute top-[24%] -left-[3px] h-[7%] w-[3px] rounded-l-sm bg-neutral-700" aria-hidden />
      <span className="absolute top-[33%] -left-[3px] h-[7%] w-[3px] rounded-l-sm bg-neutral-700" aria-hidden />
      <span className="absolute top-[27%] -right-[3px] h-[11%] w-[3px] rounded-r-sm bg-neutral-700" aria-hidden />

      <div
        className="absolute inset-0 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)]"
        style={{
          borderRadius: 55 * scale + BEZEL,
          background: 'linear-gradient(145deg, #4a4a4f 0%, #2a2a2d 35%, #1c1c1e 65%, #3a3a3e 100%)',
          padding: 2,
        }}
      >
        <div className="size-full bg-black" style={{ borderRadius: 55 * scale + BEZEL - 2, padding: BEZEL - 2 }}>
          <div className="relative overflow-hidden bg-white" style={{ width, height: SCREEN_H * scale, borderRadius: 47 * scale }}>
            {/* the real-size screen, scaled */}
            <div className="absolute top-0 left-0 origin-top-left" style={{ width: SCREEN_W, height: SCREEN_H, transform: `scale(${scale})` }}>
              <StatusBar />
              {src ? (
                <iframe key={reloadKey} src={src} title={title} className="block border-0" style={{ width: SCREEN_W, height: SCREEN_H - STATUS_H }} />
              ) : (
                <div className="flex items-center justify-center p-10 text-center text-xl text-neutral-500" style={{ height: SCREEN_H - STATUS_H }}>
                  {empty}
                </div>
              )}
              {/* Dynamic Island + home indicator */}
              <span className="absolute top-[11px] left-1/2 h-[37px] w-[126px] -translate-x-1/2 rounded-full bg-black" aria-hidden />
              <span className="absolute bottom-[8px] left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-black/80" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 9:41, signal, Wi-Fi and battery, like Apple's own screenshots. */
function StatusBar() {
  return (
    <div className="flex items-center justify-between bg-paper px-8 pt-[18px] text-black" style={{ height: STATUS_H }} aria-hidden>
      <span className="w-[80px] text-center text-[17px] font-semibold tracking-tight">9:41</span>
      <span className="flex w-[80px] items-center justify-center gap-[6px]">
        <svg viewBox="0 0 18 12" className="h-[12px]" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg viewBox="0 0 16 12" className="h-[12px]" fill="currentColor">
          <path d="M8 2.6c2.2 0 4.2.9 5.7 2.3l1.1-1.1A9.6 9.6 0 0 0 8 1 9.6 9.6 0 0 0 1.2 3.8l1.1 1.1A8 8 0 0 1 8 2.6Zm0 3.2c1.3 0 2.5.5 3.4 1.3l1.1-1.1A6.4 6.4 0 0 0 8 4.2c-1.7 0-3.3.7-4.5 1.8l1.1 1.1c.9-.8 2.1-1.3 3.4-1.3Zm0 3.2c-.5 0-1 .2-1.3.5L8 11l1.3-1.5A1.9 1.9 0 0 0 8 9Z" />
        </svg>
        <svg viewBox="0 0 27 13" className="h-[13px]" fill="none">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="currentColor" opacity="0.35" />
          <rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor" />
          <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity="0.4" />
        </svg>
      </span>
    </div>
  );
}
