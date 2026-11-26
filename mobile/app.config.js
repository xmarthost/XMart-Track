// XMart Track mobile app configuration.
// GOOGLE_MAPS_API_KEY: Google key used for street addresses (Geocoding API); a GitHub secret overrides the built-in test key.
// Maps are drawn by MapLibre (Google or free tiles), not the Google Maps Android SDK.
// XMART_SERVER: server address used by default on the login screen.
const googleKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyB5JIXYxqF_yZdrzLBSIHxqJO4tu9c1fOk';
// XMART_STORE=play builds the Google Play version: Play updates the app itself, so the GitHub
// self-update and the permissions Play restricts are left out.
const playStore = process.env.XMART_STORE === 'play';
const androidPermissions = playStore
  ? ['POST_NOTIFICATIONS', 'VIBRATE', 'RECEIVE_BOOT_COMPLETED', 'WAKE_LOCK']
  : ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS', 'VIBRATE', 'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', 'RECEIVE_BOOT_COMPLETED', 'WAKE_LOCK', 'REQUEST_INSTALL_PACKAGES'];

module.exports = {
  expo: {
    name: 'XMart Track',
    slug: 'xmart-track',
    scheme: 'xmarttrack',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    backgroundColor: '#F4F8FD',
    ios: {
      bundleIdentifier: 'site.xmarttrack.app',
      buildNumber: String(process.env.APP_VERSION_CODE || 1),
      supportsTablet: false,
      infoPlist: {
        NSLocationWhenInUseUsageDescription: 'Shows your position on the map next to your vehicles.',
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'site.xmarttrack.app',
      versionCode: Number(process.env.APP_VERSION_CODE || 1),
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
      permissions: androidPermissions,
      ...(playStore
        ? { blockedPermissions: ['android.permission.REQUEST_INSTALL_PACKAGES', 'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_BACKGROUND_LOCATION', 'android.permission.SYSTEM_ALERT_WINDOW'] }
        : {}),
      // Firebase project for push notifications (server sends through Firebase Cloud Messaging)
      googleServicesFile: './google-services.json',
    },
    plugins: [
      'expo-router',
      [
        'expo-build-properties',
        {
          // R8 strips classes that WorkManager/Room create by reflection and the app
          // crashes on start; the size saving is not worth it for this app.
          android: {
            enableMinifyInReleaseBuilds: false,
            enableShrinkResourcesInReleaseBuilds: false,
          },
        },
      ],
      'expo-secure-store',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#0A4A55',
          image: './assets/splash-icon.png',
          imageWidth: 180,
        },
      ],
      '@maplibre/maplibre-react-native',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#007080',
          defaultChannel: 'xm_alerts',
        },
      ],
    ],
    extra: {
      server: process.env.XMART_SERVER || 'https://xmarttrack.site',
      googleKey,
      store: playStore ? 'play' : 'github',
    },
  },
};
