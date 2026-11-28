import { useEffect, useState } from 'react';
import { installLogCapture, logError, logInfo } from '../state/log';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useKeepAwake } from 'expo-keep-awake';
import { AppProvider, useApp } from '../state/AppState';
import { restoreSession } from '../api/server';
import { savedLayout } from '../state/theme';
import { colors } from '../state/status';
import EventBanner from '../components/EventBanner';
import UpdatePrompt from '../components/UpdatePrompt';

installLogCapture();
SplashScreen.preventAutoHideAsync().catch(() => {});

function Welcome() {
  return (
    <View style={styles.welcome}>
      <View style={styles.logoTile}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} />
      </View>
      <Text style={styles.title}>
        XMart <Text style={styles.titleAccent}>Track</Text>
      </Text>
      <Text style={styles.tagline}>GPS TRACKING PLATFORM</Text>
      <ActivityIndicator color="#FFFFFF" style={{ marginTop: 36 }} />
    </View>
  );
}

function Gate() {
  // the screen stays on while the app is open (like tracking apps); it sleeps normally when closed
  useKeepAwake();
  const { setUser } = useApp();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      // whatever goes wrong here, the app must leave the start screen (never stay on it)
      let user = null;
      try {
        user = await restoreSession();
        logInfo('session', user ? `restored ${user.email}` : 'no saved session');
        if (user) setUser(user);
      } catch (error) {
        logError('session', 'start failed', error);
      }
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
      let target = user ? '/(tabs)' : '/login';
      try {
        if (user && !savedLayout()) target = '/appearance?first=1';
      } catch {
        // keep the default target
      }
      router.replace(target);
    })();
  }, [setUser]);

  return (
    <>
      <StatusBar style="light" backgroundColor={colors.tealDark} />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="device/[id]/commands" options={headerOptions('Commands')} />
        <Stack.Screen name="device/[id]/playback" options={headerOptions('Playback')} />
        <Stack.Screen name="diagnostics" options={headerOptions('Diagnostics & logs')} />
        <Stack.Screen name="notification-setup" options={headerOptions('Notification setup')} />
        <Stack.Screen name="alert-settings" options={headerOptions('SMS & WhatsApp alerts')} />
        <Stack.Screen name="account" options={headerOptions('Account')} />
        <Stack.Screen name="devices" options={headerOptions('Devices')} />
        <Stack.Screen name="geofences" options={headerOptions('Geofences')} />
        <Stack.Screen name="reports" options={headerOptions('Reports')} />
        <Stack.Screen name="overview" options={headerOptions('Fleet overview')} />
        <Stack.Screen name="appearance" options={headerOptions('Layout & theme')} />
        <Stack.Screen name="device/[id]/trips" options={headerOptions('Trips')} />
      </Stack>
      <EventBanner />
      {ready && <UpdatePrompt />}
      {!ready && (
        <View style={StyleSheet.absoluteFill}>
          <Welcome />
        </View>
      )}
    </>
  );
}

const headerOptions = (title) => ({
  headerShown: true,
  title,
  headerTitleAlign: 'center',
  headerTintColor: colors.text,
  headerStyle: { backgroundColor: colors.card },
});

export default function RootLayout() {
  return (
    <AppProvider>
      <Gate />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  welcome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  logoTile: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  logo: { width: 96, height: 96 },
  title: { marginTop: 22, fontSize: 30, fontWeight: '800', color: '#FFFFFF' },
  titleAccent: { color: '#7DD3DC' },
  tagline: { marginTop: 6, fontSize: 12, letterSpacing: 2, color: 'rgba(255,255,255,0.8)' },
});
