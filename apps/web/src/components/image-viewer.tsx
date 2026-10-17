import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { getLanguage, t } from '../i18n';

/**
 * Full-screen viewer for menu pages: pinch or double-tap to zoom, drag to look around, swipe (when
 * not zoomed) or the arrows to change page. Escape or the close button closes it.
 */
export function ImageViewer({ images, index, onIndex, onClose, alt }: { images: string[]; index: number; onIndex: (i: number) => void; onClose: () => void; alt: (i: number) => string }) {
  const [scale, setScale] = useState(1);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const rtl = getLanguage() === 'ar';
  const go = (by: -1 | 1) => {
    const next = index + by;
    if (next >= 0 && next < images.length) onIndex(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(rtl ? -1 : 1);
      else if (e.key === 'ArrowLeft') go(rtl ? 1 : -1);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt(index)}
      className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none"
      onTouchStart={(e) => {
        touch.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start || scale > 1.01) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        // swiping towards the reading start shows the next page
        go((dx < 0) !== rtl ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <span className="px-2 text-[15px] font-medium tabular-nums opacity-80" dir="ltr">
          {images.length > 1 ? `${index + 1} / ${images.length}` : ''}
        </span>
        <button type="button" onClick={onClose} aria-label={t('venue.closeViewer')} className="flex size-11 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20">
          <X className="size-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <TransformWrapper
          key={index}
          minScale={1}
          maxScale={5}
          centerOnInit
          doubleClick={{ mode: 'toggle', step: 1.5 }}
          panning={{ disabled: scale <= 1.01 }}
          onTransform={(_, s) => setScale(s.scale)}
          onInit={() => setScale(1)}
        >
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
            <img src={images[index]} alt={alt(index)} draggable={false} className="h-full w-full object-contain select-none" />
          </TransformComponent>
        </TransformWrapper>

        {images.length > 1 ? (
          <>
            <NavButton side="start" disabled={index === 0} onClick={() => go(-1)} label={t('venue.previousPage')} />
            <NavButton side="end" disabled={index === images.length - 1} onClick={() => go(1)} label={t('venue.nextPage')} />
          </>
        ) : null}
      </div>

      <p className="px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] text-center text-[13px] opacity-60">{t('venue.zoomHint')}</p>
    </div>
  );
}

function NavButton({ side, disabled, onClick, label }: { side: 'start' | 'end'; disabled: boolean; onClick: () => void; label: string }) {
  const Icon = side === 'start' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`absolute top-1/2 ${side === 'start' ? 'start-2' : 'end-2'} flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20 disabled:invisible`}
    >
      <Icon className="size-6 rtl:rotate-180" />
    </button>
  );
}
