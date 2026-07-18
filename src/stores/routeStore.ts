import { create } from 'zustand';
import { db } from '../db/db';
import { toStorageCoords } from '../utils/coord';
import type { Route } from '../types';

type CreateStep = 'adding_points' | 'naming';

interface RouteState {
  routes: Route[];
  activeRouteId: number | null;
  isCreating: boolean;
  createStep: CreateStep;
  draftWaypoints: { lat: number; lng: number }[];

  loadRoutes: () => Promise<void>;
  setActiveRoute: (id: number) => void;
  startCreate: () => void;
  addWaypoint: (lng: number, lat: number) => void;
  undoWaypoint: () => void;
  setFinish: () => void;
  saveRoute: (name: string) => Promise<Route>;
  cancelCreate: () => void;
  deleteRoute: (id: number) => Promise<void>;
  reverseRoute: (id: number) => Promise<void>;
  getActiveRoute: () => Route | undefined;
}

export const useRouteStore = create<RouteState>((set, get) => ({
  routes: [],
  activeRouteId: null,
  isCreating: false,
  createStep: 'adding_points',
  draftWaypoints: [],

  loadRoutes: async () => {
    const routes = await db.routes.orderBy('createdAt').reverse().toArray();
    set({ routes });
  },

  setActiveRoute: (id) => {
    set({ activeRouteId: id, isCreating: false, createStep: 'adding_points', draftWaypoints: [] });
  },

  startCreate: () => {
    set({ isCreating: true, createStep: 'adding_points', draftWaypoints: [], activeRouteId: null });
  },

  addWaypoint: (lng, lat) => {
    const [wlng, wlat] = toStorageCoords(lng, lat);
    set((s) => ({
      draftWaypoints: [...s.draftWaypoints, { lat: wlat, lng: wlng }],
    }));
  },

  undoWaypoint: () => {
    set((s) => ({ draftWaypoints: s.draftWaypoints.slice(0, -1) }));
  },

  setFinish: () => {
    set({ createStep: 'naming' });
  },

  saveRoute: async (name) => {
    const { draftWaypoints } = get();
    if (draftWaypoints.length < 2) throw new Error('需要至少2个点');
    const route: Route = {
      name,
      waypoints: draftWaypoints,
      createdAt: Date.now(),
    };
    const id = await db.routes.add(route);
    const saved = { ...route, id };
    set((s) => ({
      routes: [saved, ...s.routes],
      isCreating: false,
      createStep: 'adding_points',
      draftWaypoints: [],
      activeRouteId: id,
    }));
    return saved;
  },

  cancelCreate: () => {
    set({ isCreating: false, createStep: 'adding_points', draftWaypoints: [] });
  },

  deleteRoute: async (id) => {
    await db.routes.delete(id);
    await db.records.where('routeId').equals(id).delete();
    set((s) => ({
      routes: s.routes.filter((r) => r.id !== id),
      activeRouteId: s.activeRouteId === id ? null : s.activeRouteId,
    }));
  },

  reverseRoute: async (id) => {
    const route = get().routes.find((r) => r.id === id);
    if (!route) return;
    const reversed: Route = {
      name: route.name + ' (反)',
      waypoints: [...route.waypoints].reverse(),
      createdAt: Date.now(),
    };
    const newId = await db.routes.add(reversed);
    set((s) => ({ routes: [{ ...reversed, id: newId }, ...s.routes] }));
  },

  getActiveRoute: () => {
    const { routes, activeRouteId } = get();
    return routes.find((r) => r.id === activeRouteId);
  },
}));
