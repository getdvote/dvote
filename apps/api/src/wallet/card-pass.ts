import type { HoursSlot } from '../branches/hours';
import { linkHref, LINK_NAMES, type Bilingual, type CardDesign } from '../loyalty-cards/card-design';

/**
 * The Google Wallet fields drawn from the loyalty card's live version: wording (EN + AR),
 * the back of the card (text modules) and the buttons / links (links module). Google can't
 * draw the background patterns; it gets the flat colour (and the uploaded image as hero).
 */
interface Localized {
  defaultValue: { language: string; value: string };
  translatedValues?: { language: string; value: string }[];
}

export function localized(text: Bilingual): Localized {
  return {
    defaultValue: { language: 'en-US', value: text.en },
    ...(text.ar ? { translatedValues: [{ language: 'ar', value: text.ar }] } : {}),
  };
}

const DAYS: Bilingual[] = [
  { en: 'Sun', ar: 'الأحد' }, { en: 'Mon', ar: 'الإثنين' }, { en: 'Tue', ar: 'الثلاثاء' }, { en: 'Wed', ar: 'الأربعاء' },
  { en: 'Thu', ar: 'الخميس' }, { en: 'Fri', ar: 'الجمعة' }, { en: 'Sat', ar: 'السبت' },
];
/** Sunday first, like the card's hours editor. */
const WEEK = [0, 1, 2, 3, 4, 5, 6];

/** One line per open day: "Mon 08:00–14:00, 17:00–23:00"; closed days are left out. */
export function hoursText(hours: HoursSlot[], lang: 'en' | 'ar'): string {
  return WEEK.flatMap((day) => {
    const slots = hours.filter((h) => h.day === day);
    return slots.length ? [`${DAYS[day][lang]} ${slots.map((s) => `${s.opensAt}–${s.closesAt}`).join(', ')}`] : [];
  }).join('\n');
}

export interface PassContext {
  design: CardDesign;
  storefrontUrl: string;
  /** Map link of the branch Button 2 points at (Directions). */
  directionsUrl: string | null;
}

const WORDS = {
  about: { en: 'About', ar: 'عن البطاقة' },
  hours: { en: 'Opening hours', ar: 'مواعيد العمل' },
  terms: { en: 'Terms', ar: 'الشروط' },
  directions: { en: 'Directions', ar: 'الاتجاهات' },
  call: { en: 'Call', ar: 'اتصال' },
} satisfies Record<string, Bilingual>;

/** Class fields (shared by every member's pass). */
export function passClassFields({ design, storefrontUrl, directionsUrl }: PassContext) {
  const text = (id: string, header: Bilingual, body: Bilingual) => ({
    id, header: header.en, body: body.en, localizedHeader: localized(header), localizedBody: localized(body),
  });
  const textModulesData = [
    ...(design.back.about ? [text('about', WORDS.about, { en: design.back.about, ar: '' })] : []),
    ...(design.back.hours.length
      ? [text('hours', WORDS.hours, { en: hoursText(design.back.hours, 'en'), ar: hoursText(design.back.hours, 'ar') })]
      : []),
    ...(design.back.terms ? [text('terms', WORDS.terms, { en: design.back.terms, ar: '' })] : []),
  ];

  const link = (id: string, uri: string, label: Bilingual) => ({
    id, uri, description: label.en, localizedDescription: localized(label),
  });
  const second = design.buttons.secondary;
  const uris = [
    // first, so Android shows it as the card's own button
    link('storefront', storefrontUrl, design.buttons.primaryLabel),
    ...(second.type === 'directions' && directionsUrl ? [link('directions', directionsUrl, WORDS.directions)] : []),
    ...(second.type === 'call' ? [link('call', `tel:${second.phone}`, WORDS.call)] : []),
    ...design.back.links.map((l, i) =>
      link(`link-${i + 1}`, linkHref(l), l.platform === 'custom' ? { en: l.label ?? '', ar: '' } : LINK_NAMES[l.platform]),
    ),
  ];

  return {
    programName: design.front.title.en,
    localizedProgramName: localized(design.front.title),
    hexBackgroundColor: design.colors.background,
    textModulesData,
    linksModuleData: { uris },
  };
}

/** The points field of each member's pass. */
export function passPoints(design: CardDesign, balance: number) {
  return {
    label: design.front.pointsLabel.en,
    localizedLabel: localized(design.front.pointsLabel),
    balance: { int: balance },
  };
}
