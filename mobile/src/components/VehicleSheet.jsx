import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { api } from '../api/server';
import ShareLinkModal from './ShareLinkModal';
import { logWarn } from '../state/log';
import { colors, duration, formatDateTime, getState, kmh, since } from '../state/status';

const actionColors = {
  geofence: '#DC2626',
  playback: '#10B981',
  trips: '#F59E0B',
  commands: '#007080',
  navigate: '#14B8A6',
};

const compass = (deg) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((deg % 360) + 360) % 360) / 45) % 8];

const addressCache = new Map();
const googleKey = Constants.expoConfig?.extra?.googleKey;

// Address from the server geocoder first (the same full local-language address as the website),
// then Google as a backup. Every request has a time limit: on some phones a request to Google
// never answers, which used to block the server lookup.
async function lookupAddress(latitude, longitude) {
  try {
    const text = await api(`api/server/geocode?latitude=${latitude}&longitude=${longitude}`, { timeout: 12000, raw: true });
    let value = String(text || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        // keep as is
      }
    }
    if (value) return value;
    logWarn('address', 'server geocode returned no address');
  } catch (error) {
    logWarn('address', 'server geocode failed', error);
  }
  if (!googleKey) throw new Error('no address');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&language=en&key=${googleKey}`,
      { signal: controller.signal },
    );
    const json = await response.json();
    const result = (json.results || []).find((r) => !(r.types || []).includes('plus_code'));
    if (result?.formatted_address) return result.formatted_address;
    throw new Error(`Google geocode ${json.status} ${json.error_message || ''}`);
  } catch (error) {
    throw controller.signal.aborted ? new Error('Google geocode timeout') : error;
  } finally {
    clearTimeout(timer);
  }
}

export function useAddress(position) {
  const [address, setAddress] = useState(position?.address);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [position?.latitude, position?.longitude]);
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
    let retry;
    lookupAddress(position.latitude, position.longitude)
      .then((text) => {
        if (!text) return;
        addressCache.set(key, text);
        if (active) setAddress(text);
      })
      .catch((error) => {
        logWarn('address', `lookup failed (try ${attempt + 1})`, error);
        // usually a short network drop: try again a few times
        if (active && attempt < 4) retry = setTimeout(() => setAttempt(attempt + 1), 10000);
      });
    return () => {
      active = false;
      clearTimeout(retry);
    };
  }, [position?.latitude, position?.longitude, position?.address, attempt]);
  return address;
}

// Car battery voltage arrives in separate info packets, so the newest position may not carry it:
// fall back to the latest voltage seen in the last 12 hours.
function useVoltage(deviceId, attributes) {
  const [found, setFound] = useState(null);
  const live = attributes.power ?? null;
  useEffect(() => {
    if (live != null) return undefined;
    let active = true;
    const to = new Date();
    const from = new Date(to.getTime() - 12 * 3600 * 1000);
    api(`api/reports/route?deviceId=${deviceId}&from=${from.toISOString()}&to=${to.toISOString()}`, { timeout: 15000 })
      .then((items) => {
        const last = [...items].reverse().find((p) => p.attributes?.power != null || p.attributes?.battery != null);
        if (active && last) setFound({ power: last.attributes.power, battery: last.attributes.battery, time: last.deviceTime || last.fixTime });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [deviceId, live]);
  if (live != null) return { power: live, battery: attributes.battery };
  return found || { battery: attributes.battery };
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

export default function VehicleSheet({ device, position, onClose, onHeight, variant = 'full', bottomOffset = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const attributes = position?.attributes || {};
  const state = getState(device, position);
  const address = useAddress(position);
  const extras = useAccSince(device.id, attributes.ignition);
  const voltage = useVoltage(device.id, attributes);

  const stateText = {
    moving: `Moving ${kmh(position?.speed)} km/h`,
    static: `${attributes.ignition ? 'Idle' : 'Static'} ${!attributes.ignition && extras.accSince ? since(extras.accSince) : ''} ${position?.valid === false ? 'LBS' : 'GPS'}`,
    offline: `Offline ${since(device.lastUpdate)}`,
    inactive: 'Inactive',
  }[state];

  const actions = [
    { key: 'geofence', label: 'Geofence', icon: 'fence', onPress: () => router.push(`/geofences?deviceId=${device.id}`) },
    {
      key: 'playback',
      label: 'Playback',
      icon: 'history',
      onPress: () => router.push(`/device/${device.id}/playback`),
    },
    { key: 'trips', label: 'Trips', icon: 'timeline', onPress: () => router.push(`/device/${device.id}/trips`) },
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
    ['speed', position ? `${kmh(position.speed)} km/h` : null, position?.speed > 1 ? colors.moving : undefined],
    ['explore', position?.course != null ? `${compass(position.course)} ${Math.round(position.course)}°` : null],
    ['signal-cellular-alt', attributes.rssi != null ? `GSM ${attributes.rssi}` : null],
    [
      'bolt',
      voltage.power != null
        ? `${Number(voltage.power).toFixed(1)} V${voltage.time ? ` (${since(voltage.time)} ago)` : ''}`
        : null,
    ],
    ['battery-charging-full', voltage.battery != null ? `Backup ${Number(voltage.battery).toFixed(2)} V` : null],
    ['battery-std', attributes.batteryLevel != null ? `${attributes.batteryLevel}%` : null],
    ['satellite-alt', attributes.sat != null ? String(attributes.sat) : null],
    ['route', extras.today != null ? `Today ${(extras.today / 1000).toFixed(1)} km` : null],
  ].filter((row) => row[1] != null);

  // compact card (Full Map, Dashboard, Split) and big card (Simple Mode); tap the handle for everything
  if (variant !== 'full' && !expanded) {
    const big = variant === 'large';
    const speed = position ? `${kmh(position.speed)} km/h` : '--';
    const acc = attributes.ignition === undefined ? null : `ACC ${attributes.ignition ? 'ON' : 'OFF'}`;
    return (
      <View
        style={[styles.sheet, styles.floating, { bottom: bottomOffset }]}
        onLayout={(e) => onHeight?.(Math.round(e.nativeEvent.layout.height) + bottomOffset)}
      >
        <Pressable style={styles.handle} onPress={() => setExpanded(true)}>
          <MaterialIcons name="expand-less" size={24} color={colors.muted} />
        </Pressable>
        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, big && { fontSize: 24 }]} numberOfLines={1}>{device.name}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <MaterialIcons name="close" size={big ? 28 : 22} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={[styles.pill, { color: colors[state], backgroundColor: `${colors[state]}1A` }, big && { fontSize: 18 }]}>
            {stateText}
          </Text>
          {!big && (
            <Text style={styles.compactMeta} numberOfLines={1}>
              {[speed, acc, voltage.power != null ? `${Number(voltage.power).toFixed(1)} V` : null].filter(Boolean).join('  •  ')}
            </Text>
          )}
          {position && (
            <Text style={[styles.compactAddress, big && { fontSize: 17, lineHeight: 24 }]} numberOfLines={big ? 3 : 1}>
              {address || `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`}
            </Text>
          )}
          {big ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              {[
                ['navigation', 'Navigate', '#14B8A6', actions.find((a) => a.key === 'navigate').onPress],
                ['share', 'Share', '#2563EB', () => setSharing(true)],
                ['history', 'Playback', '#10B981', actions.find((a) => a.key === 'playback').onPress],
              ].map(([icon, label, color, onPress]) => (
                <Pressable key={label} style={[styles.bigAction, { backgroundColor: color }]} onPress={onPress}>
                  <MaterialIcons name={icon} size={28} color="#FFF" />
                  <Text style={styles.bigActionText}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.chips}>
              {[...actions, { key: 'share', label: 'Share', icon: 'share', onPress: () => setSharing(true) }].map((action) => (
                <Pressable key={action.key} style={styles.chip} onPress={action.onPress}>
                  <MaterialIcons name={action.icon} size={18} color={actionColors[action.key] || colors.teal} />
                  <Text style={styles.chipText}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        <ShareLinkModal device={device} visible={sharing} onClose={() => setSharing(false)} />
      </View>
    );
  }

  return (
    <View
      style={[styles.sheet, { maxHeight: expanded ? '82%' : '50%', bottom: bottomOffset }]}
      onLayout={(e) => !expanded && onHeight?.(Math.round(e.nativeEvent.layout.height))}
    >
      <Pressable style={styles.handle} onPress={() => setExpanded(!expanded)}>
        <MaterialIcons name={expanded ? 'expand-more' : 'expand-less'} size={26} color={colors.muted} />
      </Pressable>
      <ScrollView>
        <View style={styles.section}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>
              {device.name}
            </Text>
            <Pressable onPress={() => setSharing(true)} hitSlop={10} style={{ marginRight: 18 }}>
              <MaterialIcons name="share" size={22} color={colors.teal} />
            </Pressable>
            <Pressable onPress={() => router.push(`/devices?id=${device.id}`)} hitSlop={10} style={{ marginRight: 18 }}>
              <MaterialIcons name="edit" size={22} color={colors.teal} />
            </Pressable>
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
      <ShareLinkModal device={device} visible={sharing} onClose={() => setSharing(false)} />
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
    backgroundColor: colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    elevation: 16,
  },
  handle: { alignItems: 'center', paddingTop: 4 },
  floating: { left: 10, right: 10, borderRadius: 18 },
  compactMeta: { marginTop: 6, fontSize: 14, fontWeight: '600', color: colors.text },
  compactAddress: { marginTop: 4, fontSize: 13, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.subtle },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.text },
  bigAction: { flex: 1, height: 72, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 4 },
  bigActionText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
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
