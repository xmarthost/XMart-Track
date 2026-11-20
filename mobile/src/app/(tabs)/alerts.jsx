import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../../api/server';
import { useApp } from '../../state/AppState';
import { colors, eventLabels, formatDateTime } from '../../state/status';

const ranges = { today: 0, yesterday: 1, week: 6 };
const iconFor = (type) => {
  if (type === 'ignitionOn') return ['vpn-key', colors.moving];
  if (type === 'ignitionOff') return ['key-off', colors.inactive];
  if (type === 'alarm') return ['warning', colors.offline];
  if (type === 'deviceOverspeed') return ['speed', colors.amber];
  if (type.startsWith('geofence')) return ['hexagon', colors.static];
  return ['notifications', colors.teal];
};

export default function Alerts() {
  const { devices, events: liveEvents, setSelectedId } = useApp();
  const [range, setRange] = useState('today');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

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
      setItems(result);
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
              onPress={() => {
                setSelectedId(item.deviceId);
                router.navigate('/(tabs)');
              }}
            >
              <View style={[styles.icon, { backgroundColor: color }]}>
                <MaterialIcons name={icon} size={24} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.row}>
                  <Text style={styles.type}>
                    {item.type === 'alarm' ? `Alarm: ${item.attributes?.alarm || ''}` : eventLabels[item.type] || item.type}
                  </Text>
                  <Text style={styles.time}>{formatDateTime(item.eventTime, false)}</Text>
                </View>
                <Text style={styles.device}>{devices[item.deviceId]?.name}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center', paddingVertical: 12, color: colors.text, backgroundColor: '#FFF' },
  chips: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 4, backgroundColor: '#FFF' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.background },
  chipActive: { backgroundColor: colors.teal },
  chipText: { fontWeight: '600', color: colors.muted },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, backgroundColor: '#FFF', elevation: 1 },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  type: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  time: { fontSize: 12, color: colors.muted, fontWeight: '500' },
  device: { fontSize: 14, color: colors.muted, marginTop: 4, fontWeight: '500' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
});
