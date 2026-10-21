import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/**
 * dvote brand illustrations and patterns (brand kit v1.0, sections 13 and 17-19). Static SVGs in
 * `public/brand/`. Always decorative: the message lives in live text next to them.
 */

export type IllustrationName =
  | 'all-done'
  | 'earn-stamps'
  | 'empty-rewards'
  | 'insights'
  | 'invite-customers'
  | 'nearby'
  | 'reward-unlocked'
  | 'scan-and-earn'
  | 'send-campaign'
  | 'welcome';

/** Kit sizes: empty states 160-240 px wide, onboarding 240-360 px, campaign hero 400 px and up. */
const ILLUSTRATION_SIZE = {
  sm: 'w-32 sm:w-40',
  md: 'w-40 sm:w-52',
  lg: 'w-56 sm:w-72',
} as const;

const asset = (path: string) => `${import.meta.env.BASE_URL}brand/${path}`;

/**
 * One brand scene (640 × 480, scaled proportionally). The scenes are paper-backed, so on dark
 * surfaces they sit in a light paper panel (kit: "place paper-backed scenes in a light panel").
 */
export function BrandIllustration({ name, size = 'md', className }: { name: IllustrationName; size?: keyof typeof ILLUSTRATION_SIZE; className?: string }) {
  return (
    <div aria-hidden className={cn('shrink-0 dark:rounded-2xl dark:bg-paper dark:p-1.5', ILLUSTRATION_SIZE[size], className)}>
      <img
        src={asset(`illustrations/${name}.svg`)}
        alt=""
        width={640}
        height={480}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="block aspect-[4/3] h-auto w-full select-none"
      />
    </div>
  );
}

export type PatternName = 'paper-grid' | 'orbit-ink' | 'symbol-field' | 'electric-crop';

/** Where the pattern fades out, so text placed there keeps its contrast. Logical: follows RTL. */
type Fade = 'none' | 'start' | 'end' | 'top' | 'bottom';

const FADE: Record<Fade, string> = {
  none: '',
  // transparent at the inline start (where text begins), visible towards the end
  start:
    '[mask-image:linear-gradient(to_right,transparent_25%,black_85%)] rtl:[mask-image:linear-gradient(to_left,transparent_25%,black_85%)]',
  end: '[mask-image:linear-gradient(to_left,transparent_25%,black_85%)] rtl:[mask-image:linear-gradient(to_right,transparent_25%,black_85%)]',
  top: '[mask-image:linear-gradient(to_bottom,transparent_20%,black_90%)]',
  bottom: '[mask-image:linear-gradient(to_top,transparent_20%,black_90%)]',
};

/**
 * A quiet brand pattern filling its (relative, overflow-hidden) parent, behind the content.
 * `paper-grid` is the kit's 48-unit dot grid drawn in CSS with the border colour, so it works in
 * both themes; the others are the kit's SVGs, for brand moments only (never behind dense data).
 */
export function BrandPattern({ name, fade = 'none', className, style }: { name: PatternName; fade?: Fade; className?: string; style?: CSSProperties }) {
  const grid = name === 'paper-grid';
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 select-none', grid ? 'text-border' : 'bg-cover bg-center', FADE[fade], className)}
      style={
        grid
          ? { backgroundImage: 'radial-gradient(currentColor 1.5px, transparent 1.75px)', backgroundSize: '24px 24px', backgroundPosition: '8px 8px', ...style }
          : { backgroundImage: `url("${asset(`patterns/${name}.svg`)}")`, ...style }
      }
    />
  );
}
