import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import { logInfo, logWarn } from '../state/log';
import {
  DEFAULT_STYLE,
  FALLBACK_ROAD,
  FALLBACK_SATELLITE,
  findStyle,
  isGoogle,
  testTileUrl,
} from './mapStyles';

const PREF_KEY = 'xm_map_style';
const CHECK_TIMEOUT = 7000;

// Shared map style state: the style the user picked, the style actually shown (a free style
// replaces Google when Google tiles cannot be loaded) and a short notice explaining why.
let state = { chosen: DEFAULT_STYLE, active: DEFAULT_STYLE, notice: null, checks: {} };
const listeners = new Set();
let loaded = false;

const emit = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

const fallbackFor = (id) => (findStyle(id).satellite ? FALLBACK_SATELLITE : FALLBACK_ROAD);

export async function checkTiles(id) {
  const url = testTileUrl(id);
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const type = response.headers.get('content-type') || '';
    const ok = response.ok && type.startsWith('image');
    return { ok, detail: `HTTP ${response.status} ${type}`, ms: Date.now() - started };
  } catch (error) {
    return { ok: false, detail: controller.signal.aborted ? 'timeout' : String(error?.message || error), ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

async function activate(id) {
  emit({ chosen: id, active: id, notice: null });
  if (!isGoogle(id)) return;
  const result = await checkTiles(id);
  emit({ checks: { ...state.checks, [id]: result } });
  if (state.chosen !== id) return;
  if (result.ok) {
    logInfo('map', `${id} tiles OK (${result.ms} ms)`);
  } else {
    const fallback = fallbackFor(id);
    logWarn('map', `${id} tiles failed (${result.detail}); switched to ${fallback}`);
    emit({ active: fallback, notice: `Google map not loading — using ${findStyle(fallback).label}` });
  }
}

export function initMapStyle() {
  if (loaded) return;
  loaded = true;
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
  emit({ active: fallback, notice: `Google map not loading — using ${findStyle(fallback).label}` });
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
