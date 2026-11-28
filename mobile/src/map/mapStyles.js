// Raster map styles drawn by MapLibre, so the map does not depend on the Google Maps Android SDK.
// Google layers load the public Google tile servers (`tiles`, same as the website). `api` is the
// official Map Tiles API request used by Diagnostics to check the Google key.
const CARTO_KEY = 'cb1_5dap_1_ff183c56a35ff4dd2f3a8c64';
const google = (layer) =>
  [0, 1, 2, 3].map((n) => `https://mt${n}.google.com/vt/lyrs=${layer}&hl=en&gl=pk&x={x}&y={y}&z={z}&scale=2`);

export const mapStyles = [
  {
    id: 'googleRoad',
    label: 'Google Road',
    group: 'Google',
    tiles: google('m'),
    api: { mapType: 'roadmap', scale: 'scaleFactor2x', highDpi: true },
    satellite: false,
  },
  {
    id: 'googleHybrid',
    label: 'Google Hybrid',
    group: 'Google',
    tiles: google('y'),
    api: { mapType: 'satellite', layerTypes: ['layerRoadmap'] },
    satellite: true,
  },
  {
    id: 'googleSatellite',
    label: 'Google Satellite',
    group: 'Google',
    tiles: google('s'),
    api: { mapType: 'satellite' },
    satellite: true,
  },
  {
    id: 'freeStreets',
    label: 'Free Streets (Carto)',
    group: 'Free',
    tiles: [`https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`],
    attribution: '© OpenStreetMap © CARTO',
    satellite: false,
  },
  {
    id: 'freeDark',
    label: 'Free Dark (Carto)',
    group: 'Free',
    tiles: [`https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${CARTO_KEY}`],
    attribution: '© OpenStreetMap © CARTO',
    satellite: false,
  },
  {
    id: 'freeOsm',
    label: 'Free OpenStreetMap',
    group: 'Free',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© OpenStreetMap contributors',
    satellite: false,
  },
  {
    id: 'freeSatellite',
    label: 'Free Satellite (Esri)',
    group: 'Free',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: '© Esri',
    satellite: true,
  },
];

export const DEFAULT_STYLE = 'googleRoad';
export const FALLBACK_ROAD = 'freeStreets';
export const FALLBACK_SATELLITE = 'freeSatellite';

export const findStyle = (id) => mapStyles.find((s) => s.id === id) || mapStyles[0];
export const isGoogle = (id) => findStyle(id).group === 'Google';

// A tile over Lahore, used to check that a tile URL template works.
export const sampleTile = (template) =>
  template.replace('{z}', '12').replace('{x}', '2894').replace('{y}', '1665');

// Live traffic as its own see-through layer on top of any map (Google or free): Google's
// "roads + traffic" overlay without labels, drawn thin (4x tiles in a 256 px slot) and light, so the
// vehicle's green trail stays clearly visible above it. `stamp` changes every few minutes so the
// phone loads fresh traffic instead of cached tiles.
export const TRAFFIC_OPACITY = 0.55;
export const trafficTiles = (stamp) =>
  [0, 1, 2, 3].map(
    (n) =>
      `https://mt${n}.google.com/vt/lyrs=h,traffic&hl=en&gl=pk&x={x}&y={y}&z={z}&scale=4` +
      `&apistyle=s.t%3A0%7Cs.e%3Al%7Cp.v%3Aoff&ts=${stamp}`,
  );

const cache = {};
export function buildStyle(id, tiles) {
  const style = findStyle(id);
  const urls = tiles || style.tiles;
  const cacheKey = `${id}|${urls[0]}`;
  if (cache[cacheKey]) return cache[cacheKey];
  cache[cacheKey] = {
    version: 8,
    sources: {
      base: {
        type: 'raster',
        tiles: urls,
        tileSize: 256,
        maxzoom: 20,
        attribution: style.attribution || '© Google',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#EEF2F5' } },
      { id: 'base', type: 'raster', source: 'base' },
    ],
  };
  return cache[cacheKey];
}
