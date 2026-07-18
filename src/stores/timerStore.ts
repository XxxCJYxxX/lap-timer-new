import { create } from 'zustand';
import { db } from '../db/db';
import { computeColor } from '../utils/color';
import { fetchWeather } from '../utils/weather';
import { haversine } from '../utils/distance';
import { useRouteStore } from './routeStore';
import type { TimerStatus, LapRecord, Weather } from '../types';

type AutoPhase = 'waiting_start' | 'leaving_start' | 'heading_to_finish';
export type LightPhase = 'idle' | 'light1' | 'light2' | 'light3' | 'light4' | 'light5' | 'go';

interface TimerState {
  status: TimerStatus;
  startTime: number | null;
  elapsed: number;
  lastRecord: LapRecord | null;
  lastRecordColor: string | null;
  autoMode: boolean;
  autoPhase: AutoPhase;
  distanceToTarget: number | null;
  currentSpeed: number | null;
  maxSpeed: number | null;
  lightPhase: LightPhase;
  followMode: boolean;
  splits: number[];
  splitStartTime: number | null;
  weather: Weather | null;
  nextSplitIndex: number;
  wakeLock: WakeLockSentinel | null;

  start: () => void;
  tick: () => void;
  captureSplit: () => void;
  checkAutoSplit: (lat: number, lng: number) => void;
  stop: () => Promise<LapRecord | null>;
  reset: () => void;
  toggleAutoMode: () => void;
  setDistance: (d: number | null) => void;
  setAutoPhase: (p: AutoPhase) => void;
  setSpeed: (kmh: number) => void;
  setLightPhase: (p: LightPhase) => void;
  setFollowMode: (v: boolean) => void;
  beginStartSequence: () => void;
  _fetchWeather: () => Promise<void>;
  _acquireWakeLock: () => Promise<void>;
  _releaseWakeLock: () => void;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export const useTimerStore = create<TimerState>((set, get) => ({
  status: 'idle',
  startTime: null,
  elapsed: 0,
  lastRecord: null,
  lastRecordColor: null,
  autoMode: false,
  autoPhase: 'waiting_start',
  distanceToTarget: null,
  currentSpeed: null,
  maxSpeed: null,
  lightPhase: 'idle',
  followMode: false,
  splits: [],
  splitStartTime: null,
  weather: null,
  nextSplitIndex: 0,
  wakeLock: null,

  start: () => {
    get()._fetchWeather();
    get()._acquireWakeLock();
    const route = useRouteStore.getState().getActiveRoute();
    // Auto-split starts at index 1 (first checkpoint after start)
    set({
      status: 'running', startTime: performance.now(), elapsed: 0,
      lastRecord: null, lastRecordColor: null,
      autoPhase: 'leaving_start', currentSpeed: null, maxSpeed: null,
      lightPhase: 'idle', followMode: true,
      splits: [], splitStartTime: performance.now(), weather: null,
      nextSplitIndex: route && route.waypoints.length > 2 ? 1 : 0,
    });
  },

  tick: () => {
    const { status, startTime } = get();
    if (status !== 'running' || !startTime) return;
    set({ elapsed: performance.now() - startTime });
  },

  captureSplit: () => {
    const { status, splitStartTime } = get();
    if (status !== 'running' || !splitStartTime) return;
    const now = performance.now();
    set((s) => ({
      splits: [...s.splits, Math.round(now - splitStartTime)],
      splitStartTime: now,
    }));
  },

  /** GPS-driven auto-split: checks if close to the next unvisited waypoint and captures split */
  checkAutoSplit: (lat: number, lng: number) => {
    const { status, nextSplitIndex } = get();
    if (status !== 'running' || nextSplitIndex <= 0) return;

    const route = useRouteStore.getState().getActiveRoute();
    if (!route) return;

    const wps = route.waypoints;
    // Don't auto-split at F (last waypoint) — that's handled by auto-stop
    if (nextSplitIndex >= wps.length - 1) return;

    const wp = wps[nextSplitIndex];
    const dist = haversine(lat, lng, wp.lat, wp.lng);
    if (dist <= 15) {
      get().captureSplit();
      set({ nextSplitIndex: nextSplitIndex + 1 });
    }
  },

  stop: async () => {
    const { startTime, splits, splitStartTime, weather } = get();
    if (!startTime) return null;

    get()._releaseWakeLock();

    const elapsed = performance.now() - startTime;
    const timeMs = Math.round(elapsed);

    // Capture final split if there's an active segment
    const finalSplits = [...splits];
    if (splitStartTime !== null) {
      finalSplits.push(Math.round(performance.now() - splitStartTime));
    }

    const activeId = useRouteStore.getState().activeRouteId;
    if (!activeId) {
      set({ status: 'idle', startTime: null, elapsed: 0, autoPhase: 'waiting_start', followMode: false, splits: [], splitStartTime: null, nextSplitIndex: 0 });
      return null;
    }

    const existing = await db.records.where('routeId').equals(activeId).toArray();
    const color = existing.length === 0 ? 'purple' : computeColor(existing, timeMs);

    const record: LapRecord = { routeId: activeId, timeMs, splits: finalSplits, weather: weather ?? undefined, timestamp: Date.now() };
    const id = await db.records.add(record);
    set({
      status: 'stopped', startTime: null, elapsed,
      lastRecord: { ...record, id }, lastRecordColor: color,
      autoPhase: 'waiting_start', followMode: false,
      splits: finalSplits, splitStartTime: null, nextSplitIndex: 0,
    });

    return { ...record, id };
  },

  reset: () => {
    get()._releaseWakeLock();
    set({
      status: 'idle', startTime: null, elapsed: 0,
      lastRecord: null, lastRecordColor: null,
      distanceToTarget: null, autoPhase: 'waiting_start',
      lightPhase: 'idle', followMode: false,
      splits: [], splitStartTime: null, weather: null,
      nextSplitIndex: 0,
    });
  },

  toggleAutoMode: () => {
    const next = !get().autoMode;
    set({ autoMode: next, distanceToTarget: next ? 0 : null, autoPhase: 'waiting_start' });
  },

  setDistance: (d) => set({ distanceToTarget: d }),
  setAutoPhase: (p) => set({ autoPhase: p }),

  setSpeed: (kmh) => set((s) => ({
    currentSpeed: kmh,
    maxSpeed: s.maxSpeed === null ? kmh : Math.max(s.maxSpeed, kmh),
  })),

  setLightPhase: (p) => set({ lightPhase: p }),
  setFollowMode: (v) => set({ followMode: v }),

  beginStartSequence: async () => {
    const phases: LightPhase[] = ['light1', 'light2', 'light3', 'light4', 'light5'];
    get().setLightPhase('light1');
    for (let i = 1; i < phases.length; i++) {
      await sleep(600);
      get().setLightPhase(phases[i]);
    }
    await sleep(500 + Math.random() * 1500);
    get().setLightPhase('go');
    await sleep(80);
    get().start();
  },

  _fetchWeather: async () => {
    const route = useRouteStore.getState().getActiveRoute();
    if (!route || route.waypoints.length === 0) return;
    const wp = route.waypoints[0];
    const w = await fetchWeather(wp.lat, wp.lng);
    if (w) set({ weather: w });
  },

  _acquireWakeLock: async () => {
    try {
      if ('wakeLock' in navigator) {
        const sentinel = await navigator.wakeLock.request('screen');
        set({ wakeLock: sentinel });
        sentinel.addEventListener('release', () => {
          if (get().wakeLock === sentinel) set({ wakeLock: null });
        });
        // Re-acquire if page goes hidden then visible
        const onVisible = async () => {
          if (document.visibilityState === 'visible' && get().status === 'running' && !get().wakeLock) {
            try {
              const s = await navigator.wakeLock.request('screen');
              set({ wakeLock: s });
              s.addEventListener('release', () => {
                if (get().wakeLock === s) set({ wakeLock: null });
              });
            } catch { /* ignore */ }
          }
        };
        document.addEventListener('visibilitychange', onVisible, { once: true });
        sentinel.addEventListener('release', () => {
          document.addEventListener('visibilitychange', onVisible, { once: true });
        });
      }
    } catch { /* Wake Lock not supported, fine */ }
  },

  _releaseWakeLock: () => {
    const { wakeLock } = get();
    if (wakeLock) {
      try { wakeLock.release(); } catch { /* ignore */ }
      set({ wakeLock: null });
    }
  },
}));
