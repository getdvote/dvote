import { GpsIcon as Crosshair, LinkIcon as Link2, LoaderIcon as Loader2, MapPointIcon as MapPin, MagnifierIcon as Search, CloseIcon as X } from '@solar-icons/react/linear';
import { lazy, Suspense, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { t } from '../i18n';
import { cityFromNames, type CityKey } from '../lib/cities';

const BranchMap = lazy(() => import('./BranchMap'));

export interface LatLng {
  lat: number;
  lng: number;
}

/** Alexandria: where the map opens when the branch has no location yet. */
const START: LatLng = { lat: 31.2156, lng: 29.9553 };

/** The DB keeps 6 decimals (about 10 cm). */
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const valid = (p: LatLng) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

/**
 * Coordinates from a pasted Google Maps (or any map) link, or plain "31.21, 29.95".
 * Handles …/@31.2,29.9,17z, …!3d31.2!4d29.9, ?q=31.2,29.9, ?query=…, ?ll=…, ?destination=….
 * Short links (maps.app.goo.gl/…) carry no coordinates: open them first and copy the full link.
 */
export function coordsFromText(text: string): LatLng | null {
  const t = decodeURIComponent(text.trim());
  const num = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
  const patterns = [
    new RegExp(String.raw`!3d${num}!4d${num}`), // the exact pin of a place
    new RegExp(String.raw`@${num},${num}`), // the map centre
    new RegExp(String.raw`[?&](?:q|query|ll|destination|center)=${num},\s*${num}`),
    new RegExp(String.raw`^${num}\s*,\s*${num}$`),
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const p = { lat: Number(m[1]), lng: Number(m[2]) };
      if (valid(p)) return { lat: round(p.lat), lng: round(p.lng) };
    }
  }
  return null;
}

export interface PlaceAddress {
  /** First line, e.g. "12 Fouad Street" */
  line: string | null;
  /** One of our cities, when the place is in one */
  city: CityKey | null;
}

/**
 * The address at a point, from OpenStreetMap's reverse lookup. The first line falls back to the
 * place's name, then to the first part of its full address.
 */
export async function addressAt(p: LatLng): Promise<PlaceAddress | null> {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${p.lat}&lon=${p.lng}`, {
    headers: { 'Accept-Language': 'en' },
  });
  if (!res.ok) return null;
  const r = (await res.json()) as { name?: string; display_name?: string; address?: Record<string, string> };
  const a = r.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(' ');
  return {
    line: street || r.name || r.display_name?.split(',')[0]?.trim() || null,
    // Most specific first: "New Cairo" before "Cairo Governorate".
    city: cityFromNames([a.city, a.town, a.municipality, a.suburb, a.village, a.city_district, a.county, a.state_district, a.state]),
  };
}

/**
 * Pick a branch's location: search a place, paste a Google Maps link, use this device's
 * location, or click / drag the pin on the map. Latitude and longitude are filled from the
 * chosen place, never typed. `value` null = no location. `onAddress` gets the address (first
 * line and city) at each newly chosen point.
 */
export function LocationPicker({
  value,
  onChange,
  onAddress,
}: {
  value: LatLng | null;
  onChange: (v: LatLng | null) => void;
  onAddress?: (address: PlaceAddress) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ name: string; at: LatLng }[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [link, setLink] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<LatLng | null>(null);
  // Only the latest pick may fill the address (an older lookup can answer last).
  const lookup = useRef(0);

  const choose = (p: LatLng) => {
    const v = { lat: round(p.lat), lng: round(p.lng) };
    onChange(v);
    setFlyTo(v);
    setProblem(null);
    if (onAddress) {
      const id = ++lookup.current;
      addressAt(v)
        .then((address) => {
          if (address && id === lookup.current) onAddress(address);
        })
        .catch(() => {}); // The address is a convenience; the pin is already set.
    }
  };

  async function search() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setProblem(null);
    try {
      // OpenStreetMap's free place search (no key; fine for occasional admin use).
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`, {
        headers: { 'Accept-Language': 'en' },
      });
      const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      setResults(rows.map((r) => ({ name: r.display_name, at: { lat: Number(r.lat), lng: Number(r.lon) } })));
      if (!rows.length) setProblem(t('map.noPlace'));
    } catch {
      setProblem(t('map.searchFailed'));
    } finally {
      setSearching(false);
    }
  }

  function applyLink(text: string) {
    setLink(text);
    if (!text.trim()) return setProblem(null);
    const p = coordsFromText(text);
    if (p) {
      choose(p);
    } else if (/goo\.gl|maps\.app/.test(text)) {
      setProblem(t('map.shortLink'));
    } else {
      setProblem(t('map.noCoords'));
    }
  }

  function locateMe() {
    if (!navigator.geolocation) return setProblem(t('map.noGeo'));
    navigator.geolocation.getCurrentPosition(
      (pos) => choose({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setProblem(t('map.refused')),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="grid min-w-0 gap-3 rounded-xl border bg-muted/20 p-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void search();
              }
            }}
            placeholder={t('map.searchPlaceholder')}
            className="ps-9"
            aria-label={t('map.searchLabel')}
          />
        </div>
        <Button type="button" variant="outline" size="icon" aria-label={t('common.search')} title={t('common.search')} onClick={() => void search()} disabled={searching || !query.trim()}>
          {searching ? <Loader2 className="animate-spin" /> : <Search />}
        </Button>
        <Button type="button" variant="outline" size="icon" title={t('map.myLocation')} aria-label={t('map.myLocation')} onClick={locateMe}>
          <Crosshair />
        </Button>
      </div>

      {results?.length ? (
        <ul className="max-h-44 overflow-y-auto rounded-lg border bg-card text-sm shadow-sm">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-start hover:bg-muted"
                onClick={() => {
                  choose(r.at);
                  setResults(null);
                }}
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span className="line-clamp-2">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <details className="group rounded-lg border bg-card px-3 py-2">
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">{t('map.linkLabel')}</summary>
      <div className="relative mt-2">
        <Link2 className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={link} onChange={(e) => applyLink(e.target.value)} placeholder={t('map.linkPlaceholder')} className="ps-9" dir="ltr" aria-label={t('map.linkLabel')} />
      </div>
      </details>

      <div className="branch-location-map relative isolate h-72 overflow-hidden rounded-xl border shadow-sm sm:h-80">
        <Suspense fallback={<div className="grid size-full place-content-center bg-muted"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}>
          <BranchMap value={value} center={value ?? START} flyTo={flyTo} onPick={choose} />
        </Suspense>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm" aria-live="polite">
        {value ? (
          <span className="text-muted-foreground tabular-nums">
            <span className="mb-1 block text-xs font-medium text-foreground">{t('map.selected')}</span>
            <MapPin className="me-1 inline size-3.5 text-primary" />
            <span dir="ltr">
              {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">{t('map.none')}</span>
        )}
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X /> {t('map.clear')}
          </Button>
        ) : null}
      </div>
      {problem ? <p className="text-xs text-destructive">{problem}</p> : null}
    </div>
  );
}
