import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../api/server';
import { useApp } from '../state/AppState';
import { colors, getState, kmh, since } from '../state/status';
import { Card, ui, useContentStyle } from '../components/ui';

export default function Overview() {
  const contentStyle = useContentStyle();
  const { devices, positions, setSelectedId } = useApp();
  const list = Object.values(devices).sort((a, b) => a.name.localeCompare(b.name));
  const [today, setToday] = useState({});

  useEffect(() => {
    if (!list.length) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const ids = list.map((d) => `deviceId=${d.id}`).join('&');
    api(`api/reports/summary?${ids}&from=${start.toISOString()}&to=${new Date().toISOString()}`)
      .then((rows) => setToday(Object.fromEntries(rows.map((r) => [r.deviceId, r]))))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  const counts = { moving: 0, static: 0, offline: 0, inactive: 0 };
  list.forEach((d) => {
    counts[getState(d, positions[d.id])] += 1;
  });
  const totalKm = Object.values(today).reduce((t, r) => t + (r.distance || 0), 0) / 1000;

  const tiles = [
    ['Total', list.length, colors.text, 'directions-car'],
    ['Moving', counts.moving, colors.moving, 'speed'],
    ['Parked', counts.static, colors.static, 'local-parking'],
    ['Offline', counts.offline + counts.inactive, colors.offline, 'cloud-off'],
  ];

  return (
    <ScrollView style={ui.screen} contentContainerStyle={contentStyle}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {tiles.map(([label, value, color, icon]) => (
          <View key={label} style={[ui.card, { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4 }]}>
            <MaterialIcons name={icon} size={22} color={color} />
            <Text style={{ fontSize: 22, fontWeight: '800', color }}>{value}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
          </View>
        ))}
      </View>
      <Card title="Today" subtitle={`${totalKm.toFixed(1)} km driven by all vehicles`}>
        {list.map((d) => {
          const position = positions[d.id];
          const state = getState(d, position);
          const row = today[d.id];
          return (
            <Pressable
              key={d.id}
              style={ui.row}
              onPress={() => {
                setSelectedId(d.id);
                router.navigate('/(tabs)');
              }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors[state] }} />
              <View style={{ flex: 1 }}>
                <Text style={ui.rowTitle}>{d.name}</Text>
                <Text style={ui.rowSub}>
                  {state === 'moving' ? `Moving ${kmh(position?.speed)} km/h` : `${state} • updated ${since(d.lastUpdate)} ago`}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={ui.rowTitle}>{`${((row?.distance || 0) / 1000).toFixed(1)} km`}</Text>
                <Text style={ui.rowSub}>{`max ${kmh(row?.maxSpeed)} km/h`}</Text>
              </View>
            </Pressable>
          );
        })}
      </Card>
    </ScrollView>
  );
}
