import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { api, apiJson } from '../api/server';
import { useApp } from '../state/AppState';
import { colors, getState } from '../state/status';
import TrackMap from '../map/TrackMap';
import { Button, Card, Chips, Empty, Field, ui } from '../components/ui';

const radii = [100, 300, 500, 1000, 2000].map((r) => ({ value: r, label: r < 1000 ? `${r} m` : `${r / 1000} km` }));

// Traccar areas are WKT with "lat lon" order: CIRCLE (lat lon, r) or POLYGON ((lat lon, ...)).
function areaToRing(area) {
  const circle = /CIRCLE\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*,\s*([\d.]+)\s*\)/i.exec(area || '');
  if (circle) {
    const [lat, lon, radius] = circle.slice(1).map(Number);
    const ring = [];
    for (let i = 0; i <= 64; i += 1) {
      const angle = (i / 64) * 2 * Math.PI;
      const dLat = (radius / 111320) * Math.cos(angle);
      const dLon = (radius / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
      ring.push([lon + dLon, lat + dLat]);
    }
    return ring;
  }
  const polygon = /POLYGON\s*\(\(\s*([^)]+)\)\)/i.exec(area || '');
  if (polygon) {
    const ring = polygon[1].split(',').map((pair) => {
      const [lat, lon] = pair.trim().split(/\s+/).map(Number);
      return [lon, lat];
    });
    if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) ring.push(ring[0]);
    return ring;
  }
  return null;
}

const bounds = (rings) => {
  const points = rings.flat();
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
};

export default function Geofences() {
  const { devices, positions, selectedId } = useApp();
  const cameraRef = useRef(null);
  const [geofences, setGeofences] = useState([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [deviceId, setDeviceId] = useState(selectedId || Number(Object.keys(positions)[0]) || null);
  const [radius, setRadius] = useState(300);
  const [saving, setSaving] = useState(false);

  const load = () => api('api/geofences').then(setGeofences).catch((error) => Alert.alert('Geofences', String(error.message || error)));
  useEffect(() => {
    load();
  }, []);

  const shapes = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: geofences
        .map((g) => ({ g, ring: areaToRing(g.area) }))
        .filter((it) => it.ring)
        .map(({ g, ring }) => ({ type: 'Feature', properties: { id: g.id }, geometry: { type: 'Polygon', coordinates: [ring] } })),
    }),
    [geofences],
  );

  const cars = Object.values(devices)
    .filter((d) => positions[d.id])
    .map((d) => ({ id: d.id, latitude: positions[d.id].latitude, longitude: positions[d.id].longitude, course: positions[d.id].course, state: getState(d, positions[d.id]) }));
  const start = positions[deviceId] || Object.values(positions)[0];

  const focus = (geofence) => {
    const ring = areaToRing(geofence.area);
    if (ring) cameraRef.current?.fitBounds(bounds([ring]), { padding: { top: 40, right: 40, bottom: 40, left: 40 }, duration: 500 });
  };

  const create = async () => {
    const position = positions[deviceId];
    if (!position) {
      Alert.alert('Geofence', 'Choose a vehicle with a known location.');
      return;
    }
    setSaving(true);
    try {
      const geofence = await apiJson('api/geofences', 'POST', {
        name: name.trim() || `${devices[deviceId]?.name || 'Vehicle'} area`,
        area: `CIRCLE (${position.latitude.toFixed(6)} ${position.longitude.toFixed(6)}, ${radius})`,
      });
      await apiJson('api/permissions', 'POST', { deviceId, geofenceId: geofence.id });
      setAdding(false);
      setName('');
      await load();
      focus(geofence);
      Alert.alert('Geofence added', 'Turn on "Geofence enter / exit" in SMS & WhatsApp alerts to be notified.');
    } catch (error) {
      Alert.alert('Save failed', String(error.message || error));
    } finally {
      setSaving(false);
    }
  };

  const remove = (geofence) =>
    Alert.alert('Delete geofence', `Delete "${geofence.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => apiJson(`api/geofences/${geofence.id}`, 'DELETE').then(load).catch((e) => Alert.alert('Delete failed', String(e.message || e))),
      },
    ]);

  return (
    <View style={ui.screen}>
      <TrackMap
        ref={cameraRef}
        style={{ height: '40%' }}
        cars={cars}
        initialViewState={start ? { center: [start.longitude, start.latitude], zoom: 14 } : { center: [69.3451, 30.3753], zoom: 4.5 }}
      >
        <GeoJSONSource id="geofences" data={shapes}>
          <Layer id="geofence-fill" type="fill" paint={{ 'fill-color': '#007080', 'fill-opacity': 0.18 }} />
          <Layer id="geofence-line" type="line" paint={{ 'line-color': '#007080', 'line-width': 2 }} />
        </GeoJSONSource>
      </TrackMap>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        {adding ? (
          <Card title="New circle geofence" subtitle="Centered on the vehicle's current location.">
            <Field label="Name" value={name} onChangeText={setName} placeholder="Home, Office, …" />
            <Text style={[ui.label, { marginTop: 12 }]}>Vehicle</Text>
            <Chips
              options={Object.values(devices).filter((d) => positions[d.id]).map((d) => ({ value: d.id, label: d.name }))}
              value={deviceId}
              onChange={setDeviceId}
            />
            <Text style={[ui.label, { marginTop: 12 }]}>Radius</Text>
            <Chips options={radii} value={radius} onChange={setRadius} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Button title="Cancel" outline color={colors.muted} style={{ flex: 1 }} onPress={() => setAdding(false)} />
              <Button title="Save" icon="check" style={{ flex: 1 }} loading={saving} onPress={create} />
            </View>
          </Card>
        ) : (
          <Button title="Add geofence at vehicle" icon="add-location-alt" onPress={() => setAdding(true)} />
        )}
        <Card>
          {geofences.length === 0 && <Empty text="No geofences yet" />}
          {geofences.map((g) => (
            <Pressable key={g.id} style={ui.row} onPress={() => focus(g)}>
              <MaterialIcons name="fence" size={24} color={colors.teal} />
              <View style={{ flex: 1 }}>
                <Text style={ui.rowTitle}>{g.name}</Text>
                <Text style={ui.rowSub}>{/CIRCLE/i.test(g.area) ? `Circle ${Math.round(Number(/,\s*([\d.]+)\s*\)/.exec(g.area)?.[1] || 0))} m` : 'Polygon'}</Text>
              </View>
              <Pressable onPress={() => remove(g)} hitSlop={10}>
                <MaterialIcons name="delete-outline" size={22} color={colors.offline} />
              </Pressable>
            </Pressable>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
