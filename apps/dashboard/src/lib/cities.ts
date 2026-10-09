/**
 * Cities a branch can be in (Egypt): the key is what the API stores. `aka` = other spellings
 * OpenStreetMap uses, for filling the city from a map pin.
 * Keep identical to apps/api/src/branches/cities.ts and apps/mobile/src/lib/cities.ts.
 */
export const CITIES = [
  { key: 'cairo', en: 'Cairo', ar: 'القاهرة' },
  { key: 'new_cairo', en: 'New Cairo', ar: 'القاهرة الجديدة', aka: ['new cairo 1', 'new cairo 3', 'fifth settlement'] },
  { key: 'helwan', en: 'Helwan', ar: 'حلوان' },
  { key: 'new_capital', en: 'New Administrative Capital', ar: 'العاصمة الإدارية الجديدة', aka: ['administrative capital'] },
  { key: 'madinaty', en: 'Madinaty', ar: 'مدينتي' },
  { key: 'shorouk', en: 'El Shorouk', ar: 'الشروق', aka: ['shorouk', 'shorouk'] },
  { key: 'obour', en: 'El Obour', ar: 'العبور', aka: ['obour'] },
  { key: 'giza', en: 'Giza', ar: 'الجيزة', aka: ['jiza', 'gizah'] },
  { key: 'october_6', en: '6th of October', ar: 'السادس من أكتوبر', aka: ['6th october', '6 october', 'sixth of october', 'october'] },
  { key: 'sheikh_zayed', en: 'Sheikh Zayed', ar: 'الشيخ زايد', aka: ['shaykh zayid', 'sheikh zayed'] },
  { key: 'alexandria', en: 'Alexandria', ar: 'الإسكندرية', aka: ['iskandariyah', 'iskandaria'] },
  { key: 'borg_el_arab', en: 'Borg El Arab', ar: 'برج العرب', aka: ['burj al arab', 'new borg el arab'] },
  { key: 'kafr_el_dawwar', en: 'Kafr El Dawwar', ar: 'كفر الدوار', aka: ['kafr ad dawwar'] },
  { key: 'north_coast', en: 'North Coast', ar: 'الساحل الشمالي', aka: ['sahel'] },
  { key: 'el_alamein', en: 'El Alamein', ar: 'العلمين', aka: ['alamein', 'new alamein'] },
  { key: 'marsa_matruh', en: 'Marsa Matruh', ar: 'مرسى مطروح', aka: ['mersa matruh', 'matrouh', 'matruh'] },
  { key: 'siwa', en: 'Siwa', ar: 'سيوة', aka: ['siwa oasis'] },
  { key: 'shubra_el_kheima', en: 'Shubra El Kheima', ar: 'شبرا الخيمة', aka: ['shubra al khaymah'] },
  { key: 'banha', en: 'Banha', ar: 'بنها', aka: ['benha', 'qalyubia'] },
  { key: 'tanta', en: 'Tanta', ar: 'طنطا', aka: ['gharbia'] },
  { key: 'mahalla', en: 'El Mahalla El Kubra', ar: 'المحلة الكبرى', aka: ['mahalla kubra', 'mahalla'] },
  { key: 'mansoura', en: 'Mansoura', ar: 'المنصورة', aka: ['mansurah', 'mansura', 'dakahlia'] },
  { key: 'zagazig', en: 'Zagazig', ar: 'الزقازيق', aka: ['zaqaziq', 'sharqia'] },
  { key: 'tenth_of_ramadan', en: '10th of Ramadan', ar: 'العاشر من رمضان', aka: ['10th ramadan', 'tenth of ramadan'] },
  { key: 'damanhur', en: 'Damanhur', ar: 'دمنهور', aka: ['damanhour', 'beheira'] },
  { key: 'kafr_el_sheikh', en: 'Kafr El Sheikh', ar: 'كفر الشيخ', aka: ['kafr ash shaykh'] },
  { key: 'desouk', en: 'Desouk', ar: 'دسوق', aka: ['disuq'] },
  { key: 'damietta', en: 'Damietta', ar: 'دمياط', aka: ['dumyat', 'new damietta'] },
  { key: 'shibin_el_kom', en: 'Shibin El Kom', ar: 'شبين الكوم', aka: ['shibin al kawm', 'monufia', 'menoufia'] },
  { key: 'port_said', en: 'Port Said', ar: 'بورسعيد', aka: ['bur said'] },
  { key: 'ismailia', en: 'Ismailia', ar: 'الإسماعيلية', aka: ['ismailiyah'] },
  { key: 'suez', en: 'Suez', ar: 'السويس', aka: ['suways'] },
  { key: 'ain_sokhna', en: 'Ain Sokhna', ar: 'العين السخنة', aka: ['ain sukhna', 'sokhna'] },
  { key: 'faiyum', en: 'Faiyum', ar: 'الفيوم', aka: ['fayoum', 'fayyum'] },
  { key: 'beni_suef', en: 'Beni Suef', ar: 'بني سويف', aka: ['bani suwayf'] },
  { key: 'minya', en: 'Minya', ar: 'المنيا', aka: ['minia'] },
  { key: 'asyut', en: 'Asyut', ar: 'أسيوط', aka: ['assiut', 'assiout'] },
  { key: 'sohag', en: 'Sohag', ar: 'سوهاج', aka: ['suhaj'] },
  { key: 'qena', en: 'Qena', ar: 'قنا', aka: ['qina'] },
  { key: 'luxor', en: 'Luxor', ar: 'الأقصر', aka: ['uqsur'] },
  { key: 'aswan', en: 'Aswan', ar: 'أسوان' },
  { key: 'hurghada', en: 'Hurghada', ar: 'الغردقة', aka: ['ghardaqa', 'red sea'] },
  { key: 'el_gouna', en: 'El Gouna', ar: 'الجونة', aka: ['gouna'] },
  { key: 'safaga', en: 'Safaga', ar: 'سفاجا', aka: ['bur safajah'] },
  { key: 'marsa_alam', en: 'Marsa Alam', ar: 'مرسى علم' },
  { key: 'sharm_el_sheikh', en: 'Sharm El Sheikh', ar: 'شرم الشيخ', aka: ['sharm ash shaykh', 'sharm'] },
  { key: 'dahab', en: 'Dahab', ar: 'دهب' },
  { key: 'el_tor', en: 'El Tor', ar: 'الطور', aka: ['tor', 'south sinai'] },
  { key: 'arish', en: 'El Arish', ar: 'العريش', aka: ['arish', 'north sinai'] },
  { key: 'kharga', en: 'Kharga', ar: 'الخارجة', aka: ['new valley'] },
] as const satisfies readonly { key: string; en: string; ar: string; aka?: readonly string[] }[];

export type CityKey = (typeof CITIES)[number]['key'];

/** Cities A–Z for the picker. */
export const CITIES_AZ = [...CITIES].sort((a, b) => a.en.localeCompare(b.en));

export const cityName = (key: string | null) => CITIES.find((c) => c.key === key)?.en ?? null;

/**
 * "El-Mansoura City" → "mansoura": lower case, no article ("al", "el", and OSM's sun-letter
 * spellings "ash", "aj", "ad"…), "city", "governorate" or punctuation.
 */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(al|el|ad|adh|ar|as|ash|at|ath|az|aj|an|the|city|governorate|markaz|qism)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const LOOKUP = new Map<string, CityKey>(
  CITIES.flatMap((c) => [c.en, ...('aka' in c ? c.aka : [])].map((n) => [norm(n), c.key] as const)),
);

/** The first of these place names (most specific first) that is one of our cities. */
export function cityFromNames(names: (string | undefined)[]): CityKey | null {
  for (const n of names) {
    const key = n ? LOOKUP.get(norm(n)) : undefined;
    if (key) return key;
  }
  return null;
}
