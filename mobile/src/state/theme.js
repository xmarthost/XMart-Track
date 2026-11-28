import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';

// App themes. The choice is read once when the app starts (styles are built from it), so a new theme
// shows after the app is opened again.
export const THEME_KEY = 'xm_theme';
export const LAYOUT_KEY = 'xm_layout';

export const themes = {
  light: {
    label: 'Light',
    dark: false,
    background: '#F4F8FD',
    card: '#FFFFFF',
    text: '#0F172A',
    muted: '#475569',
    border: '#E2E8F0',
    subtle: '#F1F5F9',
    teal: '#007080',
    tealDark: '#0A4A55',
    header: '#FFFFFF',
    headerText: '#0F172A',
  },
  teal: {
    label: 'XMart Teal',
    dark: false,
    background: '#EEF6F7',
    card: '#FFFFFF',
    text: '#0F172A',
    muted: '#475569',
    border: '#D5E5E8',
    subtle: '#E8F3F4',
    teal: '#007080',
    tealDark: '#0A4A55',
    header: '#007080',
    headerText: '#FFFFFF',
  },
  dark: {
    label: 'Dark',
    dark: true,
    background: '#0B1220',
    card: '#151E2E',
    text: '#E5E7EB',
    muted: '#9CA3AF',
    border: '#263247',
    subtle: '#1E293B',
    teal: '#22B3C3',
    tealDark: '#0A3A44',
    header: '#151E2E',
    headerText: '#E5E7EB',
  },
};

const read = (key, fallback) => {
  try {
    return SecureStore.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

export const themeId = themes[read(THEME_KEY, 'light')] ? read(THEME_KEY, 'light') : 'light';
export const palette = themes[themeId];

export const saveTheme = (id) => SecureStore.setItemAsync(THEME_KEY, id);

// layouts: classic | fullmap | dashboard | split | simple ('list' = older List First, shown like Classic)
export const layouts = ['classic', 'fullmap', 'list', 'dashboard', 'split', 'simple'];
export const savedLayout = () => {
  const value = read(LAYOUT_KEY, null);
  return layouts.includes(value) ? value : null;
};

// the layout changes right away (no restart): a tiny shared store
let layout = savedLayout() || 'classic';
const listeners = new Set();
export function setLayout(id) {
  layout = id;
  SecureStore.setItemAsync(LAYOUT_KEY, id).catch(() => {});
  listeners.forEach((listener) => listener());
}
export function useLayout() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => layout,
  );
}
