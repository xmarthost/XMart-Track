import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api, apiJson } from '../api/server';
import { useApp } from '../state/AppState';
import { colors, getState } from '../state/status';
import {
  DAYS,
  buildCalendar,
  defaultSchedule,
  describeSchedule,
  isExpired,
  toBase64,
} from '../state/geofenceSchedule';
import TrackMap from '../map/TrackMap';
import { Button, Card, Chips, Empty, Field, SwitchRow, ui } from '../components/ui';

const RED = '#DC2626';
const radii = [100, 200, 500, 1000, 3000].map((r) => ({ value: r, label: r < 1000 ? `${r} m` : `${r / 1000} km` }));
const modes = [
  { value: 'always', label: 'Always' },
  { value: 'once', label: 'One time' },
  { value: 'daily', label: 'Daily' },
  { value: 'days', label: 'Chosen days' },
];
const WHATSAPP = 'xmwhatsapp';
const PUSH = 'firebase';

// Traccar areas are WKT with "lat lon" order: CIRCLE (lat lon, r) or POLYGON ((lat lon, ...)).
function parseArea(area) {
  const circle = /CIRCLE\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*,\s*([\d.]+)\s*\)/i.exec(area || '');
  if (circle) {
    const [lat, lon, radius] = circle.slice(1).map(Number);
    return { type: 'circle', center: [lon, lat], radius };
  }
  const polygon = /POLYGON\s*\(\(\s*([^)]+)\)\)/i.exec(area || '');
  if (polygon) {
    const points = polygon[1].split(',').map((pair) => {
      const [lat, lon] = pair.trim().split(/\s+/).map(Number);
      return [lon, lat];
    });
    const last = points[points.length - 1];
    if (points.length > 3 && last[0] === points[0][0] && last[1] === points[0][1]) points.pop();
    return { type: 'polygon', points };
  }
  return null;
}

const circleRing = ([lon, lat], radius) => {
  const ring = [];
  for (let i = 0; i <= 64; i += 1) {
    const angle = (i / 64) * 2 * Math.PI;
    ring.push([
      lon + (radius / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle),
      lat + (radius / 111320) * Math.cos(angle),
    ]);
  }
  return ring;
};

const shapeRing = (shape) => {
  if (!shape) return null;
  if (shape.type === 'circle') return shape.center ? circleRing(shape.center, shape.radius) : null;
  return shape.points.length >= 3 ? [...shape.points, shape.points[0]] : null;
};

const toWkt = (shape) =>
  shape.type === 'circle'
    ? `CIRCLE (${shape.center[1].toFixed(6)} ${shape.center[0].toFixed(6)}, ${Math.round(shape.radius)})`
    : `POLYGON ((${[...shape.points, shape.points[0]].map(([lon, lat]) => `${lat.toFixed(6)} ${lon.toFixed(6)}`).join(', ')}))`;

const bounds = (points) => {
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
};

const scheduleOf = (g) => {
  try {
    return g.attributes?.xmSchedule ? JSON.parse(g.attributes.xmSchedule) : null;
  } catch {
    return null;
  }
};

