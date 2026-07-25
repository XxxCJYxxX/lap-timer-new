import { useEffect, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRouteStore } from '../stores/routeStore';
import { useTimerStore } from '../stores/timerStore';
import { useLocationStore } from '../stores/locationStore';
import { useNavStore } from '../stores/navStore';
import { toDisplayCoords, getTileProvider, setTileProvider } from '../utils/coord';
import { amapRoadLayer, BASE_LAYERS } from '../utils/tiles';
import { haversine } from '../utils/distance';
import { encodePolyline } from '../utils/seedcode';
import { downloadRoute } from '../utils/routeIO';
import { fetchRoute } from '../utils/routing';
import type { Route } from '../types';
import type { TileProvider } from '../types';

// Fix Leaflet default icon paths
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const START_ICON = L.divIcon({
  className: 'start-marker',
  html: `
    <div style="width:36px;height:36px;border-radius:50%;background:var(--green);border:2.5px solid rgba(255,255,255,0.9);
      display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(48,209,88,0.4);">
      <span style="color:#000;font-size:14px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">S</span>
    </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const FINISH_ICON = L.divIcon({
  className: 'finish-marker',
  html: `
    <div style="width:36px;height:36px;border-radius:50%;background:var(--red);border:2.5px solid rgba(255,255,255,0.9);
      display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(255,69,58,0.4);">
      <span style="color:#fff;font-size:14px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">F</span>
    </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const LOCATION_ICON = L.divIcon({
  className: 'location-pulse',
  html: `
    <div style="position:relative;width:24px;height:24px;">
      <div class="location-dot-pulse" style="position:absolute;inset:-12px;border-radius:50%;background:rgba(10,132,255,0.2);"></div>
      <div style="position:absolute;inset:0;border-radius:50%;background:#0A84FF;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>
    </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const DEST_ICON = L.divIcon({
  className: 'dest-marker',
  html: `
    <div style="position:relative;">
      <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
        <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="#FF453A"/>
        <circle cx="14" cy="14" r="5" fill="#fff" opacity="0.9"/>
      </svg>
    </div>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
});

interface Props {
  flyTo?: { lat: number; lng: number; label: string } | null;
  onFlyComplete?: () => void;
}

/** Build a native-DOM context menu for a route (used inside Leaflet popup) */
function buildRouteMenu(route: Route, map: L.Map): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:150px;padding:4px;';

  const title = document.createElement('div');
  title.textContent = route.name;
  title.style.cssText = 'font-size:12px;font-weight:600;color:rgba(255,255,255,0.45);padding:4px 10px 8px;border-bottom:0.5px solid rgba(255,255,255,0.08);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;';
  container.appendChild(title);

  const mkBtn = (label: string, onClick: (btn: HTMLButtonElement) => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'all:unset;cursor:pointer;padding:9px 10px;border-radius:8px;font-size:13px;color:rgba(255,255,255,0.92);display:block;width:100%;box-sizing:border-box;-webkit-tap-highlight-color:transparent;';
    b.addEventListener('touchstart', () => { b.style.background = 'rgba(255,255,255,0.1)'; }, { passive: true });
    b.addEventListener('touchend', () => { setTimeout(() => { b.style.background = 'transparent'; }, 150); }, { passive: true });
    b.onmouseenter = () => { b.style.background = 'rgba(255,255,255,0.08)'; };
    b.onmouseleave = () => { b.style.background = 'transparent'; };
    b.onclick = () => onClick(b);
    container.appendChild(b);
    return b;
  };

  mkBtn('📋 复制种子', async (btn) => {
    const code = encodePolyline(route.waypoints);
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    btn.textContent = '✓ 已复制';
    btn.style.color = '#30D158';
    setTimeout(() => { btn.textContent = '📋 复制种子'; btn.style.color = 'rgba(255,255,255,0.92)'; }, 1500);
  });

  mkBtn('↩ 反跑', () => {
    useRouteStore.getState().reverseRoute(route.id!);
    map.closePopup();
  });

  mkBtn('📥 导出 JSON', () => {
    downloadRoute(route);
    map.closePopup();
  });

  return container;
}

export default function MapView({ flyTo, onFlyComplete }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const locationMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const locationWatchId = useRef<number | null>(null);
  const isFollowingRef = useRef(false);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routeFetchedRef = useRef<boolean>(false);
  const prevPosRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const lastGpsUpdateRef = useRef<{ lat: number; lng: number }>({ lat: 0, lng: 0 });
  const lastDisplayPosRef = useRef<[number, number]>([39.9042, 116.4074]);
  const lastPanToRef = useRef<number>(0);
  const prevFollowModeRef = useRef<boolean>(false);

  const { isCreating, createStep, draftWaypoints, activeRouteId, routes, addWaypoint } = useRouteStore();
  const followMode = useTimerStore((s) => s.followMode);

  const [, setProviderState] = useState<TileProvider>(getTileProvider());
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [activeLayerName, setActiveLayerName] = useState('高德地图');
  const currentBaseLayerRef = useRef<L.Layer>(amapRoadLayer);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [39.9042, 116.4074],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      renderer: L.canvas({ padding: 0.5 }),
      layers: [amapRoadLayer],
    });

    // No native controls — Apple Maps style: gestures for zoom, custom stack for the rest

    // Detect manual pan to disable follow
    map.on('dragstart', () => {
      if (isFollowingRef.current) {
        // User manually panned - we'll keep following but note the gesture
      }
    });

    mapRef.current = map;
    markersGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      stopLocationWatch();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Refresh route markers when state changes
  const refreshMarkers = useCallback(() => {
    const map = mapRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const activeRoute = routes.find((r) => r.id === activeRouteId);

    if (isCreating && draftWaypoints.length > 0) {
      // Render all draft waypoints
      const points: L.LatLngExpression[] = [];
      draftWaypoints.forEach((wp, i) => {
        const [lng, lat] = toDisplayCoords(wp.lng, wp.lat);
        points.push([lat, lng]);
        const isFirst = i === 0;
        const isLast = i === draftWaypoints.length - 1 && draftWaypoints.length > 1;
        const num = i + 1;
        const icon = isFirst
          ? L.divIcon({
              className: '',
              html: `<div style="width:32px;height:32px;border-radius:50%;background:var(--green);border:2px solid rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(48,209,88,0.4);color:#000;font-size:13px;font-weight:700">S</div>`,
              iconSize: [32, 32], iconAnchor: [16, 16],
            })
          : isLast
          ? L.divIcon({
              className: '',
              html: `<div style="width:32px;height:32px;border-radius:50%;background:var(--red);border:2px solid rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(255,69,58,0.4);color:#fff;font-size:13px;font-weight:700">F</div>`,
              iconSize: [32, 32], iconAnchor: [16, 16],
            })
          : L.divIcon({
              className: '',
              html: `<div style="width:28px;height:28px;border-radius:50%;background:rgba(118,118,128,0.7);border:2px solid rgba(255,255,255,0.6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:600">${num}</div>`,
              iconSize: [28, 28], iconAnchor: [14, 14],
            });
        L.marker([lat, lng], { icon, zIndexOffset: 900 - i }).addTo(group);
      });
      if (points.length >= 2) {
        L.polyline(points, { color: '#BF5AF2', weight: 2.5, dashArray: '8 4', opacity: 0.8 }).addTo(group);
      }
    } else if (activeRoute && activeRoute.waypoints.length > 0) {
      const allWps = activeRoute.waypoints;
      const points: L.LatLngExpression[] = [];
      allWps.forEach((wp, i) => {
        const [lng, lat] = toDisplayCoords(wp.lng, wp.lat);
        points.push([lat, lng]);
        const isFirst = i === 0;
        const isLast = i === allWps.length - 1;
        const icon = isFirst ? START_ICON : isLast ? FINISH_ICON : L.divIcon({
          className: '',
          html: `<div style="width:24px;height:24px;border-radius:50%;background:rgba(118,118,128,0.6);border:1.5px solid rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:600">${i+1}</div>`,
          iconSize: [24, 24], iconAnchor: [12, 12],
        });
        L.marker([lat, lng], { icon })
          .addTo(group)
          .bindPopup(() => buildRouteMenu(activeRoute, map), { className: 'search-popup', closeButton: false, offset: [0, -8] });
      });
      if (points.length >= 2) {
        L.polyline(points, { color: '#BF5AF2', weight: 2.5, opacity: 0.7 })
          .addTo(group)
          .bindPopup(() => buildRouteMenu(activeRoute, map), { className: 'search-popup', closeButton: false });
      }
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds.pad(0.3));
    }
  }, [isCreating, createStep, draftWaypoints, activeRouteId, routes]);

  useEffect(() => { refreshMarkers(); }, [refreshMarkers]);

  // ── Navigation: render route polyline + destination marker ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const { route, destination } = useNavStore.getState();

    // Clean up previous route polyline
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
    // Clean up previous destination marker
    if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }

    // Draw destination marker
    if (destination) {
      const [dlng, dlat] = toDisplayCoords(destination.lng, destination.lat);
      destMarkerRef.current = L.marker([dlat, dlng], { icon: DEST_ICON, zIndexOffset: 950 })
        .addTo(map)
        .bindPopup(destination.name, { closeButton: false, className: 'search-popup' });
    }

    // Draw route polyline
    if (route && route.coordinates.length >= 2) {
      const displayCoords: L.LatLngExpression[] = route.coordinates.map(([lng, lat]) => {
        const [dlng, dlat] = toDisplayCoords(lng, lat);
        return [dlat, dlng];
      });
      routePolylineRef.current = L.polyline(displayCoords, {
        color: '#0A84FF',
        weight: 5,
        opacity: 0.8,
        dashArray: '10 6',
      }).addTo(map);
    }
  }, [useNavStore.getState().route, useNavStore.getState().destination]);

  // Subscribe to navStore changes for route/destination rendering
  useEffect(() => {
    const unsub = useNavStore.subscribe((state, prev) => {
      const map = mapRef.current;
      if (!map) return;

      // Route changed
      if (state.route !== prev.route) {
        if (routePolylineRef.current) {
          routePolylineRef.current.remove();
          routePolylineRef.current = null;
        }
        if (state.route && state.route.coordinates.length >= 2) {
          const displayCoords: L.LatLngExpression[] = state.route.coordinates.map(([lng, lat]) => {
            const [dlng, dlat] = toDisplayCoords(lng, lat);
            return [dlat, dlng];
          });
          routePolylineRef.current = L.polyline(displayCoords, {
            color: '#0A84FF',
            weight: 5,
            opacity: 0.8,
            dashArray: '10 6',
          }).addTo(map);
        }
      }

      // Destination changed
      if (state.destination !== prev.destination) {
        if (destMarkerRef.current) {
          destMarkerRef.current.remove();
          destMarkerRef.current = null;
        }
        if (state.destination) {
          const [dlng, dlat] = toDisplayCoords(state.destination.lng, state.destination.lat);
          destMarkerRef.current = L.marker([dlat, dlng], { icon: DEST_ICON, zIndexOffset: 950 })
            .addTo(map)
            .bindPopup(state.destination.name, { closeButton: false, className: 'search-popup' });
        }
      }
    });

    return () => unsub();
  }, []);

  // Fetch route when GPS becomes available after destination is set
  useEffect(() => {
    if (routeFetchedRef.current) return;

    const gpsPos = useLocationStore.getState();
    const navState = useNavStore.getState();

    if (gpsPos.lat !== null && gpsPos.lng !== null && navState.destination && !navState.route) {
      routeFetchedRef.current = true;
      useNavStore.getState().setLoading(true);
      fetchRoute(gpsPos.lng, gpsPos.lat, navState.destination.lng, navState.destination.lat).then((r) => {
        useNavStore.getState().setRoute(r);
        useNavStore.getState().setLoading(false);
      });
    }

    // Reset the flag when destination is cleared
    const unsub = useNavStore.subscribe((state) => {
      if (!state.destination) {
        routeFetchedRef.current = false;
      }
    });
    return () => unsub();
  }, []);

  // Map click for route creation — separate effect to capture latest state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handler = (e: L.LeafletMouseEvent) => {
      if (!isCreating || createStep !== 'adding_points') return;
      addWaypoint(e.latlng.lng, e.latlng.lat);
    };

    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [isCreating, createStep, addWaypoint]);

  // ── Location tracking ──

  const cleanupLocationUI = () => {
    if (locationMarkerRef.current) { locationMarkerRef.current.remove(); locationMarkerRef.current = null; }
    if (accuracyCircleRef.current) { accuracyCircleRef.current.remove(); accuracyCircleRef.current = null; }
  };

  const stopLocationWatch = () => {
    if (locationWatchId.current !== null) {
      navigator.geolocation.clearWatch(locationWatchId.current);
      locationWatchId.current = null;
    }
    cleanupLocationUI();
    useLocationStore.getState().clearPosition();
    useTimerStore.getState().setDistance(null);
    setIsLocating(false);
    isFollowingRef.current = false;
  };

  const startLocationWatch = () => {
    if (!navigator.geolocation) { setLocationError('设备不支持定位'); return; }

    // Speed calculation helper (also used by throttled path)
    const updateSpeed = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      const now = pos.timestamp;
      if (prevPosRef.current) {
        const dt = (now - prevPosRef.current.ts) / 1000;
        if (dt > 0.5 && dt < 30) {
          const dist = haversine(latitude, longitude, prevPosRef.current.lat, prevPosRef.current.lng);
          const speedKmh = (dist / dt) * 3.6;
          if (speedKmh < 400) useTimerStore.getState().setSpeed(speedKmh);
        }
      }
      prevPosRef.current = { lat: latitude, lng: longitude, ts: now };
    };

    isFollowingRef.current = true;
    locationWatchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const map = mapRef.current;
        if (!map) return;
        const { latitude, longitude, accuracy } = pos.coords;
        const [lng, lat] = toDisplayCoords(longitude, latitude);

        // Throttle: skip if position changed < 5m (battery saving)
        const last = lastGpsUpdateRef.current;
        const moved = haversine(latitude, longitude, last.lat, last.lng);
        if (moved < 5 && locationMarkerRef.current) {
          updateSpeed(pos);
          useTimerStore.getState().checkAutoSplit(latitude, longitude);
          return;
        }
        lastGpsUpdateRef.current = { lat: latitude, lng: longitude };
        lastDisplayPosRef.current = [lat, lng];
        if (!locationMarkerRef.current) {
          locationMarkerRef.current = L.marker([lat, lng], { icon: LOCATION_ICON, zIndexOffset: 1000 }).addTo(map);
        } else {
          locationMarkerRef.current.setLatLng([lat, lng]);
        }
        if (accuracy > 0) {
          if (!accuracyCircleRef.current) {
            accuracyCircleRef.current = L.circle([lat, lng], {
              radius: accuracy, color: '#0A84FF', fillColor: '#0A84FF', fillOpacity: 0.06, weight: 0.5, interactive: false,
            }).addTo(map);
          } else {
            accuracyCircleRef.current.setLatLng([lat, lng]);
            accuracyCircleRef.current.setRadius(accuracy);
          }
        }
        if (isFollowingRef.current || followMode) {
          const now = performance.now();
          if (now - lastPanToRef.current > 200) {
            map.panTo([lat, lng], { animate: true, duration: 0.3 });
            lastPanToRef.current = now;
          }
          const speed = useTimerStore.getState().currentSpeed ?? 0;
          let targetZoom: number;
          if (speed < 10) targetZoom = 19;
          else if (speed < 30) targetZoom = 18;
          else if (speed < 60) targetZoom = 17;
          else if (speed < 100) targetZoom = 16;
          else targetZoom = 15;
          const currentZoom = map.getZoom();
          if (Math.abs(targetZoom - currentZoom) > 0.5) {
            map.setZoom(targetZoom);
          }
        }
        setIsLocating(true);
        setLocationError(null);

        // Update shared location + calculate speed
        useLocationStore.getState().setPosition(latitude, longitude, accuracy);
        updateSpeed(pos);

        // Auto-split at intermediate waypoints (always active)
        useTimerStore.getState().checkAutoSplit(latitude, longitude);

        // Auto start/stop based on GPS proximity with state machine (auto mode only)
        const ts = useTimerStore.getState();
        if (ts.autoMode) {
          const rs = useRouteStore.getState();
          const route = rs.routes.find((r) => r.id === rs.activeRouteId);
          if (!route || route.waypoints.length < 2) return;

          const start = route.waypoints[0];
          const finish = route.waypoints[route.waypoints.length - 1];
          const dStart = haversine(latitude, longitude, start.lat, start.lng);
          const dFinish = haversine(latitude, longitude, finish.lat, finish.lng);

          if (ts.autoPhase === 'waiting_start') {
            // Waiting near start → trigger auto-start
            ts.setDistance(dStart);
            if (dStart < 20) {
              ts.start(); // start() also sets autoPhase → leaving_start
            }
          } else if (ts.autoPhase === 'leaving_start') {
            // Must move >50m from start before stop can trigger
            ts.setDistance(dStart);
            if (dStart > 50) {
              ts.setAutoPhase('heading_to_finish');
            }
          } else if (ts.autoPhase === 'heading_to_finish') {
            // Heading toward finish — trigger stop when close
            ts.setDistance(dFinish);
            if (dFinish < 20 && ts.status === 'running') {
              ts.stop();
            }
          }
        }
      },
      (err) => {
        stopLocationWatch();
        if (err.code === 1) {
          setLocationError('定位权限被拒绝。请检查：macOS 系统设置 → 隐私与安全性 → 定位服务 → 确保浏览器权限已开启');
        } else if (err.code === 2) {
          setLocationError('无法获取位置，请确认已开启 WiFi 或 GPS');
        } else if (err.code === 3) {
          setLocationError('定位超时，请移至开阔区域重试');
        } else {
          setLocationError('定位失败，请检查系统定位服务是否开启');
        }
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  };

  const toggleLocation = async () => {
    if (isLocating) { stopLocationWatch(); return; }
    if (!navigator.geolocation) { setLocationError('设备不支持定位'); return; }
    setLocationError(null);

    // Check Permissions API first for denied state
    try {
      if (navigator.permissions) {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state === 'denied') {
          setLocationError('定位权限已被系统拒绝。请前往 macOS 系统设置 → 隐私与安全性 → 定位服务 → 检查浏览器权限');
          return;
        }
        perm.addEventListener('change', () => {
          if (perm.state === 'denied') { stopLocationWatch(); setLocationError('定位权限已被撤销'); }
        });
      }
    } catch { /* Permissions API not available */ }

    // getCurrentPosition triggers browser permission prompt, then start watch
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      () => startLocationWatch(),
      (err) => {
        setIsLocating(false);
        if (err.code === 1) {
          setLocationError('定位权限被拒绝。请在浏览器弹窗中允许位置访问，或检查 macOS 系统设置 → 隐私与安全性 → 定位服务');
        } else {
          startLocationWatch();
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  useEffect(() => { return () => stopLocationWatch(); }, []);

  // Follow mode transitions: dramatic zoom-in on start, zoom-out on stop
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const wasFollowing = prevFollowModeRef.current;
    const isNowFollowing = followMode;

    if (isNowFollowing && !wasFollowing) {
      // Timer started — dramatic zoom-in to GPS position
      map.flyTo(lastDisplayPosRef.current, 18, { duration: 1.2 });
      isFollowingRef.current = true;
      lastPanToRef.current = 0; // reset throttle so first panTo is immediate
    } else if (!isNowFollowing && wasFollowing) {
      // Timer stopped — zoom out to show full route
      map.flyTo(lastDisplayPosRef.current, 15, { duration: 1 });
      isFollowingRef.current = false;
    }

    prevFollowModeRef.current = followMode;
  }, [followMode]);

  // ── Search / flyTo ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;

    // Clean up previous search marker
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }

    const { lat, lng, label } = flyTo;
    const [dlng, dlat] = toDisplayCoords(lng, lat);

    // Add search result marker
    const pinIcon = L.divIcon({
      className: 'search-pin',
      html: `
        <div style="position:relative;">
          <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
            <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="#FF453A"/>
            <circle cx="14" cy="14" r="5" fill="#fff" opacity="0.9"/>
          </svg>
          <span style="position:absolute;top:4px;left:50%;transform:translateX(-50%);font-size:8px;font-weight:700;color:#fff;">●</span>
        </div>`,
      iconSize: [28, 36],
      iconAnchor: [14, 36],
    });

    searchMarkerRef.current = L.marker([dlat, dlng], { icon: pinIcon, zIndexOffset: 900 })
      .addTo(map)
      .bindPopup(label, { closeButton: false, className: 'search-popup' })
      .openPopup();

    map.flyTo([dlat, dlng], 15, { duration: 0.8 });

    // Remove marker after 8 seconds
    const t = setTimeout(() => {
      if (searchMarkerRef.current) { searchMarkerRef.current.remove(); searchMarkerRef.current = null; }
    }, 8000);

    onFlyComplete?.();

    return () => clearTimeout(t);
  }, [flyTo]);

  // Reset flyTo completion callback ref
  useEffect(() => {
    if (!flyTo) return;
    // flyTo consumed
  }, [flyTo]);

  // Switch base layer (custom control, Apple Maps style)
  const switchLayer = (name: string) => {
    const map = mapRef.current;
    const layer = BASE_LAYERS[name];
    if (!map || !layer || layer === currentBaseLayerRef.current) { setLayerMenuOpen(false); return; }
    map.removeLayer(currentBaseLayerRef.current);
    map.addLayer(layer);
    currentBaseLayerRef.current = layer;
    setActiveLayerName(name);
    const newProvider: TileProvider = name.startsWith('高德') ? 'amap' : 'osm';
    setTileProvider(newProvider);
    setProviderState(newProvider);
    refreshMarkers();
    setLayerMenuOpen(false);
  };

  return (
    <div ref={containerRef} className="w-full h-full">
      {/* Control stack — Apple Maps style, top-right below header */}
      <div className="map-control-stack">
        <button
          onClick={toggleLocation}
          className={`map-ctl-btn ${isLocating ? 'active' : ''}`}
          title={isLocating ? '停止定位' : '定位我的位置'}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="10" cy="10" r="1.2" fill="currentColor" />
            <path d="M10 1v3M10 16v3M1 10h3M16 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
          </svg>
        </button>
        <div className="map-ctl-divider" />
        <button
          onClick={() => setLayerMenuOpen((v) => !v)}
          className={`map-ctl-btn ${layerMenuOpen ? 'active' : ''}`}
          title="切换底图"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L2 6.5 10 11l8-4.5L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M2 10l8 4.5 8-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.55" />
            <path d="M2 13.5L10 18l8-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.3" />
          </svg>
        </button>
      </div>

      {/* Layer menu */}
      {layerMenuOpen && (
        <div className="map-layer-menu glass-strong">
          {Object.keys(BASE_LAYERS).map((name) => (
            <button
              key={name}
              onClick={() => switchLayer(name)}
              className="map-layer-item"
              style={{
                color: name === activeLayerName ? 'var(--accent)' : 'var(--text-primary)',
                fontWeight: name === activeLayerName ? 600 : 400,
              }}
            >
              {name === activeLayerName && <span style={{ fontSize: 11 }}>✓</span>}
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Location error toast */}
      {locationError && (
        <div className="absolute z-[1000] px-4 py-3 rounded-2xl glass-strong text-[13px] text-[#FF453A] font-medium shadow-lg text-center max-w-sm mx-auto leading-relaxed" style={{ top: 'calc(56px + env(safe-area-inset-top, 0px))', left: 16, right: 16 }}>
          {locationError}
        </div>
      )}
    </div>
  );
}
