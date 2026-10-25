/**
 * Resolves a Google Maps input (iframe snippet, embed URL, share link, or query/coordinates)
 * into a clean, borderless embed URL with no popup balloons (iwloc=) or clutter.
 */
export function resolveGoogleMapsEmbedUrl(input?: string): string {
  const defaultEmbed =
    'https://maps.google.com/maps?q=7.9541,80.7547+(OneLove+Caf%C3%A9+Sigiriya)&t=&z=15&ie=UTF8&iwloc=&output=embed';

  if (!input || !input.trim()) {
    return defaultEmbed;
  }

  const trimmed = input.trim();

  // 1. If input is a raw <iframe> snippet, extract src
  const iframeMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    let url = iframeMatch[1];
    if (!url.includes('iwloc=')) {
      url += (url.includes('?') ? '&' : '?') + 'iwloc=';
    }
    return url;
  }

  // 2. If input is already an embed URL
  if (trimmed.includes('google.com/maps/embed') || trimmed.includes('output=embed')) {
    let url = trimmed;
    if (!url.includes('iwloc=')) {
      url += (url.includes('?') ? '&' : '?') + 'iwloc=';
    }
    return url;
  }

  // 3. If input is a standard Google Maps URL with ?q= or query
  if (trimmed.includes('google.com/maps') || trimmed.includes('maps.app.goo.gl')) {
    try {
      const parsed = new URL(trimmed);
      const q = parsed.searchParams.get('q') || parsed.searchParams.get('query');
      if (q) {
        return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
      }
    } catch {
      // Fall through to query encoding
    }
  }

  // 4. If input is an address, landmark, or lat,lng coordinates
  return `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
}

/**
 * Returns a direct Google Maps external directions link for mobile navigation
 */
export function getGoogleMapsDirectionsUrl(input?: string): string {
  const defaultQuery = '7.9541,80.7547 (OneLove Café Sigiriya)';
  if (!input || !input.trim()) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(defaultQuery)}`;
  }
  const trimmed = input.trim();
  const iframeMatch = trimmed.match(/src=["']([^"']+)["']/i);
  const target = iframeMatch ? iframeMatch[1] : trimmed;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`;
}
