import { useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, FlatList, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, getBase } from '../api/server';
import { useApp } from '../state/AppState';
import { colors, formatDateTime } from '../state/status';
import { clearLogs, formatLogTime, getLogs, logInfo, logsAsText, subscribeLogs } from '../state/log';
import { checkGoogleApi, checkTiles, useMapState } from '../map/mapState';
import { findStyle } from '../map/mapStyles';

const googleKey = Constants.expoConfig?.extra?.googleKey;
const levelColors = { info: colors.muted, warn: colors.amber, error: colors.offline };

const timed = async (task) => {
  const started = Date.now();
  try {
    const detail = await task();
    return { ok: true, detail, ms: Date.now() - started };
  } catch (error) {
    return { ok: false, detail: String(error?.message || error).slice(0, 160), ms: Date.now() - started };
  }
};

const tests = [
  ['Server connection', () => timed(async () => `version ${(await api('api/server')).version || '?'}`)],
  ['Google Map Tiles API (your key)', () => checkGoogleApi('googleRoad')],
  ['Google public tiles', () => checkTiles('googleRoad')],
  ['Google satellite tiles', () => checkTiles('googleHybrid')],
  ['Free map tiles (Carto)', () => checkTiles('freeStreets')],
  ['Free satellite tiles (Esri)', () => checkTiles('freeSatellite')],
  [
    'Google address lookup',
    () =>
      timed(async () => {
        if (!googleKey) throw new Error('no key in app');
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=31.5204,74.3587&key=${googleKey}`,
        );
        const json = await response.json();
        if (json.status !== 'OK') throw new Error(`${json.status} ${json.error_message || ''}`);
        return json.results[0]?.formatted_address;
      }),
  ],
  [
    'Alert rules (WhatsApp / SMS)',
    () =>
      timed(async () => {
        const rules = await api('api/notifications');
        const list = rules
          .filter((n) => /sms|xmwhatsapp/.test(n.notificators || ''))
          .map((n) => `${n.type}: ${n.notificators}${n.always ? '' : ' (not all devices)'}`);
        if (!list.length) throw new Error('no WhatsApp/SMS alert rules: save them in SMS & WhatsApp alerts');
        return list.join(' | ');
      }),
  ],
  [
    'ACC events last 24 h (server)',
    () =>
      timed(async () => {
        const now = new Date();
        const from = new Date(now.getTime() - 864e5).toISOString();
        const devices = await api('api/devices');
        const ids = devices.map((d) => `deviceId=${d.id}`).join('&');
        const events = await api(`api/reports/events?${ids}&type=ignitionOn&type=ignitionOff&from=${from}&to=${now.toISOString()}`);
        if (!events.length) throw new Error('server saw no ACC ON/OFF in 24 h: tracker data did not reach the server');
        const last = events.sort((a, b) => new Date(b.eventTime) - new Date(a.eventTime))[0];
        return `${events.length} events, last ${last.type} at ${formatDateTime(last.eventTime)}`;
      }),
  ],
  [
    'Server address lookup',
    () => timed(async () => String(await api('api/server/geocode?latitude=31.5204&longitude=74.3587', { raw: true })).slice(0, 120)),
  ],
];

export default function Diagnostics() {
  const insets = useSafeAreaInsets();
  const { user, connected, devices, positions } = useApp();
  const { chosen, active, source, notice } = useMapState();
  const logs = useSyncExternalStore(subscribeLogs, getLogs);
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);

  const runTests = async () => {
    setRunning(true);
    setResults({});
    for (const [name, run] of tests) {
      const result = await run();
      logInfo('test', `${name}: ${result.ok ? 'OK' : 'FAIL'} ${result.detail || ''} (${result.ms} ms)`);
      setResults((previous) => ({ ...previous, [name]: result }));
    }
    setRunning(false);
  };

  const info = [
    ['App', `${Constants.expoConfig?.version} (build ${Constants.expoConfig?.android?.versionCode ?? '?'})`],
    ['Server', getBase()],
    ['User', user?.email || '-'],
    ['Live connection', connected ? 'connected' : 'not connected'],
    ['Devices / positions', `${Object.keys(devices).length} / ${Object.keys(positions).length}`],
    ['Map chosen', findStyle(chosen).label],
    ['Map showing', findStyle(active).label + (notice ? ' (fallback)' : '')],
    ['Map tiles from', source || '-'],
    ['Google key', googleKey ? `…${googleKey.slice(-6)}` : 'missing'],
  ];

  const share = () => {
    const header = info.map(([k, v]) => `${k}: ${v}`).join('\n');
    const testText = Object.entries(results)
      .map(([name, r]) => `${r.ok ? 'OK  ' : 'FAIL'} ${name}: ${r.detail || ''} (${r.ms} ms)`)
      .join('\n');
    Share.share({ message: `XMart Track diagnostics\n${header}\n\n${testText}\n\n${logsAsText()}` });
  };

  const headerView = (
    <View>
      <View style={styles.card}>
        {info.map(([label, value]) => (
          <View key={label} style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue} numberOfLines={2}>
              {value}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Pressable style={[styles.button, { backgroundColor: colors.teal }]} onPress={runTests} disabled={running}>
          {running ? <ActivityIndicator color="#FFF" /> : <MaterialIcons name="play-arrow" size={20} color="#FFF" />}
          <Text style={styles.buttonText}>Run tests</Text>
        </Pressable>
        <Pressable style={[styles.button, { backgroundColor: '#16A34A' }]} onPress={share}>
          <MaterialIcons name="share" size={18} color="#FFF" />
          <Text style={styles.buttonText}>Share</Text>
        </Pressable>
        <Pressable style={[styles.button, { backgroundColor: '#64748B' }]} onPress={clearLogs}>
          <MaterialIcons name="delete-outline" size={18} color="#FFF" />
          <Text style={styles.buttonText}>Clear</Text>
        </Pressable>
      </View>
      {Object.keys(results).length > 0 && (
        <View style={styles.card}>
          {tests.map(([name]) => {
            const result = results[name];
            if (!result) return null;
            return (
              <View key={name} style={styles.testRow}>
                <MaterialIcons
                  name={result.ok ? 'check-circle' : 'cancel'}
                  size={20}
                  color={result.ok ? '#16A34A' : colors.offline}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.testName}>{`${name}  ·  ${result.ms} ms`}</Text>
                  {!!result.detail && <Text style={styles.testDetail}>{result.detail}</Text>}
                </View>
              </View>
            );
          })}
        </View>
      )}
      <Text style={styles.section}>{`Logs (${logs.length})`}</Text>
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      data={logs}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={headerView}
      contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
      ListEmptyComponent={<Text style={styles.empty}>No log entries yet</Text>}
      renderItem={({ item }) => (
        <View style={styles.logRow}>
          <Text style={styles.logTime}>{`${formatLogTime(item.time)}  ${item.tag}`}</Text>
          <Text style={[styles.logText, { color: levelColors[item.level] || colors.text }]}>{item.message}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { margin: 12, marginBottom: 0, padding: 12, borderRadius: 14, backgroundColor: colors.card },
  infoRow: { flexDirection: 'row', paddingVertical: 4, gap: 12 },
  infoLabel: { width: 130, color: colors.muted, fontWeight: '500' },
  infoValue: { flex: 1, color: colors.text, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginHorizontal: 12, marginTop: 12 },
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12 },
  buttonText: { color: '#FFF', fontWeight: '700' },
  testRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  testName: { fontWeight: '700', color: colors.text },
  testDetail: { color: colors.muted, fontSize: 12, marginTop: 2 },
  section: { marginHorizontal: 16, marginTop: 16, marginBottom: 6, fontWeight: '700', color: colors.text },
  empty: { textAlign: 'center', color: colors.muted, padding: 24 },
  logRow: { marginHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  logTime: { fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' },
  logText: { fontSize: 12, fontFamily: 'monospace' },
});
