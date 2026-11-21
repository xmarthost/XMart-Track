import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { apiJson } from '../api/server';
import { logInfo, logWarn } from './log';

// Channel the server's Firebase messages use ("xm_alerts"): loud, vibrating, shown as a pop-up.
export const CHANNEL_ID = 'xm_alerts';
const TOKENS = 'notificationTokens';

// Notifications that arrive while the app is open are shown too, with sound.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Vehicle alerts',
    description: 'ACC on/off, alarms, overspeed and geofence alerts',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: true,
  });
}

const splitTokens = (value) => (value || '').split(/[,\s]+/).filter(Boolean);

let currentToken = null;

// Asks for permission, gets this phone's Firebase token and stores it on the user, where the
// server's Firebase notificator reads it. Returns the updated user (or null when nothing changed).
export async function registerPush(user) {
  try {
    await ensureChannel();
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') {
      logWarn('push', 'notification permission not granted');
      return null;
    }
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    currentToken = token;
    const tokens = splitTokens(user.attributes?.[TOKENS]);
    if (tokens.includes(token)) {
      logInfo('push', 'token already registered');
      return null;
    }
    const attributes = { ...user.attributes, [TOKENS]: [...tokens, token].join(',') };
    const updated = await apiJson(`api/users/${user.id}`, 'PUT', { ...user, attributes });
    logInfo('push', 'token registered');
    return updated;
  } catch (error) {
    logWarn('push', 'registration failed', error);
    return null;
  }
}

// On logout this phone stops receiving the user's alerts.
export async function unregisterPush(user) {
  if (!user || !currentToken) return;
  try {
    const tokens = splitTokens(user.attributes?.[TOKENS]).filter((t) => t !== currentToken);
    const attributes = { ...user.attributes };
    if (tokens.length) attributes[TOKENS] = tokens.join(',');
    else delete attributes[TOKENS];
    await apiJson(`api/users/${user.id}`, 'PUT', { ...user, attributes });
  } catch (error) {
    logWarn('push', 'unregister failed', error);
  }
}

// Tapping a notification opens that vehicle on the map.
export function handleNotificationTaps(setSelectedId) {
  const open = (response) => {
    try {
      const raw = response?.notification?.request?.content?.data?.event;
      const event = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (event?.deviceId) {
        setSelectedId(event.deviceId);
        router.navigate('/(tabs)');
      }
    } catch {
      // not a vehicle alert
    }
  };
  Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
  const subscription = Notifications.addNotificationResponseReceivedListener(open);
  return () => subscription.remove();
}
