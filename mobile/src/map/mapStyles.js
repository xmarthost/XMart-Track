// Raster map styles drawn by MapLibre (same tiles as the web app), so the map does not depend
// on the Google Maps Android SDK. Google layers are tried first; free layers are the fallback.
const google = (layer) =>
  [0, 1, 2, 3].map((n) => `https://mt${n}.google.com/vt/lyrs=${layer}&hl=en&gl=pk&x={x}&y={y}&z={z}&scale=2`);

export const mapStyles = [
  { id: 'googleRoad', label: 'Google Road', group: 'Google', tiles: google('m'), satellite: false },
  { id: 'googleHybrid', label: 'Google Hybrid', group: 'Google', tiles: google('y'), satellite: true },
  { id: 'googleSatellite', label: 'Google Satellite', group: 'Google', tiles: google('s'), satellite: true },
  {
    id: 'freeStreets',
    label: 'Free Streets (Carto)',
    group: 'Free',
    tiles: ['a', 'b', 'c', 'd'].map((s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png`),
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

// A single tile URL used to check that the provider is reachable.
export const testTileUrl = (id) =>
  findStyle(id)
    .tiles[0].replace('{z}', '5')
    .replace('{x}', '22')
    .replace('{y}', '13');

const cache = {};
export function buildStyle(id) {
  if (cache[id]) return cache[id];
  const style = findStyle(id);
  cache[id] = {
    version: 8,
    sources: {
      base: {
        type: 'raster',
        tiles: style.tiles,
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
  return cache[id];
}
