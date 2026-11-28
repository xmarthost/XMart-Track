import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, formatDateTime, getState, kmh, since } from '../state/status';
import { useAccSince, useAddress, useVoltage } from './VehicleSheet';
import ShareLinkModal from './ShareLinkModal';

// Pro layout: address card on top, a details card that opens under it, and five big function
// buttons along the bottom (Track, Playback, Geo-fence, Commands, More).
export const PRO_BAR_HEIGHT = 108;

const actions = [
  { key: 'track', label: 'Track', icon: 'my-location', color: '#8B5CF6' },
  { key: 'playback', label: 'Playback', icon: 'route', color: '#3B82F6' },
  { key: 'geofence', label: 'Geo-fence', icon: 'fence', color: '#F59E0B' },
  { key: 'commands', label: 'Commands', icon: 'settings-remote', color: '#16A34A' },
  { key: 'more', label: 'More', icon: 'apps', color: '#64748B' },
];

export default function ProVehicle({ device, position, onTrack, onClose }) {
  const [open, setOpen] = useState(true);
  const [sharing, setSharing] = useState(false);
  const attributes = position?.attributes || {};
  const state = getState(device, position);
  const address = useAddress(position);
  const voltage = useVoltage(device.id, attributes);
  const extras = useAccSince(device.id, attributes.ignition);

  const stateLabel = { moving: 'Moving', static: 'Static', offline: 'Offline', inactive: 'Inactive' }[state];
  const info = [
    ['Connection', device.status === 'online' ? 'Online' : 'Offline', device.status === 'online' ? colors.moving : colors.offline],
    ['Mode', position?.valid === false ? 'LBS' : 'GPS'],
    ['Satellites', attributes.sat != null ? String(attributes.sat) : '--'],
    ['Network', attributes.rssi != null ? `GSM ${attributes.rssi}` : '--'],
    ['Voltage', voltage.power != null ? `${Number(voltage.power).toFixed(1)} V` : '--'],
    ['Speed', position ? `${kmh(position.speed)} km/h` : '--'],
    ['ACC', attributes.ignition === undefined ? '--' : attributes.ignition ? 'ON' : 'OFF', attributes.ignition ? colors.moving : undefined],
    ['Today', extras.today != null ? `${(extras.today / 1000).toFixed(1)} km` : '--'],
    [state === 'moving' ? 'Moving for' : 'Static for', extras.accSince ? since(extras.accSince) : since(device.lastUpdate)],
    ['Mileage', attributes.totalDistance != null ? `${(attributes.totalDistance / 1000).toFixed(0)} km` : '--'],
  ];

  const press = (key) => {
    if (key === 'track') onTrack?.();
    else if (key === 'playback') router.push(`/device/${device.id}/playback`);
    else if (key === 'geofence') router.push(`/geofences?deviceId=${device.id}`);
    else if (key === 'commands') router.push(`/device/${device.id}/commands`);
    else router.push(`/device/${device.id}/more`);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.top}>
        <Pressable style={styles.addressCard} onPress={() => setOpen(!open)}>
          <Text style={styles.address} numberOfLines={2}>
            {position ? address || `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : 'No location yet'}
          </Text>
          <View style={styles.addressRow}>
            <Text style={styles.name} numberOfLines={1}>{device.name}</Text>
            <MaterialIcons name={open ? 'keyboard-double-arrow-up' : 'keyboard-double-arrow-down'} size={20} color={colors.muted} />
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setSharing(true)} hitSlop={10} style={{ marginRight: 14 }}>
              <MaterialIcons name="share" size={20} color={colors.teal} />
            </Pressable>
            <Pressable onPress={onClose} hitSlop={10}>
              <MaterialIcons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
        </Pressable>
        {open && (
          <View style={styles.infoCard}>
            <View style={styles.infoHead}>
              <Text style={styles.imei}>{device.uniqueId}</Text>
              <Text style={[styles.badge, { backgroundColor: colors[state] }]}>{stateLabel}</Text>
            </View>
            <View style={styles.grid}>
              {info.map(([label, value, color]) => (
                <Text key={label} style={styles.cell} numberOfLines={1}>
                  <Text style={styles.cellLabel}>{`${label}: `}</Text>
                  <Text style={[styles.cellValue, color && { color }]}>{value}</Text>
                </Text>
              ))}
            </View>
            <Text style={styles.time}>{formatDateTime(position?.fixTime || device.lastUpdate)}</Text>
            {position && (
              <Pressable
                style={styles.navigate}
                onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${position.latitude},${position.longitude}`)}
              >
                <MaterialIcons name="navigation" size={16} color={colors.teal} />
                <Text style={styles.navigateText}>Navigate to vehicle</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      <View style={styles.bar}>
        {actions.map((a) => (
          <Pressable key={a.key} style={styles.action} onPress={() => press(a.key)}>
            <View style={[styles.tile, { backgroundColor: a.color }]}>
              <MaterialIcons name={a.icon} size={30} color="#FFF" />
            </View>
            <Text style={styles.actionText}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
      <ShareLinkModal device={device} visible={sharing} onClose={() => setSharing(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 10, left: 10, right: 10 },
  addressCard: { backgroundColor: colors.card, borderRadius: 16, padding: 12, elevation: 6 },
  address: { fontSize: 15, color: colors.text, backgroundColor: colors.subtle, borderRadius: 8, padding: 8, lineHeight: 20 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  name: { fontSize: 16, fontWeight: '800', color: colors.teal, maxWidth: '55%' },
  infoCard: { backgroundColor: colors.card, borderRadius: 16, padding: 12, marginTop: 8, elevation: 6, marginRight: 50 },
  infoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  imei: { fontSize: 14, fontWeight: '700', color: colors.text },
  badge: { color: '#FFF', fontWeight: '800', fontSize: 13, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', paddingVertical: 3 },
  cellLabel: { fontSize: 13, color: colors.muted },
  cellValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  time: { fontSize: 13, color: colors.text, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 6 },
  navigate: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  navigateText: { color: colors.teal, fontWeight: '700', fontSize: 13 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: PRO_BAR_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    elevation: 12,
  },
  action: { alignItems: 'center', width: '19%' },
  tile: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionText: { marginTop: 6, fontSize: 12, fontWeight: '600', color: colors.text },
});
