import { ActionSheetIOS, Linking, Platform } from 'react-native';
import { t } from '../i18n';

/** A place to open in a maps app: coordinates when known, otherwise the address. */
export interface Place {
  name: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
}

/**
 * Opens a place in a maps app with deep links (not a website).
 * - iOS: asks Apple Maps or Google Maps (system action sheet). If Google Maps isn't
 *   installed, its link fails and the place opens on google.com/maps instead.
 * - Android: opens straight away with a `geo:` link, which Google Maps handles.
 */
export function openInMaps(place: Place) {
  const hasCoords = place.lat !== null && place.lng !== null;
  const coords = hasCoords ? `${place.lat},${place.lng}` : null;
  const query = coords ?? place.address ?? place.name;

  if (Platform.OS === 'ios') {
    const options = [t('maps.apple'), t('maps.google'), t('common.cancel')];
    ActionSheetIOS.showActionSheetWithOptions(
      { title: place.name, message: place.address ?? undefined, options, cancelButtonIndex: 2 },
      (i) => {
        if (i === 0) void open(appleMapsUrl(place, coords, query));
        else if (i === 1) void open(`comgooglemaps://?q=${enc(query)}${coords ? `&center=${coords}&zoom=16` : ''}`, webUrl(query));
      },
    );
    return;
  }

  // Android: geo: opens Google Maps (the default maps app); the label names the pin.
  const geo = coords ? `geo:${coords}?q=${coords}(${enc(place.name)})` : `geo:0,0?q=${enc(query)}`;
  void open(geo, webUrl(query));
}

/** Apple Maps: `ll` drops a pin at the coordinates, `q` labels it with the branch name. */
function appleMapsUrl(place: Place, coords: string | null, query: string) {
  return coords ? `maps://?ll=${coords}&q=${enc(place.name)}` : `maps://?q=${enc(query)}`;
}

function webUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${enc(query)}`;
}

/** Opens `url`; if no app can handle it, opens `fallback` (if given). */
async function open(url: string, fallback?: string) {
  try {
    await Linking.openURL(url);
  } catch {
    if (fallback) await Linking.openURL(fallback).catch(() => undefined);
  }
}

const enc = encodeURIComponent;
