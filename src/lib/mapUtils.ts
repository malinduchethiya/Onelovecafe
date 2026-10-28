export const OFFICIAL_ONELOVE_MAPS_EMBED_URL =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3951.519119209636!2d80.75919917521524!3d7.945183805011316!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3afca1006494c8f3%3A0x3133ed7279811046!2sOne%20Love%20cafe%20sigiriya!5e0!3m2!1sen!2sid!4v1793156766855!5m2!1sen!2sid';

export const OFFICIAL_ONELOVE_MAPS_PLACE_URL =
  'https://www.google.com/maps/place/One+Love+cafe+sigiriya/@7.9451838,80.7591992,17z/data=!3m1!4b1!4m6!3m5!1s0x3afca1006494c8f3:0x3133ed7279811046!8m2!3d7.9451838!4d80.7617741!16s%2Fg%2F11w42_8_1y';

export const OFFICIAL_ONELOVE_MAPS_DIRECTIONS_URL =
  'https://www.google.com/maps/dir/?api=1&destination=One+Love+cafe+sigiriya&destination_place_id=ChIJ88iUZACh_DoRRhCBeXLtMzE';

/**
 * Resolves a Google Maps input (iframe snippet, embed URL, share link, or query/coordinates)
 * into a clean, borderless embed URL.
 */
export function resolveGoogleMapsEmbedUrl(input?: string): string {
  if (!input || !input.trim()) {
    return OFFICIAL_ONELOVE_MAPS_EMBED_URL;
  }

  const trimmed = input.trim();

  // Upgrade legacy placeholder coordinates to the official One Love Cafe Sigiriya embed URL
  if (trimmed.includes('7.9541,80.7547')) {
    return OFFICIAL_ONELOVE_MAPS_EMBED_URL;
  }

  // 1. If input is a raw <iframe> snippet, extract src
  const iframeMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    const url = iframeMatch[1].trim();
    if (url.includes('google.com/maps/embed')) {
      return url;
    }
    return url.includes('iwloc=') ? url : `${url}${url.includes('?') ? '&' : '?'}iwloc=`;
  }

  // 2. If input is already a Google Mapspb embed URL, return it untouched
  if (trimmed.includes('google.com/maps/embed')) {
    return trimmed;
  }

  // 3. If input is a legacy output=embed URL
  if (trimmed.includes('output=embed')) {
    let url = trimmed;
    if (!url.includes('iwloc=')) {
      url += (url.includes('?') ? '&' : '?') + 'iwloc=';
    }
    return url;
  }

  // 4. If input is a standard Google Maps URL with ?q= or query
  if (trimmed.includes('google.com/maps') || trimmed.includes('maps.app.goo.gl')) {
    try {
      const parsed = new URL(trimmed);
      const q = parsed.searchParams.get('q') || parsed.searchParams.get('query');
      if (q) {
        return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
      }
    } catch {
      // Fall through
    }
  }

  // 5. If input is the default address or coordinates, use the official embed
  if (
    trimmed.toLowerCase().includes('lion rock sanctuary road') ||
    trimmed.includes('07°57\'25"N') ||
    trimmed.includes('07°56\'42.7"N')
  ) {
    return OFFICIAL_ONELOVE_MAPS_EMBED_URL;
  }

  return `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
}

/**
 * Returns a direct Google Maps external directions link for mobile navigation
 */
export function getGoogleMapsDirectionsUrl(input?: string): string {
  if (
    !input ||
    !input.trim() ||
    input.includes('7.9541,80.7547') ||
    input.includes('0x3afca1006494c8f3') ||
    input.includes('One%20Love%20cafe%20sigiriya')
  ) {
    return OFFICIAL_ONELOVE_MAPS_PLACE_URL;
  }
  const trimmed = input.trim();
  const iframeMatch = trimmed.match(/src=["']([^"']+)["']/i);
  const target = iframeMatch ? iframeMatch[1] : trimmed;
  if (target.includes('google.com/maps/embed')) {
    return OFFICIAL_ONELOVE_MAPS_PLACE_URL;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`;
}
