import { useQuery } from '@tanstack/react-query';
import type { Vendor } from './api';
import { cardDesign } from './cardDesigns';
import { useVendorApi } from './vendor-workspace';

/**
 * The colours of the merchant's loyalty card, for things that follow the card (QR poster,
 * default page colours): the live design from Cards → Design card, else the old automatic
 * design for merchants without a card yet. Matches `cardLook` on the customer website.
 */
export function useCardColors(vendor: Pick<Vendor, 'id' | 'cardDesign'>): { colors: [string, string]; ink: string } {
  const api = useVendorApi();
  const { data } = useQuery({ queryKey: ['loyalty-card'], queryFn: api.loyaltyCard, staleTime: 60_000 });
  const live = data?.card && data.card.status !== 'cancelled' ? data.design : null;
  if (live) return { colors: [live.colors.background, live.colors.background], ink: live.colors.text };
  const old = cardDesign(vendor.id, vendor.cardDesign);
  return { colors: old.colors, ink: old.ink };
}
