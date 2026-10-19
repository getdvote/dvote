import { GpsIcon as Crosshair, LoaderIcon as Loader2, MapPointIcon as MapPin, MagnifierIcon as Search, CloseIcon as X } from '@solar-icons/react/linear';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CameraBlockedHelp, PermissionDemo } from './camera-help';
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
  let t = text.trim();
  try { t = decodeURIComponent(t); } catch { /* A malformed pasted URL is not a coordinate. */ }
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
 * Pick a branch's location: search a place, use this device's
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
  const [searchOpen, setSearchOpen] = useState(false);
  const searchArea = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<LatLng | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<LatLng | null>(null);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [locationBlocked, setLocationBlocked] = useState(false);
  const [locating, setLocating] = useState(false);
  const placePin = useRef(false);
  const focus = deviceLocation ?? value ?? START;
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

  useEffect(() => {
    let active = true;
    if (!navigator.permissions) {
      setPermissionOpen(true);
      return;
    }
    navigator.permissions?.query({ name: 'geolocation' }).then((permission) => {
      if (!active) return;
      if (permission.state === 'granted') {
        navigator.geolocation?.getCurrentPosition(
          ({ coords }) => { if (active) setDeviceLocation({ lat: coords.latitude, lng: coords.longitude }); },
          () => {}, { maximumAge: 300_000, timeout: 10_000 },
        );
      } else {
        setLocationBlocked(permission.state === 'denied');
        setPermissionOpen(true);
      }
    }).catch(() => { if (active) setPermissionOpen(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!searchArea.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  useEffect(() => {
    setResults(null);
    setSearching(false);
    if (!searchOpen || query.trim().length < 3) return;
    const point = coordsFromText(query);
    if (point) {
      choose(point);
      setSearchOpen(false);
      return;
    }
    if (/^https?:\/\//i.test(query.trim())) {
      setProblem(t(/goo\.gl|maps\.app/i.test(query) ? 'map.shortLink' : 'map.noCoords'));
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => void search(controller.signal), 400);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, searchOpen, focus.lat, focus.lng]);

  async function search(signal: AbortSignal) {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setProblem(null);
    try {
      // Photon supports search as you type; public Nominatim does not.
      const params = new URLSearchParams({ q, limit: '15', countrycode: 'EG', lat: String(focus.lat), lon: String(focus.lng), location_bias_scale: '0.1' });
      const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
        signal,
      });
      if (!res.ok) throw new Error('Place search failed');
      const data = (await res.json()) as { features: { geometry: { coordinates: number[] }; properties: Record<string, string> }[] };
      if (signal.aborted) return;
      const distance = (p: LatLng) => {
        const radians = Math.PI / 180;
        return Math.sin((p.lat - focus.lat) * radians / 2) ** 2
          + Math.cos(focus.lat * radians) * Math.cos(p.lat * radians) * Math.sin((p.lng - focus.lng) * radians / 2) ** 2;
      };
      setResults(data.features.filter(({ properties: p }) => p.countrycode?.toUpperCase() === 'EG').map(({ geometry, properties: p }) => ({
        name: [...new Set([p.name, [p.housenumber, p.street].filter(Boolean).join(' '), p.city, p.state, p.country].filter(Boolean))].join(', '),
        at: { lat: geometry.coordinates[1], lng: geometry.coordinates[0] },
      })).filter((place) => valid(place.at)).sort((a, b) => distance(a.at) - distance(b.at)).slice(0, 5));
    } catch {
      if (!signal.aborted) setProblem(t('map.searchFailed'));
    } finally {
      if (!signal.aborted) setSearching(false);
    }
  }

  function locateMe() {
    placePin.current = true;
    setPermissionOpen(true);
  }

  function requestLocation() {
    if (!navigator.geolocation) return setProblem(t('map.noGeo'));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDeviceLocation(point);
        if (placePin.current) choose(point);
        placePin.current = false;
        setLocating(false);
        setLocationBlocked(false);
        setPermissionOpen(false);
      },
      (error) => {
        setLocating(false);
        if (error.code === 1) setLocationBlocked(true);
        else setProblem(t('map.refused'));
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="grid min-w-0 gap-3 rounded-xl border bg-muted/20 p-3">
      <Dialog open={permissionOpen} onOpenChange={setPermissionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('map.permission.title')}</DialogTitle>
            <DialogDescription>{t('map.permission.body')}</DialogDescription>
          </DialogHeader>
          {locationBlocked ? <CameraBlockedHelp location /> : <>
            <PermissionDemo location />
            <Button type="button" disabled={locating} onClick={requestLocation}>
              {locating ? <Loader2 className="animate-spin" /> : <Crosshair />}
              {t('map.permission.allow')}
            </Button>
          </>}
          <Button type="button" variant="outline" onClick={() => setPermissionOpen(false)}>{t('map.permission.skip')}</Button>
        </DialogContent>
      </Dialog>
      <div ref={searchArea} className="relative flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && searchOpen) { e.stopPropagation(); setSearchOpen(false); }
              if (e.key === 'Enter') {
                e.preventDefault();
                setSearchOpen(true);
              }
            }}
            placeholder={t('map.searchPlaceholder')}
            className="ps-9"
            aria-label={t('map.searchLabel')}
          />
        </div>
        {searching && <Loader2 className="my-auto size-4 shrink-0 animate-spin" aria-label={t('common.loading')} />}
        <Button type="button" variant="outline" size="icon" title={t('map.myLocation')} aria-label={t('map.myLocation')} onClick={locateMe}>
          <Crosshair />
        </Button>
      {searchOpen && results?.length ? (
        <ul className="absolute inset-x-0 top-full z-20 mt-2 max-h-52 overflow-y-auto rounded-lg border bg-card text-sm shadow-lg">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-start hover:bg-muted"
                onClick={() => {
                  choose(r.at);
                  setSearchOpen(false);
                }}
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span className="line-clamp-2">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {searchOpen && results?.length === 0 && <p role="status" className="absolute inset-x-0 top-full z-20 mt-2 rounded-lg border bg-card p-3 text-sm shadow-lg">{t('map.noPlace')}</p>}
      </div>

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
