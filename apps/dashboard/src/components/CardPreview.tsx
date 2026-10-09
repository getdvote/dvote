import type { CSSProperties } from 'react';
import { initial } from './PageHeader';
import { DvoteLogo } from './DvoteLogo';
import type { CardDesign } from '../lib/cardDesigns';
import { cn } from '@/lib/utils';

/**
 * A loyalty card as customers see it in the app: the design's gradient and pattern, the
 * vendor's logo and name, and a points balance. Used by the design picker.
 */
export function CardPreview({
  design,
  name,
  logoUrl,
  points = 1250,
  className,
}: {
  design: CardDesign;
  name: string;
  logoUrl: string | null;
  points?: number;
  className?: string;
}) {
  const tint = design.ink === '#FFFFFF' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  return (
    <div
      className={cn('relative aspect-[1.6] w-full overflow-hidden rounded-2xl p-4 text-left', className)}
      style={{ background: `linear-gradient(135deg, ${design.colors[0]}, ${design.colors[1]})`, color: design.ink }}
    >
      <Pattern design={design} tint={tint} />
      <div className="relative flex items-center gap-2.5">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="size-8 shrink-0 rounded-full bg-white object-cover" />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-sm font-extrabold" style={{ color: design.colors[0] }}>
            {initial(name)}
          </span>
        )}
        <span className="truncate text-sm font-bold">{name}</span>
      </div>
      <div className="relative mt-[12%] text-2xl font-extrabold tracking-wide tabular-nums">
        {points.toLocaleString('en-US')} <span className="text-sm font-semibold">pts</span>
      </div>
    </div>
  );
}

function Pattern({ design, tint }: { design: CardDesign; tint: string }) {
  const layer: CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };
  switch (design.pattern) {
    case 'circles':
      return (
        <div style={layer}>
          <div className="absolute -top-[45%] -right-[20%] aspect-square w-[70%] rounded-full" style={{ background: tint }} />
          <div className="absolute -right-[2%] -bottom-[40%] aspect-square w-[42%] rounded-full" style={{ background: tint }} />
        </div>
      );
    case 'stripes':
      return <div style={{ ...layer, background: `repeating-linear-gradient(118deg, transparent 0 36px, ${tint} 36px 56px)`, maskImage: 'linear-gradient(90deg, transparent 35%, black 75%)' }} />;
    case 'dots':
      return (
        <div
          style={{
            ...layer,
            backgroundImage: `radial-gradient(${tint} 3.5px, transparent 4px)`,
            backgroundSize: '20px 20px',
            maskImage: 'linear-gradient(90deg, transparent 40%, black 80%)',
          }}
        />
      );
    default:
      return (
        <div className="pointer-events-none absolute -top-[6%] -right-[16%]">
          <DvoteLogo height={150} wordmark={false} color={tint} />
        </div>
      );
  }
}
