import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../../../api/server';
import { useApp } from '../../../state/AppState';
import { colors, duration, kmh } from '../../../state/status';
import { Chips } from '../../../components/ui';

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const clock = (t) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const km = (meters) => `${((meters || 0) / 1000).toFixed(1)} km`;
const place = (address, lat, lon) =>
  address ? address.split(',').slice(0, 2).join(',') : lat != null ? `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}` : '—';

const ranges = [
  { value: 0, label: 'Today' },
  { value: 1, label: 'Yesterday' },
  { value: 7, label: 'Last 7 days' },
];

// Trips report: one card per trip (from → to, km, time, top speed) and the stops between them,
// with day totals. Tapping a trip opens the playback of that day.
export default function Trips() {
  const { id } = useLocalSearchParams();
  const deviceId = Number(id);
  const insets = useSafeAreaInsets();
  const { devices } = useApp();
  const [range, setRange] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const period = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (range === 1) return { from: new Date(start.getTime() - 864e5), to: new Date(start.getTime() - 1) };
    if (range === 7) return { from: new Date(start.getTime() - 6 * 864e5), to: new Date() };
    return { from: start, to: new Date() };
  }, [range]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = `deviceId=${deviceId}&from=${period.from.toISOString()}&to=${period.to.toISOString()}`;
      const [trips, stops] = await Promise.all([
        api(`api/reports/trips?${query}`, { timeout: 30000 }),
        api(`api/reports/stops?${query}`, { timeout: 30000 }),
      ]);
      setItems(
        [...trips.map((t) => ({ ...t, kind: 'trip' })), ...stops.map((s) => ({ ...s, kind: 'stop' }))].sort(
          (a, b) => new Date(b.startTime) - new Date(a.startTime),
        ),
      );
    } catch (e) {
      setError(String(e.message || e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [deviceId, period]);

  useEffect(() => {
    load();
  }, [load]);

  const trips = items.filter((i) => i.kind === 'trip');
  const totals = trips.reduce(
    (t, i) => ({ distance: t.distance + (i.distance || 0), time: t.time + (i.duration || 0), max: Math.max(t.max, i.maxSpeed || 0) }),
    { distance: 0, time: 0, max: 0 },
  );

  const header = (
    <View>
      <Text style={styles.vehicle}>{devices[deviceId]?.name}</Text>
      <Chips options={ranges} value={range} onChange={setRange} />
      <View style={styles.totals}>
        {[
          ['route', km(totals.distance), 'Distance'],
          ['timer', duration(totals.time) || '0m', 'Driving'],
          ['speed', `${kmh(totals.max)} km/h`, 'Top speed'],
          ['flag', String(trips.length), 'Trips'],
        ].map(([icon, value, label]) => (
          <View key={label} style={styles.total}>
            <MaterialIcons name={icon} size={20} color={colors.teal} />
            <Text style={styles.totalValue}>{value}</Text>
            <Text style={styles.totalLabel}>{label}</Text>
          </View>
        ))}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );

  const renderItem = ({ item }) =>
    item.kind === 'trip' ? (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/device/${deviceId}/playback?day=${dayKey(new Date(item.startTime))}`)}
      >
        <View style={styles.timeline}>
          <View style={[styles.dot, { backgroundColor: colors.moving }]} />
          <View style={styles.line} />
          <View style={[styles.dot, { backgroundColor: colors.offline }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.place} numberOfLines={1}>
            {clock(item.startTime)}  {place(item.startAddress, item.startLat, item.startLon)}
          </Text>
          <Text style={styles.meta}>
            {km(item.distance)} • {duration(item.duration) || '0m'} • max {kmh(item.maxSpeed)} km/h • avg {kmh(item.averageSpeed)} km/h
          </Text>
          <Text style={styles.place} numberOfLines={1}>
            {clock(item.endTime)}  {place(item.endAddress, item.endLat, item.endLon)}
          </Text>
          {range === 7 && <Text style={styles.day}>{new Date(item.startTime).toDateString()}</Text>}
        </View>
        <MaterialIcons name="play-circle-outline" size={26} color={colors.teal} />
      </Pressable>
    ) : (
      <View style={styles.stop}>
        <MaterialIcons name="local-parking" size={18} color={colors.static} />
        <Text style={styles.stopText} numberOfLines={1}>
          Parked {duration(item.duration) || '0m'} • {clock(item.startTime)}–{clock(item.endTime)} • {place(item.address, item.latitude, item.longitude)}
        </Text>
      </View>
    );

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => `${item.kind}-${item.startTime}-${index}`}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? <ActivityIndicator color={colors.teal} style={{ marginTop: 30 }} /> : <Text style={styles.empty}>No trips in this period</Text>
        }
        refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={load} />}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 24 + insets.bottom }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  vehicle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 },
  totals: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 4 },
  total: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 10, alignItems: 'center' },
  totalValue: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 4 },
  totalLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 16, padding: 12 },
  timeline: { alignItems: 'center', alignSelf: 'stretch', paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  place: { fontSize: 14, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginVertical: 6 },
  day: { fontSize: 11, color: colors.muted, marginTop: 4 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 6 },
  stopText: { flex: 1, fontSize: 12, color: colors.muted },
  error: { color: colors.offline, marginTop: 8 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 30 },
});
