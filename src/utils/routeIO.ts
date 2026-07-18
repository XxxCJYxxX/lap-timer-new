import type { Route } from '../types';

export function exportRoute(route: Route): string {
  return JSON.stringify({
    name: route.name,
    waypoints: route.waypoints,
    exportedAt: new Date().toISOString(),
    version: '1.0',
  }, null, 2);
}

export function downloadRoute(route: Route) {
  const json = exportRoute(route);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${route.name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}.laproute.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseRouteFile(json: string): { name: string; waypoints: { lat: number; lng: number }[] } | null {
  try {
    const data = JSON.parse(json);
    if (!data.name || !Array.isArray(data.waypoints) || data.waypoints.length < 2) return null;
    for (const wp of data.waypoints) {
      if (typeof wp.lat !== 'number' || typeof wp.lng !== 'number') return null;
    }
    return { name: data.name, waypoints: data.waypoints };
  } catch {
    return null;
  }
}
