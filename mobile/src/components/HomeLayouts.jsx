import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../api/server';
import { colors, duration, getState, kmh, since } from '../state/status';
import { vehicleIcon } from '../state/vehicleLook';
import { useAddress } from './VehicleSheet';
import ShareLinkModal from './ShareLinkModal';

// Home screens of the Dashboard, Split and Simple layouts (Classic and List First use the list in
// the Monitor screen). The map stays underneath; transparent parts of a layout show it.

const IGNORED_EVENTS = new Set([
  'commandResult', 'deviceOnline', 'deviceOffline', 'deviceUnknown', 'deviceMoving', 'deviceStopped',
  'queuedCommandSent', 'textMessage', 'deviceInactive',
]);

export const stateText = (device, position) => {
  const state = getState(device, position);
  return {
    state,
    text: {
      moving: `Moving ${kmh(position?.speed)} km/h`,
      static: `Parked${position?.attributes?.ignition ? ' (ACC ON)' : ''}`,
      offline: `Offline ${since(device.lastUpdate)}`,
      inactive: 'Not connected yet',
    }[state],
  };
};

// today's totals of all vehicles: distance, driving time, top speed, alerts
function useTodayStats(deviceIds) {
  const [stats, setStats] = useState(null);
  const key = deviceIds.join(',');
  const load = useCallback(async () => {
    if (!key) return;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const ids = key.split(',').map((id) => `deviceId=${id}`).join('&');
    const query = `${ids}&from=${from.toISOString()}&to=${new Date().toISOString()}`;
    try {
      const [summary, events] = await Promise.all([
        api(`api/reports/summary?${query}`, { timeout: 30000 }),
        api(`api/reports/events?${query}`, { timeout: 30000 }).catch(() => []),
      ]);
      setStats({
        distance: summary.reduce((s, i) => s + (i.distance || 0), 0),
        driving: summary.reduce((s, i) => s + (i.engineHours || 0), 0),
        maxSpeed: summary.reduce((s, i) => Math.max(s, i.maxSpeed || 0), 0),
        alerts: events.filter((e) => !IGNORED_EVENTS.has(e.type)).length,
      });
    } catch {
      setStats((previous) => previous || { distance: 0, driving: 0, maxSpeed: 0, alerts: 0 });
    }
  }, [key]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 120000);
    return () => clearInterval(timer);
  }, [load]);
  return [stats, load];
}

