import { create } from 'zustand';

interface LocationState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  setPosition: (lat: number, lng: number, accuracy: number) => void;
  clearPosition: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  lat: null,
  lng: null,
  accuracy: null,
  setPosition: (lat, lng, accuracy) => set({ lat, lng, accuracy }),
  clearPosition: () => set({ lat: null, lng: null, accuracy: null }),
}));
