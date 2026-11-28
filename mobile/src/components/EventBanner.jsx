import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../state/AppState';
import { colors, eventLabels } from '../state/status';
import { logInfo } from '../state/log';

const styleFor = (event) => {
  switch (event.type) {
    case 'ignitionOn':
      return { icon: 'vpn-key', color: colors.moving, text: 'ACC ON — vehicle started' };
    case 'ignitionOff':
      return { icon: 'vpn-key', color: colors.offline, text: 'ACC OFF — vehicle stopped' };
    case 'alarm':
      return { icon: 'warning', color: colors.offline, text: `Alarm: ${event.attributes?.alarm || ''}` };
    case 'deviceOverspeed':
      return { icon: 'speed', color: colors.amber, text: 'Overspeed' };
    case 'geofenceEnter':
    case 'geofenceExit':
      return { icon: 'fence', color: colors.static, text: eventLabels[event.type] };
    default:
      return { icon: 'notifications', color: colors.teal, text: eventLabels[event.type] || event.type };
  }
};

const shown = new Set(['ignitionOn', 'ignitionOff', 'alarm', 'deviceOverspeed', 'geofenceEnter', 'geofenceExit']);

// Banner + vibration as soon as the server reports ignition, alarm, overspeed or geofence events.
export default function EventBanner() {
  const { events, devices, setSelectedId } = useApp();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(null);
  const seenRef = useRef(new Set());
  const firstRef = useRef(true);
  const slide = useRef(new Animated.Value(-140)).current;

  useEffect(() => {
    const fresh = events.filter((e) => !seenRef.current.has(e.id));
    fresh.forEach((e) => seenRef.current.add(e.id));
    if (firstRef.current) {
      firstRef.current = false;
      return undefined;
    }
    const event = fresh.find((e) => shown.has(e.type));
    if (!event) return undefined;
    logInfo('event', `${devices[event.deviceId]?.name || event.deviceId}: ${event.type}`);
    setCurrent(event);
    Vibration.vibrate(event.type === 'alarm' ? [0, 400, 200, 400] : 300);
    Animated.spring(slide, { toValue: 0, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(slide, { toValue: -140, duration: 250, useNativeDriver: true }).start(() => setCurrent(null));
    }, 6000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  if (!current) return null;
  const look = styleFor(current);
  const time = new Date(current.eventTime);
  const hhmm = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;

  return (
    <Animated.View style={[styles.wrap, { top: insets.top + 6, transform: [{ translateY: slide }] }]}>
      <Pressable
        style={[styles.banner, { borderLeftColor: look.color }]}
        onPress={() => {
          setSelectedId(current.deviceId);
          setCurrent(null);
          router.navigate('/(tabs)');
        }}
      >
        <View style={[styles.icon, { backgroundColor: `${look.color}1F` }]}>
          <MaterialIcons name={look.icon} size={22} color={look.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {devices[current.deviceId]?.name || 'Vehicle'}
          </Text>
          <Text style={[styles.text, { color: look.color }]} numberOfLines={1}>{`${look.text}  •  ${hhmm}`}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 10, right: 10, zIndex: 100, elevation: 40 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderLeftWidth: 5,
    backgroundColor: colors.card,
    elevation: 12,
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  text: { fontSize: 13, fontWeight: '700', marginTop: 2 },
});
