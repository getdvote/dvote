/** Small and big, narrow and wide, plus short screens (laptops with the browser's own bars). */
export const VIEWPORTS = [
  { name: 'phone-small-320', width: 320, height: 640 },
  { name: 'phone-375', width: 375, height: 812 },
  { name: 'phone-large-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-landscape-1024', width: 1024, height: 768 },
  { name: 'laptop-short-1280x640', width: 1280, height: 640 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'wide-1920', width: 1920, height: 1080 },
  { name: 'ultrawide-2560', width: 2560, height: 1080 },
] as const;

/** A smaller set for the Arabic (right-to-left) pass and for dialogs. */
export const KEY_VIEWPORTS = VIEWPORTS.filter((v) => ['phone-small-320', 'phone-375', 'tablet-768', 'desktop-1440'].includes(v.name));
