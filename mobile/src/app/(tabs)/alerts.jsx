import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../../api/server';
import { useApp } from '../../state/AppState';
import { colors, eventLabels, formatDateTime, kmh } from '../../state/status';
import TrackMap from '../../map/TrackMap';
import { Button } from '../../components/ui';
import { vehicleIcon } from '../../state/vehicleLook';

const ranges = { today: 0, yesterday: 1, week: 6 };
// technical events that are not vehicle alerts
const hidden = new Set(['commandResult', 'queuedCommandSent', 'textMessage', 'deviceUnknown', 'media']);

const distanceKm = (a, b) => {
  const rad = (v) => (v * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

const alertTitle = (item) =>
  item.type === 'alarm' ? `Alarm: ${item.attributes?.alarm || ''}` : eventLabels[item.type] || item.type;

// Window like other tracking apps: where the event happened, on a map, with the address.
function AlertDetails({ event, onClose }) {
  const { devices, positions, user, setSelectedId } = useApp();
  const insets = useSafeAreaInsets();
  const [position, setPosition] = useState(null);
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const device = devices[event.deviceId];
  const current = positions[event.deviceId];

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const found = event.positionId ? (await api(`api/positions?id=${event.positionId}`))[0] : null;
        const point = found || current || null;
        if (!active) return;
        setPosition(point);
        if (point?.address) setAddress(point.address);
        else if (point) {
          const text = await api(`api/server/geocode?latitude=${point.latitude}&longitude=${point.longitude}`, {
            raw: true,
            timeout: 12000,
          }).catch(() => null);
          if (active && text) setAddress(String(text).trim());
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const state = event.type === 'ignitionOn' || event.type === 'deviceMoving' ? 'moving' : event.type === 'alarm' ? 'offline' : 'static';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.detailHeader, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <MaterialIcons name="arrow-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.detailTitle}>Alarm Details</Text>
          <View style={{ width: 26 }} />
        </View>
        {position ? (
          <TrackMap
            style={{ flex: 1 }}
            initialViewState={{ center: [position.longitude, position.latitude], zoom: 16 }}
            cars={[{ id: event.deviceId, latitude: position.latitude, longitude: position.longitude, course: position.course, state, icon: vehicleIcon(devices[event.deviceId], state).key }]}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {loading ? <ActivityIndicator color={colors.teal} /> : <Text style={styles.empty}>No location for this alert</Text>}
          </View>
        )}
        <View style={[styles.detailCard, { marginBottom: insets.bottom + 12 }]}>
          <View style={styles.row}>
            <Text style={styles.detailName} numberOfLines={1}>{device?.name || 'Vehicle'}</Text>
            <Text style={styles.detailType}>{alertTitle(event)}</Text>
          </View>
          <View style={styles.detailLine}>
            <MaterialIcons name="location-on" size={18} color={colors.teal} />
            <Text style={styles.detailAddress}>
              {address || (position ? `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}` : loading ? 'Loading address…' : '-')}
            </Text>
          </View>
          {position && current ? (
            <View style={styles.detailLine}>
              <MaterialIcons name="straighten" size={18} color={colors.muted} />
              <Text style={styles.detailMeta}>{`Distance from vehicle now: ${distanceKm(position, current).toFixed(1)} km`}</Text>
            </View>
          ) : null}
          {position?.speed > 0 ? (
            <View style={styles.detailLine}>
              <MaterialIcons name="speed" size={18} color={colors.muted} />
              <Text style={styles.detailMeta}>{`Speed: ${kmh(position.speed)} km/h`}</Text>
            </View>
          ) : null}
          <View style={styles.detailLine}>
            <MaterialIcons name="person-outline" size={18} color={colors.muted} />
            <Text style={styles.detailMeta}>{`Customer: ${user?.name || '-'}`}</Text>
          </View>
          <View style={styles.detailLine}>
            <MaterialIcons name="schedule" size={18} color={colors.muted} />
            <Text style={styles.detailMeta}>{`Alarm time: ${formatDateTime(event.eventTime)}`}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button
              title="Navigate"
              icon="navigation"
              outline
              style={{ flex: 1 }}
              disabled={!position}
              onPress={() =>
                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${position.latitude},${position.longitude}`)
              }
            />
            <Button
              title="Vehicle now"
              icon="directions-car"
              style={{ flex: 1 }}
              onPress={() => {
                onClose();
                setSelectedId(event.deviceId);
                router.navigate('/(tabs)');
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
const iconFor = (type) => {
  if (type === 'ignitionOn') return ['vpn-key', colors.moving];
  if (type === 'ignitionOff') return ['key-off', colors.inactive];
  if (type === 'alarm') return ['warning', colors.offline];
  if (type === 'deviceOverspeed') return ['speed', colors.amber];
  if (type.startsWith('geofence')) return ['hexagon', colors.static];
  return ['notifications', colors.teal];
};

export default function Alerts() {
  const { devices, events: liveEvents } = useApp();
  const [range, setRange] = useState('today');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    const ids = Object.keys(devices);
    if (!ids.length) return;
    setLoading(true);
    try {
      const to = new Date();
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      from.setDate(from.getDate() - ranges[range]);
      if (range === 'yesterday') to.setTime(new Date(from.getTime() + 24 * 3600 * 1000).getTime());
      const query = ids.map((id) => `deviceId=${id}`).join('&');
      const result = await api(`api/reports/events?${query}&from=${from.toISOString()}&to=${to.toISOString()}`);
      result.sort((a, b) => new Date(b.eventTime) - new Date(a.eventTime));
      setItems(result.filter((e) => !hidden.has(e.type)));
    } catch {
      // keep previous list
    } finally {
      setLoading(false);
    }
  }, [devices, range]);

  useEffect(() => {
    load();
  }, [load, liveEvents.length]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Text style={styles.title}>Alerts</Text>
      <View style={styles.chips}>
        {[
          ['today', 'Today'],
          ['yesterday', 'Yesterday'],
          ['week', 'Last 7 days'],
        ].map(([key, label]) => (
          <Pressable key={key} style={[styles.chip, range === key && styles.chipActive]} onPress={() => setRange(key)}>
            <Text style={[styles.chipText, range === key && { color: '#FFF' }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        ListEmptyComponent={!loading && <Text style={styles.empty}>No alerts</Text>}
        renderItem={({ item }) => {
          const [icon, color] = iconFor(item.type);
          return (
            <Pressable
              style={styles.card}
              onPress={() => setDetail(item)}
            >
              <View style={[styles.icon, { backgroundColor: color }]}>
                <MaterialIcons name={icon} size={24} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.row}>
                  <Text style={styles.type}>
                    {alertTitle(item)}
                  </Text>
                  <Text style={styles.time}>{formatDateTime(item.eventTime, false)}</Text>
                </View>
                <Text style={styles.device}>{devices[item.deviceId]?.name}</Text>
              </View>
            </Pressable>
          );
        }}
      />
      {detail && <AlertDetails event={detail} onClose={() => setDetail(null)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center', paddingVertical: 12, color: colors.text, backgroundColor: colors.card },
  chips: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 4, backgroundColor: colors.card },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.background },
  chipActive: { backgroundColor: colors.teal },
  chipText: { fontWeight: '600', color: colors.muted },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, backgroundColor: colors.card, elevation: 1 },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  type: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  time: { fontSize: 12, color: colors.muted, fontWeight: '500' },
  device: { fontSize: 14, color: colors.muted, marginTop: 4, fontWeight: '500' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: colors.card },
  detailTitle: { fontSize: 19, fontWeight: '700', color: colors.text },
  detailCard: { margin: 12, marginTop: -40, padding: 16, borderRadius: 16, backgroundColor: colors.card, elevation: 6 },
  detailName: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.text },
  detailType: { fontSize: 15, fontWeight: '600', color: colors.muted },
  detailLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  detailAddress: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '500', lineHeight: 22 },
  detailMeta: { flex: 1, fontSize: 14, color: colors.muted, fontWeight: '500' },
});
