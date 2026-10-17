import type { CSSProperties } from 'react';
import type { PublicCard } from '../lib/api';
import { cardDesign, type CardDesign } from '../lib/cardDesigns';
import { t } from '../i18n';

/**
 * The loyalty card as it will look in the wallet: the merchant's card design (gradient +
 * pattern), logo and name, the points, the cardholder and the short code. Card layout stays
 * left-to-right in Arabic too (like a physical card).
 */
export function LoyaltyCard({ card }: { card: PublicCard }) {
  const d = cardDesign(card.vendor.id, card.vendor.cardDesign);
  const soft = d.ink === '#FFFFFF' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)';
  return (
    <div
      dir="ltr"
      className="relative w-full overflow-hidden rounded-[22px] p-5 text-left shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
      style={{ background: `linear-gradient(135deg, ${d.colors[0]}, ${d.colors[1]})`, color: d.ink }}
    >
      <Pattern design={d} />
      <div className="relative flex items-center gap-3">
        {card.vendor.logoUrl ? (
          <img src={card.vendor.logoUrl} alt="" className="size-10 rounded-xl bg-white object-cover" />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/90 font-bold" style={{ color: d.colors[0] }}>
            {card.vendor.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[17px] font-semibold">{card.vendor.name}</span>
      </div>

      <div className="relative mt-7 text-center">
        <div className="text-[12px] font-semibold tracking-[0.25em]" style={{ color: soft }}>
          {t('card.points').toUpperCase()}
        </div>
        <div className="text-[56px] leading-none font-extrabold tabular-nums">{card.balance.toLocaleString('en-US')}</div>
        <div className="mx-auto mt-4 h-1.5 w-2/3 rounded-full" style={{ background: soft }} />
      </div>

      <div className="relative mt-7 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-[0.15em]" style={{ color: soft }}>
            {t('card.cardholder').toUpperCase()}
          </div>
          <div className="truncate text-[17px]">{card.cardholder}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold tracking-[0.15em]" style={{ color: soft }}>
            {t('card.code').toUpperCase()}
          </div>
          <div className="font-mono text-[17px] tracking-wider">{card.shortCode}</div>
        </div>
      </div>
    </div>
  );
}

function Pattern({ design }: { design: CardDesign }) {
  const tint = design.ink === '#FFFFFF' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)';
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
      return <div style={{ ...layer, backgroundImage: `radial-gradient(${tint} 3.5px, transparent 4px)`, backgroundSize: '20px 20px', maskImage: 'linear-gradient(90deg, transparent 40%, black 80%)' }} />;
    default:
      return <div style={{ ...layer, background: `radial-gradient(circle at 90% 10%, ${tint} 0 30%, transparent 31%), radial-gradient(circle at 75% 0%, ${tint} 0 18%, transparent 19%)` }} />;
  }
}
