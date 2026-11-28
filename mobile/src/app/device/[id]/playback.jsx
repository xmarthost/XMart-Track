import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../../../api/server';
import { colors, duration, formatDateTime, kmh } from '../../../state/status';
import TrackMap from '../../../map/TrackMap';
import { useApp } from '../../../state/AppState';
import { vehicleIcon } from '../../../state/vehicleLook';

const speeds = { Slow: 500, Medium: 200, Fast: 60 };
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Playback() {
  const { id, day: dayParam } = useLocalSearchParams();
  const deviceId = Number(id);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(Date.now() - i * 864e5)), []);
  // opened from a trip card: that day
  const [day, setDay] = useState(typeof dayParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : dayKey(days[0]));
  const [route, setRoute] = useState([]);
  const [segments, setSegments] = useState([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState('Medium');
  const [trackWidth, setTrackWidth] = useState(0);
  const cameraRef = useRef(null);
  const { positions: livePositions, devices } = useApp();
  const last = livePositions[deviceId];

  useEffect(() => {
    const from = new Date(`${day}T00:00:00`);
    const to = new Date(from.getTime() + 864e5 - 1);
    const query = `deviceId=${deviceId}&from=${from.toISOString()}&to=${to.toISOString()}`;
    setPlaying(false);
    setIndex(0);
    Promise.all([api(`api/reports/route?${query}`), api(`api/reports/trips?${query}`), api(`api/reports/stops?${query}`)])
      .then(([positions, trips, stops]) => {
        setRoute(positions);
        setSegments(
          [...trips.map((t) => ({ ...t, kind: 'trip' })), ...stops.map((s) => ({ ...s, kind: 'stop' }))].sort(
            (a, b) => new Date(a.startTime) - new Date(b.startTime),
          ),
        );
        if (positions.length > 1) {
          const lngs = positions.map((p) => p.longitude);
          const lats = positions.map((p) => p.latitude);
          setTimeout(
            () =>
              cameraRef.current?.fitBounds(
                [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
                { padding: { top: 40, right: 40, bottom: 40, left: 40 }, duration: 600 },
              ),
            300,
          );
        }
      })
      .catch(() => {
        setRoute([]);
        setSegments([]);
      });
  }, [deviceId, day]);

  // playback steps through the vehicle's movements only: points where it stood still are skipped
  const frames = useMemo(() => {
    const moving = route.filter((p) => p.speed > 1.5 || p.attributes?.motion === true);
    return moving.length > 1 ? moving : route;
  }, [route]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => {
      setIndex((current) => {
        if (current >= frames.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, speeds[speed]);
    return () => clearInterval(timer);
  }, [playing, speed, frames.length]);

  const current = frames[index];
  const totals = segments.reduce(
    (t, s) =>
      s.kind === 'trip'
        ? { ...t, driving: t.driving + s.duration, distance: t.distance + s.distance, max: Math.max(t.max, s.maxSpeed) }
        : { ...t, parking: t.parking + s.duration },
    { driving: 0, distance: 0, max: 0, parking: 0 },
  );
  const progress = frames.length > 1 ? index / (frames.length - 1) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TrackMap
        ref={cameraRef}
        style={{ height: '42%' }}
        initialViewState={last ? { center: [last.longitude, last.latitude], zoom: 14 } : { center: [69.3451, 30.3753], zoom: 4.5 }}
        trail={route.length > 1 ? route : null}
        smooth={false}
        cars={
          current
            ? [{ id: deviceId, latitude: current.latitude, longitude: current.longitude, course: current.course, state: 'moving', icon: vehicleIcon(devices[deviceId], 'moving').key }]
            : []
        }
      />
      <View style={styles.panel}>
        <View style={styles.row}>
          <Text style={styles.muted}>{current ? formatDateTime(current.fixTime) : '--'}</Text>
          <Text style={styles.muted}>{current ? `${kmh(current.speed)} km/h` : ''}</Text>
        </View>
        <View style={styles.controls}>
          <Pressable
            style={styles.play}
            onPress={() => {
              if (index >= frames.length - 1) setIndex(0);
              setPlaying(!playing);
            }}
            disabled={frames.length < 2}
          >
            <MaterialIcons name={playing ? 'pause' : 'play-arrow'} size={28} color="#FFF" />
          </Pressable>
          <Pressable
            style={styles.track}
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
            onPress={(e) => {
              const ratio = Math.min(Math.max(e.nativeEvent.locationX / (trackWidth || 1), 0), 1);
              if (frames.length > 1) setIndex(Math.round(ratio * (frames.length - 1)));
            }}
          >
            <View style={styles.trackBar}>
              <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
            </View>
          </Pressable>
          <Pressable
            style={styles.speed}
            onPress={() => setSpeed(speed === 'Slow' ? 'Medium' : speed === 'Medium' ? 'Fast' : 'Slow')}
          >
            <Text style={styles.speedText}>{speed}</Text>
          </Pressable>
        </View>
        <FlatList
          horizontal
          data={days}
          keyExtractor={(d) => dayKey(d)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
          renderItem={({ item }) => {
            const key = dayKey(item);
            const active = key === day;
            return (
              <Pressable style={[styles.day, active && styles.dayActive]} onPress={() => setDay(key)}>
                <Text style={[styles.dayName, active && { color: '#FFF' }]}>
                  {item.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={[styles.dayDate, active && { color: '#FFF' }]}>{key.slice(5)}</Text>
              </Pressable>
            );
          }}
        />
        <View style={styles.summary}>
          {[
            ['directions-car', duration(totals.driving), colors.moving],
            ['route', `${(totals.distance / 1000).toFixed(1)} km`, colors.static],
            ['speed', `${kmh(totals.max)} km/h`, colors.amber],
            ['local-parking', duration(totals.parking), colors.static],
          ].map(([icon, text, color]) => (
            <View key={icon} style={styles.summaryItem}>
              <MaterialIcons name={icon} size={20} color={color} />
              <Text style={styles.summaryText}>{text || '0m'}</Text>
            </View>
          ))}
        </View>
      </View>
      <FlatList
        data={segments}
        keyExtractor={(s) => `${s.kind}-${s.startTime}`}
        ListEmptyComponent={<Text style={[styles.muted, { textAlign: 'center', padding: 24 }]}>No trips this day</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.segment}
            onPress={() => {
              const target = new Date(item.startTime).getTime();
              const found = frames.findIndex((p) => new Date(p.fixTime).getTime() >= target);
              setIndex(found >= 0 ? found : 0);
            }}
          >
            <View style={[styles.segmentIcon, { backgroundColor: item.kind === 'trip' ? colors.moving : colors.static }]}>
              <MaterialIcons name={item.kind === 'trip' ? 'directions-car' : 'local-parking'} size={20} color="#FFF" />
            </View>
            <Text style={styles.segmentTime}>{formatDateTime(item.startTime, false).slice(11)}</Text>
            <Text style={styles.segmentText} numberOfLines={1}>
              {duration(item.duration)}
              {item.kind === 'trip' ? ` • ${(item.distance / 1000).toFixed(1)} km • ${kmh(item.maxSpeed)} km/h` : ' parked'}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.card, paddingHorizontal: 16, paddingTop: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16, marginTop: -12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  muted: { color: colors.muted, fontWeight: '500' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  play: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 22, justifyContent: 'center' },
  trackBar: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  trackFill: { height: 8, backgroundColor: colors.teal },
  speed: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
  speedText: { fontWeight: '700', color: colors.text },
  day: { width: 58, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  dayActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  dayName: { fontSize: 12, color: colors.muted },
  dayDate: { fontSize: 14, fontWeight: '700', color: colors.text },
  summary: { flexDirection: 'row', borderWidth: 1, borderColor: colors.teal, borderRadius: 12, paddingVertical: 10, marginBottom: 10 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryText: { fontWeight: '700', color: colors.text },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.background },
  segmentIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  segmentTime: { fontWeight: '700', color: colors.text, width: 48 },
  segmentText: { flex: 1, color: colors.muted, fontWeight: '500' },
});