export default function Geofences() {
  const { devices, positions, selectedId } = useApp();
  const params = useLocalSearchParams();
  const cameraRef = useRef(null);
  const [geofences, setGeofences] = useState([]);
  const [links, setLinks] = useState({}); // geofenceId -> [deviceId]
  const [choosingType, setChoosingType] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [alerts, setAlerts] = useState({ enter: false, exit: false });
  const [notifications, setNotifications] = useState([]);
  const [notificators, setNotificators] = useState([]);

  const preferredDevice = Number(params.deviceId) || selectedId || Number(Object.keys(positions)[0]) || null;
  const deviceList = Object.values(devices).sort((a, b) => a.name.localeCompare(b.name));

  // reload only when the list of vehicles changes (not on every live position refresh)
  const deviceKey = Object.keys(devices).sort().join(',');
  const load = useCallback(async () => {
    try {
      const [items, notificationItems, notificatorItems] = await Promise.all([
        api('api/geofences'),
        api('api/notifications'),
        api('api/notifications/notificators'),
      ]);
      setGeofences(items);
      setNotifications(notificationItems);
      setNotificators(notificatorItems.map((n) => n.type));
      setAlerts({
        enter: notificationItems.some((n) => n.type === 'geofenceEnter'),
        exit: notificationItems.some((n) => n.type === 'geofenceExit'),
      });
      const map = {};
      await Promise.all(
        deviceKey.split(',').filter(Boolean).map(async (id) => {
          const linked = await api(`api/geofences?deviceId=${id}`).catch(() => []);
          linked.forEach((g) => {
            map[g.id] = [...(map[g.id] || []), Number(id)];
          });
        }),
      );
      setLinks(map);
    } catch (error) {
      Alert.alert('Geofences', String(error.message || error));
    }
  }, [deviceKey]);

  useEffect(() => {
    load();
  }, [load]);

  const start = positions[preferredDevice] || Object.values(positions)[0];
  const cars = Object.values(devices)
    .filter((d) => positions[d.id])
    .map((d) => ({
      id: d.id,
      latitude: positions[d.id].latitude,
      longitude: positions[d.id].longitude,
      course: positions[d.id].course,
      state: getState(d, positions[d.id]),
    }));

  const saved = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: geofences
        .filter((g) => !draft || g.id !== draft.id)
        .map((g) => ({ g, ring: shapeRing(parseArea(g.area)) }))
        .filter((it) => it.ring)
        .map(({ g, ring }) => ({
          type: 'Feature',
          properties: { id: g.id, paused: g.attributes?.xmPaused ? 1 : 0 },
          geometry: { type: 'Polygon', coordinates: [ring] },
        })),
    }),
    [geofences, draft],
  );

  const draftRing = draft ? shapeRing(draft.shape) : null;
  const draftShape = {
    type: 'FeatureCollection',
    features: draftRing ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [draftRing] } }] : [],
  };
  const draftPoints = {
    type: 'FeatureCollection',
    features: draft
      ? (draft.shape.type === 'circle' ? (draft.shape.center ? [draft.shape.center] : []) : draft.shape.points).map((p, i) => ({
          type: 'Feature',
          properties: { i },
          geometry: { type: 'Point', coordinates: p },
        }))
      : [],
  };

  const fit = (points) => {
    if (points?.length) {
      cameraRef.current?.fitBounds(bounds(points), { padding: { top: 50, right: 50, bottom: 50, left: 50 }, duration: 500 });
    }
  };

  const newDraft = (type) => {
    setChoosingType(false);
    const center = start ? [start.longitude, start.latitude] : null;
    setDraft({
      id: null,
      name: '',
      shape: type === 'circle' ? { type, center, radius: 200 } : { type, points: [] },
      deviceIds: preferredDevice ? [preferredDevice] : [],
      schedule: defaultSchedule(),
      calendarId: 0,
    });
    if (center) cameraRef.current?.easeTo({ center, zoom: 15, duration: 400 });
  };

  const editDraft = (g) => {
    const shape = parseArea(g.area);
    if (!shape) return;
    setDraft({
      id: g.id,
      name: g.name,
      shape,
      deviceIds: g.attributes?.xmPaused ? JSON.parse(g.attributes.xmDevices || '[]') : links[g.id] || [],
      schedule: { ...defaultSchedule(), ...(scheduleOf(g) || {}) },
      calendarId: g.calendarId || 0,
      original: g,
    });
    fit(shapeRing(shape));
  };

  const onMapPress = (event) => {
    if (!draft) return;
    const lngLat = event.nativeEvent?.lngLat;
    if (!lngLat) return;
    const point = [lngLat[0], lngLat[1]];
    setDraft((d) =>
      d.shape.type === 'circle'
        ? { ...d, shape: { ...d.shape, center: point } }
        : { ...d, shape: { ...d.shape, points: [...d.shape.points, point] } },
    );
  };

  const setSchedule = (patch) => setDraft((d) => ({ ...d, schedule: { ...d.schedule, ...patch } }));
  const toggleDevice = (id) =>
    setDraft((d) => ({
      ...d,
      deviceIds: d.deviceIds.includes(id) ? d.deviceIds.filter((x) => x !== id) : [...d.deviceIds, id],
    }));
  const toggleDay = (day) =>
    setSchedule({
      days: draft.schedule.days.includes(day)
        ? draft.schedule.days.filter((d) => d !== day)
        : [...draft.schedule.days, day],
    });

  // geofence enter / exit alerts are account-wide notification types (they cover every geofence)
  const syncAlerts = async () => {
    const wanted = ['web'];
    if (notificators.includes(WHATSAPP)) wanted.push(WHATSAPP);
    if (notificators.includes(PUSH)) wanted.push(PUSH);
    for (const [type, on] of [
      ['geofenceEnter', alerts.enter],
      ['geofenceExit', alerts.exit],
    ]) {
      const existing = notifications.find((n) => n.type === type);
      if (on && !existing) {
        await apiJson('api/notifications', 'POST', {
          type,
          always: true,
          notificators: wanted.join(','),
          attributes: { xmSms: true },
        });
      } else if (!on && existing && existing.attributes?.xmSms) {
        await apiJson(`api/notifications/${existing.id}`, 'DELETE');
      }
    }
  };

  const linkDevices = async (geofenceId, wanted, current) => {
    for (const deviceId of wanted.filter((id) => !current.includes(id))) {
      await apiJson('api/permissions', 'POST', { deviceId, geofenceId });
    }
    for (const deviceId of current.filter((id) => !wanted.includes(id))) {
      await apiJson('api/permissions', 'DELETE', { deviceId, geofenceId });
    }
  };

  const save = async () => {
    const { shape, schedule } = draft;
    if (shape.type === 'circle' && !shape.center) {
      Alert.alert('Geofence', 'Tap the map to place the circle.');
      return;
    }
    if (shape.type === 'polygon' && shape.points.length < 3) {
      Alert.alert('Geofence', 'Tap at least 3 points on the map for the area.');
      return;
    }
    if (!draft.deviceIds.length) {
      Alert.alert('Geofence', 'Choose at least one vehicle.');
      return;
    }
    const name = draft.name.trim() || `${devices[draft.deviceIds[0]]?.name || 'Vehicle'} area`;
    const { ical, error } = buildCalendar(schedule, name);
    if (error) {
      Alert.alert('Schedule', error);
      return;
    }
    setSaving(true);
    try {
      // schedule -> Traccar calendar (none for "always")
      let calendarId = draft.calendarId || 0;
      if (ical) {
        const body = { name: `Geofence: ${name}`, data: toBase64(ical), attributes: {} };
        calendarId = calendarId
          ? (await apiJson(`api/calendars/${calendarId}`, 'PUT', { ...body, id: calendarId })).id
          : (await apiJson('api/calendars', 'POST', body)).id;
      } else if (calendarId) {
        await apiJson(`api/calendars/${calendarId}`, 'DELETE').catch(() => {});
        calendarId = 0;
      }
      const original = draft.original || {};
      const paused = Boolean(original.attributes?.xmPaused);
      const attributes = { ...(original.attributes || {}), xmSchedule: JSON.stringify(schedule) };
      if (paused) attributes.xmDevices = JSON.stringify(draft.deviceIds);
      const body = { ...original, name, area: toWkt(shape), calendarId, attributes };
      const geofence = draft.id
        ? await apiJson(`api/geofences/${draft.id}`, 'PUT', { ...body, id: draft.id })
        : await apiJson('api/geofences', 'POST', body);
      if (!paused) await linkDevices(geofence.id, draft.deviceIds, draft.id ? links[draft.id] || [] : []);
      await syncAlerts();
      setDraft(null);
      await load();
      fit(shapeRing(shape));
    } catch (e) {
      Alert.alert('Save failed', String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  // pause = unlink the vehicles (kept in the geofence) so it stops working until resumed
  const togglePause = async (g) => {
    try {
      const paused = Boolean(g.attributes?.xmPaused);
      const attributes = { ...(g.attributes || {}) };
      if (paused) {
        const ids = JSON.parse(attributes.xmDevices || '[]');
        delete attributes.xmPaused;
        delete attributes.xmDevices;
        await apiJson(`api/geofences/${g.id}`, 'PUT', { ...g, attributes });
        await linkDevices(g.id, ids, []);
      } else {
        const ids = links[g.id] || [];
        attributes.xmPaused = true;
        attributes.xmDevices = JSON.stringify(ids);
        await apiJson(`api/geofences/${g.id}`, 'PUT', { ...g, attributes });
        await linkDevices(g.id, [], ids);
      }
      await load();
    } catch (e) {
      Alert.alert('Geofence', String(e.message || e));
    }
  };

  const remove = (g) =>
    Alert.alert('Delete geofence', `Delete "${g.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiJson(`api/geofences/${g.id}`, 'DELETE');
            if (g.calendarId) await apiJson(`api/calendars/${g.calendarId}`, 'DELETE').catch(() => {});
            await load();
          } catch (e) {
            Alert.alert('Delete failed', String(e.message || e));
          }
        },
      },
    ]);

  const statusOf = (g) => {
    if (g.attributes?.xmPaused) return { text: 'Paused', color: colors.inactive };
    if (isExpired(scheduleOf(g))) return { text: 'Expired', color: colors.amber };
    if (!(links[g.id] || []).length) return { text: 'No vehicle', color: colors.amber };
    return { text: 'Active', color: colors.moving };
  };

  const s = draft?.schedule;

  return (
    <View style={ui.screen}>
      <TrackMap
        ref={cameraRef}
        style={{ height: draft ? '46%' : '40%' }}
        cars={cars}
        onPress={onMapPress}
        initialViewState={start ? { center: [start.longitude, start.latitude], zoom: 14 } : { center: [69.3451, 30.3753], zoom: 4.5 }}
      >
        <GeoJSONSource id="geofences" data={saved}>
          <Layer
            id="geofence-fill"
            type="fill"
            paint={{ 'fill-color': ['case', ['==', ['get', 'paused'], 1], '#94A3B8', RED], 'fill-opacity': 0.15 }}
          />
          <Layer
            id="geofence-line"
            type="line"
            paint={{ 'line-color': ['case', ['==', ['get', 'paused'], 1], '#94A3B8', RED], 'line-width': 2 }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="geofence-draft" data={draftShape}>
          <Layer id="draft-fill" type="fill" paint={{ 'fill-color': RED, 'fill-opacity': 0.25 }} />
          <Layer id="draft-line" type="line" paint={{ 'line-color': RED, 'line-width': 3, 'line-dasharray': [2, 1] }} />
        </GeoJSONSource>
        <GeoJSONSource id="geofence-draft-points" data={draftPoints}>
          <Layer
            id="draft-points"
            type="circle"
            paint={{ 'circle-radius': 7, 'circle-color': '#FFF', 'circle-stroke-color': RED, 'circle-stroke-width': 3 }}
          />
        </GeoJSONSource>
      </TrackMap>
      {draft && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>
            {draft.shape.type === 'circle'
              ? 'Tap the map to move the circle'
              : `Tap the map to add corners (${draft.shape.points.length} added)`}
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        {draft ? (
          <>
            <Card title={`${draft.id ? 'Edit' : 'New'} ${draft.shape.type === 'circle' ? 'circle' : 'polygon'} geofence`}>
              <Field label="Name" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} placeholder="Home, Office, School…" />
              {draft.shape.type === 'circle' ? (
                <>
                  <Text style={[ui.label, { marginTop: 12 }]}>Radius</Text>
                  <Chips
                    options={radii}
                    value={draft.shape.radius}
                    onChange={(radius) => setDraft({ ...draft, shape: { ...draft.shape, radius } })}
                  />
                  <Field
                    label="Or radius in meters"
                    value={String(draft.shape.radius)}
                    keyboardType="number-pad"
                    onChangeText={(v) =>
                      setDraft({ ...draft, shape: { ...draft.shape, radius: Math.max(20, Number(v.replace(/\D/g, '')) || 0) } })
                    }
                  />
                  {start && (
                    <Button
                      title="Center on the vehicle"
                      icon="my-location"
                      outline
                      style={{ marginTop: 10 }}
                      onPress={() => {
                        const p = positions[draft.deviceIds[0]] || start;
                        setDraft({ ...draft, shape: { ...draft.shape, center: [p.longitude, p.latitude] } });
                        cameraRef.current?.easeTo({ center: [p.longitude, p.latitude], zoom: 15, duration: 400 });
                      }}
                    />
                  )}
                </>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <Button
                    title="Undo point"
                    icon="undo"
                    outline
                    style={{ flex: 1 }}
                    disabled={!draft.shape.points.length}
                    onPress={() => setDraft({ ...draft, shape: { ...draft.shape, points: draft.shape.points.slice(0, -1) } })}
                  />
                  <Button
                    title="Clear"
                    icon="layers-clear"
                    outline
                    color={colors.offline}
                    style={{ flex: 1 }}
                    disabled={!draft.shape.points.length}
                    onPress={() => setDraft({ ...draft, shape: { ...draft.shape, points: [] } })}
                  />
                </View>
              )}
            </Card>

            <Card title="Vehicles" subtitle="The geofence works for the vehicles you select.">
              <Chips options={deviceList.map((d) => ({ value: d.id, label: d.name }))} value={draft.deviceIds} onChange={toggleDevice} />
            </Card>

            <Card title="Schedule" subtitle="When the geofence is active.">
              <Chips options={modes} value={s.mode} onChange={(mode) => setSchedule({ mode })} />
              {s.mode === 'always' && <Text style={ui.help}>Active all the time until you pause or delete it.</Text>}
              {s.mode === 'once' && (
                <>
                  <View style={styles.row2}>
                    <Field style={{ flex: 1 }} label="Start date" value={s.startDate} onChangeText={(startDate) => setSchedule({ startDate })} placeholder="2026-11-24" />
                    <Field style={{ width: 100 }} label="Time" value={s.startTime} onChangeText={(startTime) => setSchedule({ startTime })} placeholder="09:00" />
                  </View>
                  <View style={styles.row2}>
                    <Field style={{ flex: 1 }} label="End date" value={s.endDate} onChangeText={(endDate) => setSchedule({ endDate })} placeholder="2026-11-24" />
                    <Field style={{ width: 100 }} label="Time" value={s.endTime} onChangeText={(endTime) => setSchedule({ endTime })} placeholder="18:00" />
                  </View>
                  <Text style={ui.help}>Works only in this period, then expires by itself.</Text>
                </>
              )}
              {(s.mode === 'daily' || s.mode === 'days') && (
                <>
                  {s.mode === 'days' && (
                    <>
                      <Text style={[ui.label, { marginTop: 12 }]}>Days</Text>
                      <Chips options={DAYS} value={s.days} onChange={toggleDay} />
                    </>
                  )}
                  <View style={styles.row2}>
                    <Field style={{ flex: 1 }} label="From (24 h)" value={s.from} onChangeText={(from) => setSchedule({ from })} placeholder="22:00" />
                    <Field style={{ flex: 1 }} label="To (24 h)" value={s.to} onChangeText={(to) => setSchedule({ to })} placeholder="06:00" />
                  </View>
                  <Text style={ui.help}>A window like 22:00 → 06:00 runs through the night.</Text>
                  <Text style={[ui.label, { marginTop: 12 }]}>Ends</Text>
                  <Chips
                    options={[
                      { value: 'never', label: 'Never' },
                      { value: 'date', label: 'On a date' },
                    ]}
                    value={s.ends ? 'date' : 'never'}
                    onChange={(v) => setSchedule({ ends: v === 'date' ? s.ends || s.endDate : '' })}
                  />
                  {Boolean(s.ends) && (
                    <Field label="Last day" value={s.ends} onChangeText={(ends) => setSchedule({ ends })} placeholder="2026-12-31" />
                  )}
                </>
              )}
            </Card>

            <Card title="Alerts" subtitle="On the app and WhatsApp. These settings apply to all geofences.">
              <SwitchRow label="Vehicle enters a geofence" value={alerts.enter} onValueChange={(enter) => setAlerts({ ...alerts, enter })} />
              <SwitchRow label="Vehicle leaves a geofence" value={alerts.exit} onValueChange={(exit) => setAlerts({ ...alerts, exit })} />
            </Card>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Cancel" outline color={colors.muted} style={{ flex: 1 }} onPress={() => setDraft(null)} />
              <Button title="Save" icon="check" color={RED} style={{ flex: 1 }} loading={saving} onPress={save} />
            </View>
          </>
        ) : (
          <>
            <Button title="New geofence" icon="add-location-alt" color={RED} onPress={() => setChoosingType(true)} />
            <Card>
              {geofences.length === 0 && <Empty text="No geofences yet" />}
              {geofences.map((g) => {
                const shape = parseArea(g.area);
                const status = statusOf(g);
                const vehicleIds = g.attributes?.xmPaused ? JSON.parse(g.attributes.xmDevices || '[]') : links[g.id] || [];
                const names = vehicleIds.map((id) => devices[id]?.name).filter(Boolean).join(', ');
                return (
                  <Pressable key={g.id} style={ui.row} onPress={() => fit(shapeRing(shape))}>
                    <MaterialCommunityIcons
                      name={shape?.type === 'circle' ? 'circle-outline' : 'vector-polygon'}
                      size={26}
                      color={g.attributes?.xmPaused ? colors.inactive : RED}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[ui.rowTitle, { flexShrink: 1 }]} numberOfLines={1}>{g.name}</Text>
                        <Text style={[styles.badge, { color: status.color, backgroundColor: `${status.color}1A` }]}>{status.text}</Text>
                      </View>
                      <Text style={ui.rowSub}>
                        {shape?.type === 'circle' ? `Circle ${Math.round(shape.radius)} m` : `Polygon, ${shape?.points.length || 0} corners`}
                        {` • ${describeSchedule(scheduleOf(g))}`}
                      </Text>
                      <Text style={ui.rowSub} numberOfLines={2}>{names ? `🚗 ${names}` : 'No vehicle selected'}</Text>
                    </View>
                    <Pressable onPress={() => editDraft(g)} hitSlop={8} style={styles.icon}>
                      <MaterialIcons name="edit" size={21} color={colors.teal} />
                    </Pressable>
                    <Pressable onPress={() => togglePause(g)} hitSlop={8} style={styles.icon}>
                      <MaterialIcons name={g.attributes?.xmPaused ? 'play-circle-outline' : 'pause-circle-outline'} size={22} color={colors.muted} />
                    </Pressable>
                    <Pressable onPress={() => remove(g)} hitSlop={8} style={styles.icon}>
                      <MaterialIcons name="delete-outline" size={22} color={colors.offline} />
                    </Pressable>
                  </Pressable>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>

      <Modal transparent animationType="fade" visible={choosingType} onRequestClose={() => setChoosingType(false)}>
        <Pressable style={styles.backdrop} onPress={() => setChoosingType(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Choose geofence type</Text>
            {[
              {
                type: 'circle',
                icon: 'circle-outline',
                title: 'Circular',
                text: 'A circle around one point, e.g. home or office. Tap the map for the center and pick the radius.',
              },
              {
                type: 'polygon',
                icon: 'vector-polygon',
                title: 'Polygon',
                text: 'Any shape, e.g. a whole society, a city area or a route. Tap the map at each corner.',
              },
            ].map((option) => (
              <Pressable key={option.type} style={styles.option} onPress={() => newDraft(option.type)}>
                <View style={styles.optionIcon}>
                  <MaterialCommunityIcons name={option.icon} size={28} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionText}>{option.text}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,23,42,0.8)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  hintText: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  row2: { flexDirection: 'row', gap: 10 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  icon: { paddingHorizontal: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  optionText: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
});
