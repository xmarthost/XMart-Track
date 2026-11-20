import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const SESSION_KEY = 'xm_session';
let base = (Constants.expoConfig?.extra?.server || 'https://xmarttrack.site').replace(/\/+$/, '');

export const getBase = () => base;
export const setBase = (url) => {
  base = url.trim().replace(/\/+$/, '');
};

export async function api(path, options = {}) {
  const response = await fetch(`${base}/${path}`, {
    credentials: 'include',
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') || '';
  return type.includes('json') ? response.json() : response.text();
}

const form = (values) =>
  Object.entries(values)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

// Logs in, then keeps a long-lived token in secure storage so the app reopens signed in.
export async function login(server, email, password) {
  setBase(server);
  const formHeaders = { 'Content-Type': 'application/x-www-form-urlencoded' };
  const user = await api('api/session', {
    method: 'POST',
    headers: formHeaders,
    body: form({ email, password }),
  });
  try {
    const expiration = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    const token = await api('api/session/token', {
      method: 'POST',
      headers: formHeaders,
      body: form({ expiration }),
    });
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ server: base, token }));
  } catch {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ server: base }));
  }
  return user;
}

export async function restoreSession() {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  const { server, token } = JSON.parse(raw);
  if (server) setBase(server);
  try {
    return await api(token ? `api/session?token=${encodeURIComponent(token)}` : 'api/session');
  } catch {
    return null;
  }
}

export async function logout() {
  try {
    await api('api/session', { method: 'DELETE' });
  } catch {
    // already signed out
  }
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export const socketUrl = () => `${base.replace(/^http/, 'ws')}/api/socket`;
