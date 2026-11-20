import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../api/server';
import { colors, duration, formatDateTime, getState, kmh, since } from '../state/status';

const actionColors = {
  tracking: '#2563EB',
  playback: '#10B981',
  alerts: '#F59E0B',
  commands: '#007080',
  navigate: '#14B8A6',
};

const addressCache = new Map();

function useAddress(position) {
  const [address, setAddress] = useState(position?.address);
  useEffect(() => {
    if (!position) return;
    if (position.address) {
      setAddress(position.address);
      return;
    }
    const key = `${position.latitude.toFixed(4)},${position.longitude.toFixed(4)}`;
    if (addressCache.has(key)) {
      setAddress(addressCache.get(key));
      return;
    }
    let active = true;
    api(`api/server/geocode?latitude=${position.latitude}&longitude=${position.longitude}`)
      .then((text) => {
        addressCache.set(key, text);
        if (active) setAddress(text);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [position?.latitude, position?.longitude, position?.address]);
  return address;
}

function useAccSince(deviceId, ignition) {
  const [value, setValue] = useState({});
  useEffect(() => {
    let active = true;
    const now = new Date();
    const from = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    Promise.all([
      api(`api/reports/events?deviceId=${deviceId}&type=ignitionOn&type=ignitionOff&from=${from}&to=${now.toISOString()}`),
      api(`api/reports/summary?deviceId=${deviceId}&from=${start.toISOString()}&to=${now.toISOString()}`),
    ])
      .then(([events, summary]) => {
        if (!active) return;
        const last = events.reduce(
          (latest, e) => (!latest || new Date(e.eventTime) > new Date(latest.eventTime) ? e : latest),
          null,
        );
        setValue({ accSince: last?.eventTime, today: summary[0]?.distance });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [deviceId, ignition]);
  return value;
}

export default function VehicleSheet({ device, position, onClose, onTrack }) {
  const [expanded, setExpanded] = useState(false);
  const attributes = position?.attributes || {};
  const state = getState(device, position);
  const address = useAddress(position);
  const extras = useAccSince(device.id, attributes.ignition);

  const stateText = {
    moving: `Moving ${kmh(position?.speed)} km/h`,
    static: `${attributes.ignition ? 'Idle' : 'Static'} ${!attributes.ignition && extras.accSince ? since(extras.accSince) : ''} ${position?.valid === false ? 'LBS' : 'GPS'}`,
    offline: `Offline ${since(device.lastUpdate)}`,
    inactive: 'Inactive',
  }[state];

  const actions = [
    { key: 'tracking', label: 'Tracking', icon: 'place', onPress: onTrack },
    {
      key: 'playback',
      label: 'Playback',
      icon: 'history',
      onPress: () => router.push(`/device/${device.id}/playback`),
    },
    { key: 'alerts', label: 'Alerts', icon: 'notifications-active', onPress: () => router.push('/(tabs)/alerts') },
    {
      key: 'commands',
      label: 'Commands',
      icon: 'code',
      onPress: () => router.push(`/device/${device.id}/commands`),
    },
    {
      key: 'navigate',
      label: 'Navigate',
      icon: 'navigation',
      onPress: () =>
        position &&
        Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${position.latitude},${position.longitude}`,
        ),
    },
  ];

  const rows = [
    ['schedule', formatDateTime(device.lastUpdate)],
    ['place', formatDateTime(position?.fixTime, false)],
    ['memory', device.model || '--'],
    [
      'vpn-key',
      attributes.ignition === undefined
        ? '--'
        : `ACC ${attributes.ignition ? 'ON' : 'OFF'}${extras.accSince ? ` (${since(extras.accSince)})` : ''}`,
      attributes.ignition ? colors.moving : undefined,
    ],
    ['bolt', attributes.power != null ? `${Number(attributes.power).toFixed(1)} V` : null],
    ['battery-std', attributes.batteryLevel != null ? `${attributes.batteryLevel}%` : null],
    ['satellite-alt', attributes.sat != null ? String(attributes.sat) : null],
    ['route', extras.today != null ? `Today ${(extras.today / 1000).toFixed(1)} km` : null],
  ].filter((row) => row[1] != null);

  return (
    <View style={[styles.sheet, { maxHeight: expanded ? '82%' : '50%' }]}>
      <Pressable style={styles.handle} onPress={() => setExpanded(!expanded)}>
        <MaterialIcons name={expanded ? 'expand-more' : 'expand-less'} size={26} color={colors.muted} />
      </Pressable>
      <ScrollView>
        <View style={styles.section}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>
              {device.name}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <MaterialIcons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={[styles.pill, { color: colors[state], backgroundColor: `${colors[state]}1A` }]}>
            {stateText}
          </Text>
          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable key={action.key} style={styles.action} onPress={action.onPress}>
                <View style={[styles.actionIcon, { backgroundColor: actionColors[action.key] }]}>
                  <MaterialIcons name={action.icon} size={26} color="#FFF" />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {position && (
          <View style={styles.section}>
            <View style={styles.addressRow}>
              <MaterialIcons name="location-on" size={20} color={colors.teal} />
              <Text style={styles.address}>{address || `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`}</Text>
            </View>
            <View style={styles.grid}>
              {rows.map(([icon, text, color]) => (
                <View key={icon} style={styles.cell}>
                  <MaterialIcons name={icon} size={18} color={colors.muted} />
                  <Text style={[styles.cellText, color && { color, fontWeight: '700' }]} numberOfLines={1}>
                    {text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
        <View style={styles.section}>
          <Text style={styles.meta}>IMEI: {device.uniqueId}</Text>
          {device.phone ? <Text style={styles.meta}>SIM: {device.phone}</Text> : null}
          {attributes.totalDistance != null && (
            <Text style={styles.meta}>Mileage: {(attributes.totalDistance / 1000).toFixed(1)} km</Text>
          )}
          {device.expirationTime && <Text style={styles.meta}>Expires: {formatDateTime(device.expirationTime, false)}</Text>}
          <Text style={styles.meta}>Last update {since(device.lastUpdate)} ago</Text>
        </View>
      </ScrollView>
    </View>
  );
}

export const durationText = duration;

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    elevation: 16,
  },
  handle: { alignItems: 'center', paddingTop: 4 },
  section: { paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 8, borderBottomColor: colors.background },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  name: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.text },
  pill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    fontSize: 14,
    fontWeight: '600',
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  action: { alignItems: 'center', flex: 1 },
  actionIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { marginTop: 6, fontSize: 13, fontWeight: '600', color: colors.text },
  addressRow: { flexDirection: 'row', gap: 8, paddingTop: 12 },
  address: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  cell: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  cellText: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.muted },
  meta: { fontSize: 14, color: colors.muted, paddingTop: 8, fontWeight: '500' },
});
