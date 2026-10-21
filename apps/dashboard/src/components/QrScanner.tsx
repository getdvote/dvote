import jsQR from 'jsqr';
import { LoaderIcon as Loader2 } from '@solar-icons/react/linear';
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';

/**
 * The computer's camera, reading QR codes (jsQR on a downscaled frame, ~6 times a second).
 * Calls `onCode` with each code it sees; the caller ignores repeats while it checks one.
 * `onBlocked` when the browser refused the camera ('denied') or there is none / it can't be used ('missing').
 */
export type CameraProblem = 'denied' | 'missing';

export function QrScanner({ onCode, onBlocked, paused }: { onCode: (code: string) => void; onBlocked: (problem: CameraProblem) => void; paused?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef({ onCode, onBlocked, paused });
  latest.current = { onCode, onBlocked, paused };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      const v = video.current;
      if (!stopped && v && ctx && v.readyState >= 2 && !latest.current.paused) {
        const w = 480;
        const h = Math.round((v.videoHeight / v.videoWidth) * w) || w;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(v, 0, 0, w, h);
        const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
        if (found?.data) latest.current.onCode(found.data);
      }
      if (!stopped) timer = window.setTimeout(tick, 160);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) return stream.getTracks().forEach((tr) => tr.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => undefined);
        }
        setReady(true);
        tick();
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        if (!stopped) latest.current.onBlocked(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'missing');
      }
    })();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
      <video ref={video} muted playsInline className="size-full object-cover" />
      <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-[3px] border-white/90" />
      {!ready ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/80">
          <Loader2 className="size-6 animate-spin" />
          {t('till.cameraStarting')}
        </div>
      ) : null}
    </div>
  );
}
