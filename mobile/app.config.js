// XMart Track mobile app configuration.
// GOOGLE_MAPS_API_KEY: Android key with "Maps SDK for Android" enabled (a GitHub secret overrides the built-in test key).
// XMART_SERVER: server address used by default on the login screen.
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
    android: {
      package: 'site.xmarttrack.app',
      versionCode: Number(process.env.APP_VERSION_CODE || 1),
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
      permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS'],
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
      [
        'react-native-maps',
        {
          androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyB5JIXYxqF_yZdrzLBSIHxqJO4tu9c1fOk',
        },
      ],
    ],
    extra: {
      server: process.env.XMART_SERVER || 'https://xmarttrack.site',
    },
  },
};
