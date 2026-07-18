export interface GeocoderResult {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeocoderResult[]> {
  if (!query.trim()) return [];

  const url = new URL(`${NOMINATIM_URL}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '6');
  url.searchParams.set('accept-language', 'zh,en');
  url.searchParams.set('addressdetails', '0');

  const res = await fetch(url.toString(), {
    signal,
    headers: {
      'User-Agent': 'LapTimer/1.0 (local dev)',
    },
  });

  if (!res.ok) throw new Error(`Geocoder error: ${res.status}`);
  return res.json();
}

export function formatGeocoderLabel(result: GeocoderResult): string {
  const parts = result.display_name.split(',').map((s) => s.trim());
  return parts.slice(0, 3).join(', ');
}
