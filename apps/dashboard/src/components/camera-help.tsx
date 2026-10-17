import { RefreshIcon, VideocameraRecordIcon } from '@solar-icons/react/linear';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { t } from '../i18n';

/** Calls `onGranted` once the browser's camera permission turns to "allowed" (Chrome, Edge, Firefox). */
export function useCameraGranted(onGranted: () => void) {
  const latest = useRef(onGranted);
  latest.current = onGranted;
  useEffect(() => {
    let status: PermissionStatus | null = null;
    const changed = () => status?.state === 'granted' && latest.current();
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((s) => {
        status = s;
        s.addEventListener('change', changed);
      })
      .catch(() => undefined);
    return () => status?.removeEventListener('change', changed);
  }, []);
}

/**
 * The camera was refused: a looping demo of turning it back on (site icon → Camera on → Reload),
 * the same three steps in words, Reload, and an arrow at the top of the window pointing to where
 * the browser keeps the site's permissions.
 */
export function CameraBlockedHelp() {
  return (
    <div className="grid gap-4 rounded-xl border bg-muted/40 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <VideocameraRecordIcon className="size-[18px]" />
        </span>
        <div className="grid gap-0.5">
          <p className="font-medium">{t('till.camera.deniedTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('till.camera.deniedBody')}</p>
        </div>
      </div>
      <PermissionDemo />
      <ol className="grid gap-2 text-sm">
        {(['step1', 'step2', 'step3'] as const).map((k, i) => (
          <li key={k} className="flex items-start gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background tabular-nums">
              {i + 1}
            </span>
            {t(`till.camera.${k}`)}
          </li>
        ))}
      </ol>
      <Button variant="outline" onClick={() => window.location.reload()}>
        <RefreshIcon /> {t('till.camera.reload')}
      </Button>
      <BrowserArrow />
    </div>
  );
}

const LOOP = { duration: 6, repeat: Infinity, ease: 'easeInOut' as const };

/** A tiny browser window: the cursor clicks the site icon, switches Camera on, then Reload. */
function PermissionDemo() {
  return (
    <div dir="ltr" aria-hidden className="relative h-44 overflow-hidden rounded-lg border bg-card shadow-xs select-none">
      {/* window bar */}
      <div className="flex items-center gap-2 border-b bg-muted/60 px-2.5 py-2">
        <span className="flex gap-1">
          <i className="size-2 rounded-full bg-foreground/15" />
          <i className="size-2 rounded-full bg-foreground/15" />
          <i className="size-2 rounded-full bg-foreground/15" />
        </span>
        <div className="flex h-6 flex-1 items-center gap-1.5 rounded-full bg-background px-1.5 text-[11px] text-muted-foreground">
          <span className="relative flex size-[18px] items-center justify-center">
            <motion.i
              className="absolute inset-0 rounded-full bg-accent"
              animate={{ opacity: [0, 0, 1, 1, 0] }}
              transition={{ ...LOOP, times: [0, 0.18, 0.22, 0.85, 0.95] }}
            />
            <span className="relative">
              <SiteIcon />
            </span>
          </span>
          dvote.co
        </div>
      </div>

      {/* the page behind */}
      <div className="grid gap-1.5 p-3 pt-4">
        <i className="h-2 w-2/3 rounded bg-muted" />
        <i className="h-2 w-1/2 rounded bg-muted" />
        <i className="h-2 w-3/5 rounded bg-muted" />
      </div>

      {/* the site settings popover */}
      <motion.div
        className="absolute top-9 left-12 w-48 rounded-lg border bg-popover p-2.5 text-[11px] shadow-lg"
        animate={{ opacity: [0, 0, 1, 1, 0], y: [-4, -4, 0, 0, -4] }}
        transition={{ ...LOOP, times: [0, 0.23, 0.28, 0.88, 0.95] }}
      >
        <div className="flex items-center justify-between gap-2 py-1">
          <span className="flex items-center gap-1.5 font-medium">
            <VideocameraRecordIcon className="size-3.5" /> {t('till.camera.demoCamera')}
          </span>
          <span className="relative h-3.5 w-6 overflow-hidden rounded-full bg-border">
            <motion.i
              className="absolute inset-0 bg-primary"
              animate={{ opacity: [0, 0, 1, 1] }}
              transition={{ ...LOOP, times: [0, 0.45, 0.5, 1] }}
            />
            <motion.i
              className="absolute top-0.5 left-0.5 size-2.5 rounded-full bg-background shadow-sm"
              animate={{ x: [0, 0, 10, 10] }}
              transition={{ ...LOOP, times: [0, 0.45, 0.5, 1] }}
            />
          </span>
        </div>
        <motion.div
          className="mt-1.5 flex items-center justify-between gap-2 border-t pt-1.5"
          animate={{ opacity: [0, 0, 1, 1] }}
          transition={{ ...LOOP, times: [0, 0.52, 0.57, 1] }}
        >
          <span className="text-muted-foreground">{t('till.camera.demoReloadHint')}</span>
          <motion.span
            className="rounded-md bg-primary px-1.5 py-0.5 font-medium text-primary-foreground"
            animate={{ scale: [1, 1, 0.9, 1, 1] }}
            transition={{ ...LOOP, times: [0, 0.68, 0.71, 0.74, 1] }}
          >
            {t('till.camera.reload')}
          </motion.span>
        </motion.div>
      </motion.div>

      {/* the cursor: site icon → Camera switch → Reload */}
      <motion.div
        className="absolute top-0 left-0"
        animate={{
          x: [330, 64, 64, 215, 215, 203, 203, 330],
          y: [165, 19, 19, 58, 58, 93, 93, 165],
          opacity: [0, 1, 1, 1, 1, 1, 1, 0],
        }}
        transition={{ ...LOOP, times: [0, 0.16, 0.3, 0.42, 0.55, 0.66, 0.85, 1] }}
      >
        <Cursor />
        {/* a ring at each click */}
        <motion.i
          className="absolute -top-2 -left-2 size-5 rounded-full border-2 border-primary"
          animate={{
            scale: [0.4, 0.4, 0.5, 1.5, 0.4, 0.5, 1.5, 0.4, 0.5, 1.5, 0.4],
            opacity: [0, 0, 0.9, 0, 0, 0.9, 0, 0, 0.9, 0, 0],
          }}
          transition={{ ...LOOP, ease: 'easeOut', times: [0, 0.17, 0.18, 0.24, 0.45, 0.46, 0.52, 0.68, 0.69, 0.75, 1] }}
        />
      </motion.div>
    </div>
  );
}

function SiteIcon() {
  // Chrome's "view site information" control (two sliders)
  return (
    <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M2 5h7M12 5h2M2 11h2M7 11h7" />
      <circle cx="10.5" cy="5" r="1.5" />
      <circle cx="5.5" cy="11" r="1.5" />
    </svg>
  );
}

function Cursor() {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" className="drop-shadow">
      <path d="M1 1v15l4-3.6 2.6 6 2.4-1-2.6-6H13L1 1Z" fill="white" stroke="black" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Over everything, at the top of the window: a bobbing arrow at the site controls next to the
 * address (left in a left-to-right browser, right in an Arabic/Hebrew one). Mouse computers only:
 * phone browsers keep it elsewhere.
 */
function BrowserArrow() {
  if (typeof window === 'undefined' || !window.matchMedia('(pointer: fine)').matches) return null;
  const rtlBrowser = /^(ar|he|fa|ur)\b/i.test(navigator.language);
  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed top-1 z-[100] flex flex-col items-center gap-1"
      style={rtlBrowser ? { right: 40 } : { left: 40 }}
    >
      <motion.svg
        width="44"
        height="44"
        viewBox="0 0 44 44"
        className="text-white drop-shadow-[0_2px_6px_rgb(0_0_0/0.45)]"
        style={{ transform: rtlBrowser ? 'scaleX(-1)' : undefined }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* pointing up and slightly left, at the icon beside the address */}
        <path d="M14 4 L4 16 h7 v12 q0 10 12 12 h14 v-6 h-13 q-6 0 -6 -6 V16 h7 Z" fill="currentColor" />
      </motion.svg>
      <motion.span
        className="rounded-full bg-white px-3 py-1.5 text-xs font-medium whitespace-nowrap text-neutral-900 shadow-[0_4px_16px_rgb(0_0_0/0.35)]"
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
      >
        {t('till.camera.arrow')}
      </motion.span>
    </div>,
    document.body,
  );
}