function CompactRow({ device, position, onPress, right }) {
  const { state, text } = stateText(device, position);
  return (
    <Pressable style={styles.row} onPress={onPress} android_ripple={{ color: colors.border }}>
      <Image source={vehicleIcon(device, state).image} style={styles.rowIcon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>{device.name}</Text>
        <Text style={[styles.rowState, { color: colors[state] }]} numberOfLines={1}>{text}</Text>
      </View>
      {right}
    </Pressable>
  );
}

export function DashboardHome({ list, positions, onOpen, onFit }) {
  const [top, setTop] = useState(0);
  const [bottom, setBottom] = useState(0);
  const [stats, reload] = useTodayStats(list.map((d) => d.id));
  const online = list.filter((d) => d.status === 'online').length;
  const moving = list.filter((d) => getState(d, positions[d.id]) === 'moving').length;

  useEffect(() => {
    if (top && bottom) onFit({ top: top + 30, bottom: bottom + 30, left: 40, right: 40 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top, bottom, list.length]);

  const cards = [
    ['route', stats ? `${(stats.distance / 1000).toFixed(1)} km` : '…', 'Driven today'],
    ['timer', stats ? duration(stats.driving) || '0m' : '…', 'Engine on'],
    ['speed', stats ? `${kmh(stats.maxSpeed)} km/h` : '…', 'Top speed'],
    ['notifications-active', stats ? String(stats.alerts) : '…', 'Alerts today'],
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.panelTop} onLayout={(e) => setTop(e.nativeEvent.layout.height)}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>{`${list.length} vehicles • ${online} online • ${moving} moving`}</Text>
          <Pressable onPress={reload} hitSlop={10}>
            <MaterialIcons name="refresh" size={20} color={colors.teal} />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {cards.map(([icon, value, label]) => (
            <View key={label} style={styles.stat}>
              <MaterialIcons name={icon} size={22} color={colors.teal} />
              <View style={{ flex: 1 }}>
                <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={{ flex: 1 }} pointerEvents="none" />
      <View style={[styles.panelBottom, { maxHeight: '40%' }]} onLayout={(e) => setBottom(e.nativeEvent.layout.height)}>
        <FlatList
          data={list}
          keyExtractor={(d) => String(d.id)}
          renderItem={({ item }) => (
            <CompactRow device={item} position={positions[item.id]} onPress={() => onOpen(item.id)}
              right={<MaterialIcons name="chevron-right" size={22} color={colors.muted} />} />
          )}
        />
      </View>
    </View>
  );
}

export function SplitHome({ list, positions, onOpen, onFocus, onFit, focusId }) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [size, setSize] = useState(0);

  const pad = () => (landscape ? { left: size + 30, right: 30, top: 30, bottom: 30 } : { bottom: size + 30, top: 40, left: 30, right: 30 });
  useEffect(() => {
    if (size) onFit(pad());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, landscape, list.length]);

  const panel = (
    <View
      style={[styles.panelBottom, landscape ? styles.splitSide : styles.splitBottom]}
      onLayout={(e) => setSize(landscape ? e.nativeEvent.layout.width : e.nativeEvent.layout.height)}
    >
      <FlatList
        data={list}
        keyExtractor={(d) => String(d.id)}
        renderItem={({ item }) => (
          <View style={focusId === item.id ? styles.focused : null}>
            <CompactRow
              device={item}
              position={positions[item.id]}
              onPress={() => onFocus(item.id, pad())}
              right={
                <Pressable style={styles.detailsButton} onPress={() => onOpen(item.id)} hitSlop={6}>
                  <Text style={styles.detailsText}>Details</Text>
                </Pressable>
              }
            />
          </View>
        )}
      />
    </View>
  );

  return (
    <View style={[StyleSheet.absoluteFill, { flexDirection: landscape ? 'row' : 'column' }]} pointerEvents="box-none">
      {landscape && panel}
      <View style={{ flex: 1 }} pointerEvents="none" />
      {!landscape && panel}
    </View>
  );
}

function SimpleCard({ device, position, onOpen, onShare }) {
  const { state, text } = stateText(device, position);
  const address = useAddress(position);
  return (
    <View style={styles.simpleCard}>
      <View style={styles.simpleHead}>
        <Image source={vehicleIcon(device, state).image} style={styles.simpleIcon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.simpleName} numberOfLines={1}>{device.name}</Text>
          <Text style={[styles.simpleState, { color: colors[state] }]}>{text}</Text>
        </View>
      </View>
      {position && (
        <Text style={styles.simpleAddress} numberOfLines={2}>
          {address || `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`}
        </Text>
      )}
      <View style={styles.simpleButtons}>
        {[
          ['map', 'Map', colors.teal, () => onOpen(device.id)],
          ['share-location', 'Share', '#2563EB', () => onShare(device)],
          ['history', 'Playback', '#10B981', () => router.push(`/device/${device.id}/playback`)],
        ].map(([icon, label, color, action]) => (
          <Pressable key={label} style={[styles.bigButton, { backgroundColor: color }]} onPress={action}>
            <MaterialIcons name={icon} size={28} color="#FFF" />
            <Text style={styles.bigButtonText}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function SimpleHome({ list, positions, onOpen, refresh, bottomInset }) {
  const [sharing, setSharing] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
      <FlatList
        data={list}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 24 + (bottomInset || 0) }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh().catch(() => {});
              setRefreshing(false);
            }}
          />
        }
        renderItem={({ item }) => (
          <SimpleCard device={item} position={positions[item.id]} onOpen={onOpen} onShare={setSharing} />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No vehicles yet</Text>}
      />
      {sharing && <ShareLinkModal device={sharing} visible onClose={() => setSharing(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  panelTop: { backgroundColor: colors.background, padding: 12, paddingBottom: 10, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, elevation: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  summaryText: { color: colors.muted, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 14, padding: 12 },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted },
  panelBottom: { backgroundColor: colors.card, elevation: 8 },
  splitBottom: { height: '45%', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 6 },
  splitSide: { width: '40%', borderTopRightRadius: 18, borderBottomRightRadius: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 40, height: 40 },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowState: { fontSize: 13, fontWeight: '600', marginTop: 1 },
  focused: { backgroundColor: colors.subtle },
  detailsButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.teal },
  detailsText: { color: colors.teal, fontWeight: '700', fontSize: 12 },
  simpleCard: { backgroundColor: colors.card, borderRadius: 20, padding: 16, elevation: 2 },
  simpleHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  simpleIcon: { width: 64, height: 64 },
  simpleName: { fontSize: 22, fontWeight: '800', color: colors.text },
  simpleState: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  simpleAddress: { fontSize: 16, color: colors.muted, marginTop: 10, lineHeight: 22 },
  simpleButtons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  bigButton: { flex: 1, height: 72, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 4 },
  bigButtonText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 16 },
});
