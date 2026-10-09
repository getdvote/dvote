/**
 * What kind of place a vendor is (shown in the app, filterable later). Keep in step with the
 * vendors_category_ck CHECK in the database (migration 9_vendor_branding).
 */
export const VENDOR_CATEGORIES = ['cafe', 'cafe_restaurant', 'restaurant', 'bakery', 'desserts', 'juice_bar'] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

/** Loyalty-card designs 1..10 (the apps draw them; the API only stores the number). */
export const CARD_DESIGN_COUNT = 10;
