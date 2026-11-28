import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, formatDateTime, getState, kmh, since } from '../state/status';
import { useAccSince, useAddress, useVoltage } from './VehicleSheet';
import ShareLinkModal from './ShareLinkModal';

// Pro layout (full-screen map while a vehicle is open):
//  - ProTopCard: one small card on top (back, name, state, share; address on one line)
//  - ProCallout: a small details popup that sits on the car itself (tap the car to show / hide it)
//  - ProActionBar: five big buttons along the bottom (Track, Playback, Geo-fence, Commands, More)
export const PRO_BAR_HEIGHT = 88;
export const PRO_TOP_HEIGHT = 78;

const stateLabel = { moving: 'Moving', static: 'Static', offline: 'Offline', inactive: 'Inactive' };

export function ProTopCard({ device, position, onBack }) {
  const [sharing, setSharing] = useState(false);
  const state = getState(device, position);
  const address = useAddress(position);
  return (
    <View style={styles.top}>
      <View style={styles.topRow}>
        <Pressable onPress={onBack} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.name} numberOfLines={1}>{device.name}</Text>
        <Text style={[styles.badge, { backgroundColor: colors[state] }]}>{stateLabel[state]}</Text>
        <Pressable onPress={() => setSharing(true)} hitSlop={12}>
          <MaterialIcons name="share" size={22} color={colors.teal} />
        </Pressable>
      </View>
      <Text style={styles.address} numberOfLines={1}>
        {position ? address || `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : 'No location yet'}
      </Text>
      <ShareLinkModal device={device} visible={sharing} onClose={() => setSharing(false)} />
    </View>
  );
}

export function ProCallout({ device, position, onClose }) {
  const attributes = position?.attributes || {};
  const state = getState(device, position);
  const voltage = useVoltage(device.id, attributes);
  const extras = useAccSince(device.id, attributes.ignition);
  const rows = [
    ['Connection', device.status === 'online' ? 'Online' : 'Offline', device.status === 'online' ? colors.moving : colors.offline],
    ['Mode', position?.valid === false ? 'LBS' : 'GPS'],
    ['Satellites', attributes.sat != null ? String(attributes.sat) : '--'],
    ['Network', attributes.rssi != null ? `GSM ${attributes.rssi}` : '--'],
    ['Speed', position ? `${kmh(position.speed)} km/h` : '--'],
    ['Voltage', voltage.power != null ? `${Number(voltage.power).toFixed(1)} V` : '--'],
    ['ACC', attributes.ignition === undefined ? '--' : attributes.ignition ? 'ON' : 'OFF', attributes.ignition ? colors.moving : undefined],
    ['Today', extras.today != null ? `${(extras.today / 1000).toFixed(1)} km` : '--'],
    [state === 'moving' ? 'Moving' : 'Static', extras.accSince ? since(extras.accSince) : since(device.lastUpdate)],
    // only for trackers that report them (e.g. MiCODUS MV710G: armed, door, battery %)
    ...(attributes.armed !== undefined ? [['Armed', attributes.armed ? 'Yes' : 'No', attributes.armed ? colors.amber : undefined]] : []),
    ...(attributes.door !== undefined ? [['Door', attributes.door ? 'Open' : 'Closed', attributes.door ? colors.offline : undefined]] : []),
    ...(attributes.batteryLevel !== undefined ? [['Battery', `${attributes.batteryLevel}%`]] : []),
    ...(attributes.fuel !== undefined ? [['Fuel', String(attributes.fuel)]] : []),
  ];
  return (
    <View style={styles.calloutWrap} collapsable={false}>
      <Pressable style={styles.callout} onPress={onClose}>
        <View style={styles.calloutHead}>
          <Text style={styles.imei}>{device.uniqueId}</Text>
          <Text style={[styles.smallBadge, { backgroundColor: colors[state] }]}>{stateLabel[state]}</Text>
        </View>
        <View style={styles.grid}>
          {rows.map(([label, value, color]) => (
            <Text key={label} style={styles.cell} numberOfLines={1}>
              <Text style={styles.cellLabel}>{`${label}: `}</Text>
              <Text style={[styles.cellValue, color && { color }]}>{value}</Text>
            </Text>
          ))}
        </View>
        <Text style={styles.time}>{formatDateTime(position?.fixTime || device.lastUpdate)}</Text>
      </Pressable>
      <View style={styles.pointer} />
    </View>
  );
}

const actions = [
  { key: 'track', label: 'Track', icon: 'my-location', color: '#8B5CF6' },
  { key: 'playback', label: 'Playback', icon: 'route', color: '#3B82F6' },
  { key: 'geofence', label: 'Geo-fence', icon: 'fence', color: '#F59E0B' },
  { key: 'commands', label: 'Commands', icon: 'settings-remote', color: '#16A34A' },
  { key: 'more', label: 'More', icon: 'apps', color: '#64748B' },
];

export function ProActionBar({ device, onTrack, bottomInset = 0 }) {
  const press = (key) => {
    if (key === 'track') onTrack?.();
    else if (key === 'playback') router.push(`/device/${device.id}/playback`);
    else if (key === 'geofence') router.push(`/geofences?deviceId=${device.id}`);
    else if (key === 'commands') router.push(`/device/${device.id}/commands`);
    else router.push(`/device/${device.id}/more`);
  };
  return (
    <View style={[styles.bar, { height: PRO_BAR_HEIGHT + bottomInset, paddingBottom: bottomInset }]}>
      {actions.map((a) => (
        <Pressable key={a.key} style={styles.action} onPress={() => press(a.key)}>
          <View style={[styles.tile, { backgroundColor: a.color }]}>
            <MaterialIcons name={a.icon} size={26} color="#FFF" />
          </View>
          <Text style={styles.actionText}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 8, left: 10, right: 10, backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, elevation: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  badge: { color: '#FFF', fontWeight: '800', fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 7, overflow: 'hidden' },
  address: { marginTop: 4, marginLeft: 34, fontSize: 13, color: colors.muted },
  calloutWrap: { alignItems: 'center' },
  callout: { width: 250, backgroundColor: colors.card, borderRadius: 12, padding: 9, elevation: 8 },
  calloutHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  imei: { fontSize: 12, fontWeight: '700', color: colors.text },
  smallBadge: { color: '#FFF', fontWeight: '800', fontSize: 11, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 6, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', paddingVertical: 1.5 },
  cellLabel: { fontSize: 11.5, color: colors.muted },
  cellValue: { fontSize: 11.5, fontWeight: '700', color: colors.text },
  time: { fontSize: 11.5, color: colors.muted, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 5, marginTop: 4 },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.card,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 12,
  },
  action: { alignItems: 'center', width: '19%' },
  tile: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionText: { marginTop: 4, fontSize: 11.5, fontWeight: '600', color: colors.text },
});
