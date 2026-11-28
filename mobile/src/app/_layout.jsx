import { useEffect, useRef, useState } from 'react';
import { installLogCapture, logError, logInfo } from '../state/log';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useKeepAwake } from 'expo-keep-awake';
import { AppProvider, useApp } from '../state/AppState';
import { restoreSession } from '../api/server';
import { colors } from '../state/status';
import EventBanner from '../components/EventBanner';
import UpdatePrompt from '../components/UpdatePrompt';

installLogCapture();
SplashScreen.preventAutoHideAsync().catch(() => {});

// Start screen while the app loads: logo with soft pulse rings, name, three loading dots
function Welcome() {
  const pulse = useRef(new Animated.Value(0)).current;
  const appear = useRef(new Animated.Value(0)).current;
  const dots = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
    const loops = [
      Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true })),
      Animated.loop(Animated.timing(dots, { toValue: 3, duration: 1200, easing: Easing.linear, useNativeDriver: true })),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [appear, pulse, dots]);

  const ring = (delay) => {
    const t = Animated.modulo(Animated.add(pulse, delay), 1);
    return {
      transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
      opacity: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.35, 0.08, 0] }),
    };
  };

  return (
    <View style={styles.welcome}>
      <View style={[styles.blob, { top: -120, right: -90, width: 320, height: 320 }]} />
      <View style={[styles.blob, { bottom: -150, left: -110, width: 380, height: 380, opacity: 0.06 }]} />
      <View style={styles.center}>
        <Animated.View style={[styles.ring, ring(0)]} />
        <Animated.View style={[styles.ring, ring(0.5)]} />
        <Animated.View
          style={[
            styles.logoTile,
            { opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
          ]}
        >
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
        </Animated.View>
      </View>
      <Animated.View style={{ alignItems: 'center', opacity: appear }}>
        <Text style={styles.title}>
          XMart <Text style={styles.titleAccent}>Track</Text>
        </Text>
        <Text style={styles.tagline}>LIVE GPS VEHICLE TRACKING</Text>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  opacity: dots.interpolate({
                    inputRange: [0, i, i + 0.5, i + 1, 3],
                    outputRange: [0.3, 0.3, 1, 0.3, 0.3],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>
      <Text style={styles.footer}>{`Version ${Constants.expoConfig?.version || ''}  •  xmarttrack.site`}</Text>
    </View>
  );
}

function Gate() {
  // the screen stays on while the app is open (like tracking apps); it sleeps normally when closed
  useKeepAwake();
  const { setUser } = useApp();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // our animated start screen replaces the system splash right away and stays at least 1.5 s
    const started = Date.now();
    SplashScreen.hideAsync().catch(() => {});
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
      const wait = 1500 - (Date.now() - started);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      // the layout stays the one in use (Classic by default); it is changed in Me -> Layout & theme
      router.replace(user ? '/(tabs)' : '/login');
      setReady(true);
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
        <Stack.Screen name="device/[id]/more" options={headerOptions('More')} />
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
  welcome: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A4A55', overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 400, backgroundColor: '#FFFFFF', opacity: 0.07 },
  center: { width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 132, height: 132, borderRadius: 66, borderWidth: 3, borderColor: '#5EEAD4' },
  logoTile: {
    width: 128,
    height: 128,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 14,
  },
  logo: { width: 100, height: 100 },
  title: { marginTop: 4, fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  titleAccent: { color: '#5EEAD4' },
  tagline: { marginTop: 8, fontSize: 12, letterSpacing: 3, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 10, marginTop: 34 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
  footer: { position: 'absolute', bottom: 40, fontSize: 12, color: 'rgba(255,255,255,0.55)' },
});
