import L from 'leaflet';

/**
 * Retina/HiDPI support:
 * - 高德: scale=2 参数返回真正的 2x 高清瓦片（路网层支持；卫星影像无 2x 源）
 * - OSM: detectRetina 用更高 zoom 的瓦片模拟高清（osm.org 无原生 @2x）
 * Apple 全系 2x/3x 屏（iPhone/iPad/MacBook Retina）自动命中。
 */
const isRetina = (typeof window !== 'undefined' && window.devicePixelRatio > 1.5);
const amapScale = isRetina ? 2 : 1;

/** OSM default tile layer */
export const osmLayer = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    detectRetina: isRetina,
  }
);

/** 高德地图 — 矢量路网 + 地名标注（Retina 屏拉 2x 瓦片） */
export const amapRoadLayer = L.tileLayer(
  `https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=${amapScale}&style=8&x={x}&y={y}&z={z}`,
  {
    subdomains: ['1', '2', '3', '4'],
    attribution: '&copy; 高德地图',
    maxZoom: 18,
  }
);

/** 高德卫星图 — 纯影像无标注（无 2x 源，detectRetina 模拟） */
const amapSatelliteLayer = L.tileLayer(
  'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
  {
    subdomains: ['1', '2', '3', '4'],
    attribution: '&copy; 高德地图',
    maxZoom: 18,
    detectRetina: isRetina,
  }
);

/** 高德路网标注层 — 透明底，叠在卫星图上（跟随卫星层用 detectRetina 保持网格对齐） */
const amapRoadOverlay = L.tileLayer(
  'https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}',
  {
    subdomains: ['1', '2', '3', '4'],
    maxZoom: 18,
    opacity: 0.9,
    detectRetina: isRetina,
  }
);

/** 高德卫星 + 路网标注（组合图层） */
export const amapHybridLayer = L.layerGroup([amapSatelliteLayer, amapRoadOverlay]);

export const BASE_LAYERS: Record<string, L.Layer> = {
  'OpenStreetMap': osmLayer,
  '高德地图': amapRoadLayer,
  '高德卫星+路网': amapHybridLayer,
  '高德卫星图': amapSatelliteLayer,
};
