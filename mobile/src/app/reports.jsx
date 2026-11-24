import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../api/server';
import { useApp } from '../state/AppState';
import { colors, duration, formatDateTime, kmh } from '../state/status';
import { Button, Card, Chips, Empty, ui, useContentStyle } from '../components/ui';

const periods = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
];

const range = (period) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  if (period === 'yesterday') {
    end.setTime(start.getTime() - 1);
    start.setDate(start.getDate() - 1);
  } else if (period === 'week') start.setDate(start.getDate() - 6);
  else if (period === 'month') start.setDate(start.getDate() - 29);
  return { from: start.toISOString(), to: end.toISOString() };
};

const km = (meters) => `${((meters || 0) / 1000).toFixed(1)} km`;

export default function Reports() {
  const contentStyle = useContentStyle();
  const { devices, selectedId } = useApp();
  const list = Object.values(devices).sort((a, b) => a.name.localeCompare(b.name));
  const [deviceId, setDeviceId] = useState(selectedId || list[0]?.id);
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!deviceId) return;
    const { from, to } = range(period);
    const query = `deviceId=${deviceId}&from=${from}&to=${to}`;
    setData(null);
    setError(null);
    Promise.all([api(`api/reports/summary?${query}`), api(`api/reports/trips?${query}`), api(`api/reports/stops?${query}`)])
      .then(([summary, trips, stops]) => setData({ summary: summary[0] || {}, trips, stops }))
      .catch((e) => setError(String(e.message || e)));
  }, [deviceId, period]);

  const driving = data ? data.trips.reduce((t, trip) => t + trip.duration, 0) : 0;
  const parked = data ? data.stops.reduce((t, stop) => t + stop.duration, 0) : 0;
  const tiles = data
    ? [
        ['route', 'Distance', km(data.summary.distance), colors.static],
        ['directions-car', 'Driving', duration(driving) || '0m', colors.moving],
        ['local-parking', 'Parked', duration(parked) || '0m', colors.muted],
        ['speed', 'Max speed', `${kmh(data.summary.maxSpeed)} km/h`, colors.amber],
        ['timeline', 'Avg speed', `${kmh(data.summary.averageSpeed)} km/h`, colors.teal],
        ['flag', 'Trips', String(data.trips.length), colors.text],
      ]
    : [];

  return (
    <ScrollView style={ui.screen} contentContainerStyle={contentStyle}>
      <Card>
        <Text style={ui.label}>Vehicle</Text>
        <Chips options={list.map((d) => ({ value: d.id, label: d.name }))} value={deviceId} onChange={setDeviceId} />
        <Text style={[ui.label, { marginTop: 12 }]}>Period</Text>
        <Chips options={periods} value={period} onChange={setPeriod} />
      </Card>
      {error && <Card title="Could not load report" subtitle={error} />}
      {!data && !error && <ActivityIndicator color={colors.teal} style={{ marginTop: 20 }} />}
      {data && (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {tiles.map(([icon, label, value, color]) => (
              <View key={label} style={[ui.card, { width: '31%', flexGrow: 1, alignItems: 'center', paddingVertical: 12 }]}>
                <MaterialIcons name={icon} size={22} color={color} />
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 4 }}>{value}</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
              </View>
            ))}
          </View>
          <Button title="Open playback" icon="history" outline onPress={() => router.push(`/device/${deviceId}/playback`)} />
          <Card title={`Trips (${data.trips.length})`}>
            {data.trips.length === 0 && <Empty text="No trips in this period" />}
            {data.trips.map((trip) => (
              <View key={`${trip.startTime}`} style={ui.row}>
                <MaterialIcons name="directions-car" size={22} color={colors.moving} />
                <View style={{ flex: 1 }}>
                  <Text style={ui.rowTitle}>{`${formatDateTime(trip.startTime, false)} → ${formatDateTime(trip.endTime, false).slice(11)}`}</Text>
                  <Text style={ui.rowSub}>{`${km(trip.distance)} • ${duration(trip.duration)} • max ${kmh(trip.maxSpeed)} km/h`}</Text>
                  {trip.startAddress || trip.endAddress ? (
                    <Text style={ui.rowSub} numberOfLines={2}>{`${trip.startAddress || ''} → ${trip.endAddress || ''}`}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
          <Card title={`Stops (${data.stops.length})`}>
            {data.stops.length === 0 && <Empty text="No stops in this period" />}
            {data.stops.map((stop) => (
              <View key={`${stop.startTime}`} style={ui.row}>
                <MaterialIcons name="local-parking" size={22} color={colors.static} />
                <View style={{ flex: 1 }}>
                  <Text style={ui.rowTitle}>{`${formatDateTime(stop.startTime, false)} • ${duration(stop.duration)}`}</Text>
                  {stop.address ? <Text style={ui.rowSub} numberOfLines={2}>{stop.address}</Text> : null}
                </View>
              </View>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}
