import { create } from 'zustand';
import type { RouteResult } from '../utils/routing';

interface NavState {
  destination: { name: string; lat: number; lng: number } | null;
  route: RouteResult | null;
  isLoading: boolean;
  setDestination: (name: string, lat: number, lng: number) => void;
  clearDestination: () => void;
  setRoute: (r: RouteResult | null) => void;
  setLoading: (v: boolean) => void;
}

export const useNavStore = create<NavState>((set) => ({
  destination: null,
  route: null,
  isLoading: false,
  setDestination: (name, lat, lng) => set({ destination: { name, lat, lng } }),
  clearDestination: () => set({ destination: null, route: null, isLoading: false }),
  setRoute: (r) => set({ route: r }),
  setLoading: (v) => set({ isLoading: v }),
}));
