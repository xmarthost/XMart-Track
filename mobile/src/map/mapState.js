import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { OfflineManager } from '@maplibre/maplibre-react-native';
import { logInfo, logWarn } from '../state/log';
import { DEFAULT_STYLE, FALLBACK_ROAD, FALLBACK_SATELLITE, findStyle, isGoogle, sampleTile } from './mapStyles';

const PREF_KEY = 'xm_map_style';
const CHECK_TIMEOUT = 7000;
const googleKey = Constants.expoConfig?.extra?.googleKey;

// Shared map state: the style the user picked (`chosen`), the style shown (`active`), its tile
// URLs, where the tiles come from (`source`) and a notice when a fallback was needed.
let state = { chosen: DEFAULT_STYLE, active: DEFAULT_STYLE, tiles: null, source: null, notice: null };
const listeners = new Set();
let loaded = false;
let generation = 0;

const emit = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

const withTimeout = async (run) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT);
  const started = Date.now();
  try {
    return { ...(await run(controller.signal)), ms: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      detail: controller.signal.aborted ? 'timeout' : String(error?.message || error),
      ms: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
};

// Fetches one sample tile from a URL template.
export const checkTemplate = (template) =>
  withTimeout(async (signal) => {
    const response = await fetch(sampleTile(template), { signal });
    const type = response.headers.get('content-type') || '';
    return { ok: response.ok && type.startsWith('image'), detail: `HTTP ${response.status} ${type}` };
  });

export const checkTiles = (id) => checkTemplate(findStyle(id).tiles[0]);

// Google Map Tiles API: a session (valid about two weeks) is created with the key and cached.
async function googleApiTemplate(id) {
  const spec = findStyle(id).api;
  if (!spec || !googleKey) throw new Error(googleKey ? 'no API spec' : 'no Google key in app');
  const storeKey = `xm_gsession_${id}`;
  try {
    const cached = JSON.parse((await SecureStore.getItemAsync(storeKey)) || 'null');
    if (cached && Number(cached.expiry) * 1000 > Date.now() + 864e5) {
      return cached.template;
    }
  } catch {
    // create a new session
  }
  const response = await fetch(`https://tile.googleapis.com/v1/createSession?key=${googleKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'en-US', region: 'PK', ...spec }),
  });
  const json = await response.json();
  if (!response.ok || !json.session) {
    throw new Error(`createSession HTTP ${response.status} ${json.error?.message || ''}`.trim());
  }
  const template = `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${json.session}&key=${googleKey}`;
  SecureStore.setItemAsync(storeKey, JSON.stringify({ template, expiry: json.expiry })).catch(() => {});
  return template;
}

export const checkGoogleApi = (id = 'googleRoad') =>
  withTimeout(async () => {
    const template = await googleApiTemplate(id);
    return checkTemplate(template);
  });

const fallbackFor = (id) => (findStyle(id).satellite ? FALLBACK_SATELLITE : FALLBACK_ROAD);

async function activate(id) {
  const run = ++generation;
  const style = findStyle(id);
  emit({ chosen: id, active: id, tiles: null, source: style.group === 'Google' ? 'checking…' : style.label, notice: null });
  if (!isGoogle(id)) return;

  // 1. official Google Map Tiles API with the app's key
  try {
    const template = await googleApiTemplate(id);
    const result = await checkTemplate(template);
    if (run !== generation) return;
    if (result.ok) {
      logInfo('map', `${id}: Google Map Tiles API OK (${result.ms} ms)`);
      emit({ tiles: [template], source: 'Google Map Tiles API (your key)' });
      return;
    }
    logWarn('map', `${id}: Map Tiles API tile failed: ${result.detail}`);
  } catch (error) {
    if (run !== generation) return;
    logWarn('map', `${id}: Map Tiles API unavailable: ${error?.message || error}`);
  }

  // 2. public Google tile servers
  const result = await checkTiles(id);
  if (run !== generation) return;
  if (result.ok) {
    logInfo('map', `${id}: public Google tiles OK (${result.ms} ms)`);
    emit({ tiles: style.tiles, source: 'Google public tiles (no key)' });
    return;
  }

  // 3. free map
  const fallback = fallbackFor(id);
  logWarn('map', `${id}: Google tiles failed (${result.detail}); switched to ${fallback}`);
  emit({
    active: fallback,
    tiles: null,
    source: findStyle(fallback).label,
    notice: `Google map not loading — using ${findStyle(fallback).label}`,
  });
}

const CACHE_BYTES = 512 * 1024 * 1024;

export function initMapStyle() {
  if (loaded) return;
  loaded = true;
  // keep viewed tiles on the phone so zooming and panning back over an area is instant
  OfflineManager.setMaximumAmbientCacheSize(CACHE_BYTES)
    .then(() => logInfo('map', 'tile cache 512 MB'))
    .catch((error) => logWarn('map', 'tile cache setup failed', error));
  SecureStore.getItemAsync(PREF_KEY)
    .catch(() => null)
    .then((saved) => activate(saved && findStyle(saved).id === saved ? saved : DEFAULT_STYLE));
}

export function chooseMapStyle(id) {
  SecureStore.setItemAsync(PREF_KEY, id).catch(() => {});
  logInfo('map', `style chosen: ${id}`);
  activate(id);
}

// Called when MapLibre reports the style failed to load.
export function reportMapFailure(id) {
  if (state.active !== id || !isGoogle(id)) return;
  const fallback = fallbackFor(id);
  logWarn('map', `${id} failed to load in the map; switched to ${fallback}`);
  emit({
    active: fallback,
    tiles: null,
    source: findStyle(fallback).label,
    notice: `Google map not loading — using ${findStyle(fallback).label}`,
  });
}

export const dismissMapNotice = () => emit({ notice: null });
export const getMapState = () => state;

export function useMapState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
