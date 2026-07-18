import gcoord from 'gcoord';
import type { TileProvider } from '../types';

let currentProvider: TileProvider = 'amap';

export function getTileProvider(): TileProvider {
  return currentProvider;
}

export function setTileProvider(provider: TileProvider) {
  currentProvider = provider;
}

export function toDisplayCoords(lng: number, lat: number): [number, number] {
  if (currentProvider === 'amap') {
    const result = gcoord.transform(
      [lng, lat],
      gcoord.WGS84,
      gcoord.GCJ02,
    );
    return [result[0], result[1]];
  }
  return [lng, lat];
}

export function toStorageCoords(lng: number, lat: number): [number, number] {
  if (currentProvider === 'amap') {
    const result = gcoord.transform(
      [lng, lat],
      gcoord.GCJ02,
      gcoord.WGS84,
    );
    return [result[0], result[1]];
  }
  return [lng, lat];
}
