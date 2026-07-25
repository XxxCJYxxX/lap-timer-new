export interface RouteResult {
  distance: number;  // meters
  duration: number;  // seconds
  coordinates: [number, number][];  // [lng, lat][]
}

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

export async function fetchRoute(
  fromLng: number, fromLat: number,
  toLng: number, toLat: number
): Promise<RouteResult | null> {
  try {
    const url = `${OSRM_URL}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=false`;
    const res = await fetch(url);

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];
    return {
      distance: route.distance,
      duration: route.duration,
      coordinates: route.geometry.coordinates,
    };
  } catch {
    return null;
  }
}
