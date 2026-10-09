import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Crosshair, Link2, Loader2, MapPin, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

/**
 * The first line of the address at a point (e.g. "12 Fouad Street"), from OpenStreetMap's
 * reverse lookup. Falls back to the place's name, then to the first part of its full address.
 */
export async function addressLineAt(p: LatLng): Promise<string | null> {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${p.lat}&lon=${p.lng}`, {
    headers: { 'Accept-Language': 'en' },
  });
  if (!res.ok) return null;
  const r = (await res.json()) as { name?: string; display_name?: string; address?: Record<string, string> };
  const street = [r.address?.house_number, r.address?.road].filter(Boolean).join(' ');
  return street || r.name || r.display_name?.split(',')[0]?.trim() || null;
}

// A CSS pin (Leaflet's default marker images don't survive bundling).
const pin = L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:var(--primary);transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

/**
 * Pick a branch's location: search a place, paste a Google Maps link, use this device's
 * location, or click / drag the pin on the map. Latitude and longitude are filled from the
 * chosen place, never typed. `value` null = no location. `onAddress` gets the first line of
 * the address at each newly chosen point.
 */
export function LocationPicker({
  value,
  onChange,
  onAddress,
}: {
  value: LatLng | null;
  onChange: (v: LatLng | null) => void;
  onAddress?: (line: string) => void;
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
      addressLineAt(v)
        .then((line) => {
          if (line && id === lookup.current) onAddress(line);
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
      if (!rows.length) setProblem('No place found. Try another name, or click the map.');
    } catch {
      setProblem("Couldn't search right now. Paste a Google Maps link or click the map instead.");
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
      setProblem('Short links have no coordinates: open the link in your browser, then copy the full address from the address bar.');
    } else {
      setProblem("That link has no coordinates. In Google Maps, open the place and copy the link from the address bar.");
    }
  }

  function locateMe() {
    if (!navigator.geolocation) return setProblem("This browser can't share its location.");
    navigator.geolocation.getCurrentPosition(
      (pos) => choose({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setProblem('Location permission was refused.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="grid gap-2.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void search();
              }
            }}
            placeholder="Search a place or address"
            className="pl-9"
            aria-label="Search a place"
          />
        </div>
        <Button type="button" variant="outline" onClick={() => void search()} disabled={searching}>
          {searching ? <Loader2 className="animate-spin" /> : 'Search'}
        </Button>
        <Button type="button" variant="outline" size="icon" title="Use my current location" aria-label="Use my current location" onClick={locateMe}>
          <Crosshair />
        </Button>
      </div>

      {results?.length ? (
        <ul className="max-h-36 overflow-y-auto rounded-lg border text-sm">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted"
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

      <div className="relative">
        <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={link} onChange={(e) => applyLink(e.target.value)} placeholder="…or paste a Google Maps link" className="pl-9" aria-label="Google Maps link" />
      </div>

      <div className="h-64 overflow-hidden rounded-lg border">
        <MapContainer center={value ?? START} zoom={value ? 16 : 12} className="size-full" scrollWheelZoom>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapEvents onPick={choose} flyTo={flyTo} />
          {value ? (
            <Marker
              position={value}
              icon={pin}
              draggable
              eventHandlers={{ dragend: (e) => choose((e.target as L.Marker).getLatLng()) }}
            />
          ) : null}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        {value ? (
          <span className="text-muted-foreground tabular-nums">
            <MapPin className="mr-1 inline size-3.5 text-primary" />
            {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
          </span>
        ) : (
          <span className="text-muted-foreground">No location yet: click the map where the shop is.</span>
        )}
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X /> Clear location
          </Button>
        ) : null}
      </div>
      {problem ? <p className="text-xs text-destructive">{problem}</p> : null}
    </div>
  );
}

/** Click to drop the pin; fly to a chosen place; fix the map size once the dialog has opened. */
function MapEvents({ onPick, flyTo }: { onPick: (p: LatLng) => void; flyTo: LatLng | null }) {
  const map = useMap();
  useMapEvents({ click: (e) => onPick(e.latlng) });
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [map]);
  useEffect(() => {
    if (flyTo) map.flyTo(flyTo, Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [flyTo, map]);
  return null;
}
