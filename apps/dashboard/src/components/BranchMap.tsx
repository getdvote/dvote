import 'maplibre-gl/dist/maplibre-gl.css';
import { AttributionControl, Map, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { useTheme } from '../lib/theme';
import type { LatLng } from './LocationPicker';

setWorkerUrl(workerUrl);

/** OpenMapTiles-derived styles, hosted by OpenFreeMap without API keys. */
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

/** Shared by every admin/merchant branch form; theme changes preserve the map and pin. */
export default function BranchMap({
  value,
  center,
  flyTo,
  onPick,
}: {
  value: LatLng | null;
  center: LatLng;
  flyTo: LatLng | null;
  onPick: (point: LatLng) => void;
}) {
  const { resolvedTheme } = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const marker = useRef<Marker | null>(null);
  const pick = useRef(onPick);
  const initial = useRef({ center, value, theme: resolvedTheme });
  const activeStyle = useRef(resolvedTheme);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);
  useEffect(() => {
    if (!container.current) return;
    let instance: Map;
    try {
      instance = new Map({
        container: container.current,
        style: STYLES[initial.current.theme],
        center: [initial.current.center.lng, initial.current.center.lat],
        zoom: initial.current.value ? 16 : 12,
        attributionControl: false,
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        renderWorldCopies: false,
      });
    } catch {
      setUnavailable(true);
      return;
    }
    map.current = instance;
    instance.addControl(new NavigationControl({ showCompass: false }), 'top-left');
    instance.addControl(new AttributionControl({ compact: false }), 'bottom-right');
    instance.on('click', (event) => pick.current({ lat: event.lngLat.lat, lng: event.lngLat.lng }));
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      marker.current?.remove();
      marker.current = null;
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (map.current && activeStyle.current !== resolvedTheme) {
      map.current.setStyle(STYLES[resolvedTheme]);
      activeStyle.current = resolvedTheme;
    }
  }, [resolvedTheme]);

  useEffect(() => {
    if (!map.current) return;
    if (!value) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      const element = document.createElement('div');
      element.className = 'branch-map-marker';
      element.innerHTML = '<div class="branch-map-pin"><span></span></div>';
      element.addEventListener('click', (event) => event.stopPropagation());
      marker.current = new Marker({ element, draggable: true, anchor: 'bottom' })
        .setLngLat([value.lng, value.lat])
        .addTo(map.current);
      marker.current.on('dragend', () => {
        const position = marker.current?.getLngLat();
        if (position) pick.current({ lat: position.lat, lng: position.lng });
      });
    } else marker.current.setLngLat([value.lng, value.lat]);
  }, [value]);

  useEffect(() => {
    if (map.current && flyTo)
      map.current.flyTo({
        center: [flyTo.lng, flyTo.lat],
        zoom: Math.max(map.current.getZoom(), 16),
        duration: 600,
      });
  }, [flyTo]);

  return (
    <>
      <div ref={container} className="size-full" aria-label={t('map.preview')} />
      {unavailable ? (
        <p
          role="status"
          className="absolute inset-0 grid place-content-center bg-muted p-6 text-center text-sm text-muted-foreground"
        >
          {t('map.unavailable')}
        </p>
      ) : null}
    </>
  );
}
