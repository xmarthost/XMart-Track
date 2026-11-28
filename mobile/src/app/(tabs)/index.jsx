import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../../state/AppState';
import { colors, getState, kmh, since } from '../../state/status';
import VehicleSheet from '../../components/VehicleSheet';
import MapButtons from '../../components/MapButtons';
import PullToRefresh from '../../components/PullToRefresh';
import TrackMap from '../../map/TrackMap';
import { moveDuration } from '../../map/smoothMotion';
import { findStyle, mapStyles } from '../../map/mapStyles';
import { chooseMapStyle, setTraffic, useMapState } from '../../map/mapState';
import { vehicleIcon } from '../../state/vehicleLook';
import { useLayout } from '../../state/theme';
import { DashboardHome, SimpleHome, SplitHome } from '../../components/HomeLayouts';

const tabs = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
  { key: 'unknown', label: 'Inactive' },
];
const STREET_ZOOM = 16;
const homeLabel = { classic: 'List', list: 'List', dashboard: 'Dashboard', split: 'Split', simple: 'Vehicles' };

export default function Monitor() {
  const { user, devices, positions, trails, selectedId, setSelectedId, refresh } = useApp();
  const layout = useLayout();
  // 'list' = the layout's home screen, 'map' = the full map; Classic opens on the map
  const [view, setView] = useState(layout === 'classic' ? 'map' : 'list');
  const [focusId, setFocusId] = useState(null);
  const [tab, setTab] = useState('all');
  const [keyword, setKeyword] = useState('');
  const { chosen: mapStyle, active: activeStyle, traffic } = useMapState();
  const [mapTypeOpen, setMapTypeOpen] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [areaHeight, setAreaHeight] = useState(0);
  const cameraRef = useRef(null);
  const lastCenteredRef = useRef(null);

  const list = useMemo(() => {
    const lower = keyword.toLowerCase();
    return Object.values(devices)
      .filter((d) => [d.name, d.uniqueId, d.phone].some((s) => s && s.toLowerCase().includes(lower)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [devices, keyword]);
  const counts = useMemo(() => {
    const result = { all: list.length, online: 0, offline: 0, unknown: 0 };
    list.forEach((d) => {
      result[d.status in result ? d.status : 'unknown'] += 1;
    });
    return result;
  }, [list]);
  const filtered = tab === 'all' ? list : list.filter((d) => d.status === tab);
  const withPositions = list.filter((d) => positions[d.id]);
  const selected = selectedId ? devices[selectedId] : null;
  const selectedPosition = selectedId ? positions[selectedId] : null;

  const initialViewState = useMemo(() => {
    const first = selectedPosition || (withPositions[0] && positions[withPositions[0].id]);
    return first
      ? { center: [first.longitude, first.latitude], zoom: 15.5 }
      : { center: [69.3451, 30.3753], zoom: 4.5 };
    // only the first render matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // keep the car in the middle of the part of the map that the bottom sheet does not cover
  const sheetPad = selected ? sheetHeight || Math.round(areaHeight * 0.5) : 0;
  const padding = { top: 0, right: 0, left: 0, bottom: sheetPad };

  const zoomUntilRef = useRef(0);

  const centerOn = (position) => {
    if (!position || !cameraRef.current) return;
    // a re-center for the sheet height may follow right away: it must keep this zoom
    zoomUntilRef.current = Date.now() + 1500;
    cameraRef.current.easeTo({
      center: [position.longitude, position.latitude],
      zoom: STREET_ZOOM,
      bearing: 0,
      pitch: 0,
      padding,
      duration: 500,
    });
  };

  // follow the selected vehicle as live positions arrive
  useEffect(() => {
    if (view !== 'map' || !selectedPosition || !cameraRef.current) return;
    const key = `${selectedId}:${selectedPosition.latitude}:${selectedPosition.longitude}`;
    if (lastCenteredRef.current === key) return;
    const first = !lastCenteredRef.current?.startsWith(`${selectedId}:`);
    lastCenteredRef.current = key;
    if (first) {
      centerOn(selectedPosition);
    } else {
      // glide with the car: same duration and linear speed as the car's own smooth movement
      cameraRef.current.easeTo({
        center: [selectedPosition.longitude, selectedPosition.latitude],
        bearing: 0,
        padding,
        duration: moveDuration(selectedId, selectedPosition.latitude, selectedPosition.longitude),
        easing: 'linear',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedPosition, view]);

  // the sheet's real height is known after it renders: re-center for it
  useEffect(() => {
    if (view !== 'map' || !selectedPosition || !cameraRef.current || !sheetHeight) return;
    cameraRef.current.easeTo({
      center: [selectedPosition.longitude, selectedPosition.latitude],
      ...(Date.now() < zoomUntilRef.current ? { zoom: STREET_ZOOM } : {}),
      bearing: 0,
      padding,
      duration: 400,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetHeight]);

  // a new layout chosen in Layout & theme: show its home screen (Classic: the map)
  const firstLayout = useRef(true);
  useEffect(() => {
    if (firstLayout.current) {
      firstLayout.current = false;
      return;
    }
    setView(layout === 'classic' ? 'map' : 'list');
  }, [layout]);

  // a vehicle chosen elsewhere (alert banner, overview) opens on the map
  useEffect(() => {
    if (selectedId) setView('map');
  }, [selectedId]);

  const openVehicle = (id) => {
    // same vehicle tapped again while the map is showing: nothing changes state, so zoom here
    if (id === selectedId && view === 'map') centerOn(positions[id]);
    if (id !== selectedId) setSheetHeight(0);
    setSelectedId(id);
    lastCenteredRef.current = null;
    setView('map');
  };

  // home layouts with the map in a window (Dashboard, Split): center / fit inside that window
  const focusIn = (id, pad) => {
    const position = positions[id];
    setFocusId(id);
    if (position) {
      cameraRef.current?.easeTo({ center: [position.longitude, position.latitude], zoom: STREET_ZOOM, bearing: 0, padding: pad, duration: 500 });
    }
  };
  const fitIn = (pad) => {
    const coordinates = withPositions.map((d) => positions[d.id]);
    if (coordinates.length === 1) {
      cameraRef.current?.easeTo({ center: [coordinates[0].longitude, coordinates[0].latitude], zoom: 14, bearing: 0, padding: pad, duration: 500 });
    } else if (coordinates.length > 1) {
      const lngs = coordinates.map((p) => p.longitude);
      const lats = coordinates.map((p) => p.latitude);
      cameraRef.current?.fitBounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], { padding: pad, bearing: 0, duration: 600 });
    }
  };

  const switchVehicle = (step) => {
    const ids = withPositions.map((d) => d.id);
    if (ids.length < 2) return;
    const index = ids.indexOf(selectedId);
    openVehicle(ids[(index + step + ids.length) % ids.length]);
  };

  const fitAll = () => {
    const coordinates = withPositions.map((d) => positions[d.id]);
    if (coordinates.length === 1) centerOn(coordinates[0]);
    else if (coordinates.length > 1) {
      const lngs = coordinates.map((p) => p.longitude);
      const lats = coordinates.map((p) => p.latitude);
      cameraRef.current?.fitBounds(
        [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
        { padding: { top: 80, right: 80, bottom: sheetPad + 80, left: 80 }, bearing: 0, duration: 600 },
      );
    }
  };

  const cars = withPositions.map((device) => {
    const position = positions[device.id];
    return {
      id: device.id,
      latitude: position.latitude,
      longitude: position.longitude,
      course: position.course,
      state: getState(device, position),
      icon: vehicleIcon(device, getState(device, position)).key,
      opacity: vehicleIcon(device, getState(device, position)).opacity,
    };
  });

  const toggleSatellite = () => {
    const current = findStyle(mapStyle);
    const google = current.group === 'Google';
    if (current.satellite) chooseMapStyle(google ? 'googleRoad' : 'freeStreets');
    else chooseMapStyle(google ? 'googleHybrid' : 'freeSatellite');
  };

  const renderRow = ({ item }) => {
    const position = positions[item.id];
    const state = getState(item, position);
    const stateLabel = {
      moving: `${kmh(position?.speed)} km/h`,
      static: 'Static',
      offline: `Offline ${since(item.lastUpdate)}`,
      inactive: 'Inactive',
    }[state];
    const acc = position?.attributes?.ignition;
    return (
      <Pressable
        style={[styles.card, selectedId === item.id && styles.cardSelected]}
        onPress={() => openVehicle(item.id)}
        android_ripple={{ color: colors.border }}
      >
        <View style={[styles.avatar, { backgroundColor: `${colors[state]}1F` }]}>
          <Image source={vehicleIcon(item, state).image} style={{ width: 38, height: 38 }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {item.uniqueId}
            {acc !== undefined ? ` • ACC ${acc ? 'ON' : 'OFF'}` : ''}
          </Text>
        </View>
        <Text style={[styles.statePill, { color: colors[state], backgroundColor: `${colors[state]}17` }]}>
          {stateLabel}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Image source={require('../../../assets/icon.png')} style={styles.headerIcon} />
        <Text style={styles.headerTitle}>{user?.name}</Text>
        <Pressable style={styles.headerAction} onPress={() => router.push('/appearance')} hitSlop={10}>
          <MaterialIcons name="dashboard-customize" size={24} color={colors.headerText} />
        </Pressable>
      </View>
      <View style={styles.segment}>
        {['list', 'map'].map((key) => (
          <Pressable key={key} style={styles.segmentItem} onPress={() => setView(key)}>
            <Text style={[styles.segmentText, view === key && styles.segmentActive]}>
              {key === 'map' ? 'Map' : homeLabel[layout]}
            </Text>
            {view === key && <View style={styles.segmentBar} />}
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1 }} onLayout={(e) => setAreaHeight(e.nativeEvent.layout.height)}>
        <View style={StyleSheet.absoluteFill}>
          <TrackMap
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            initialViewState={initialViewState}
            cars={cars}
            trail={selectedId ? trails[selectedId] : null}
            trailCarId={selectedId}
            onCarPress={openVehicle}
          />
          {!(view === 'list' && (layout === 'dashboard' || layout === 'split')) && (
          <MapButtons
            onRefresh={() => refresh().catch(() => {})}
            onMapType={() => setMapTypeOpen(true)}
            satellite={findStyle(activeStyle).satellite}
            onSatellite={toggleSatellite}
            onPrevious={() => switchVehicle(-1)}
            onNext={() => switchVehicle(1)}
            canSwitch={withPositions.length > 1}
            onFitAll={fitAll}
            onCenter={() => centerOn(selectedPosition || positions[withPositions[0]?.id])}
            traffic={traffic}
            onTraffic={() => setTraffic(!traffic)}
          />
          )}
          {selected && view === 'map' && (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <VehicleSheet
                device={selected}
                position={selectedPosition}
                onClose={() => setSelectedId(null)}
                onHeight={setSheetHeight}
              />
            </View>
          )}
        </View>

        {view === 'list' && layout === 'dashboard' && (
          <DashboardHome list={list} positions={positions} onOpen={openVehicle} onFit={fitIn} />
        )}
        {view === 'list' && layout === 'split' && (
          <SplitHome list={list} positions={positions} onOpen={openVehicle} onFocus={focusIn} onFit={fitIn} focusId={focusId} />
        )}
        {view === 'list' && layout === 'simple' && (
          <SimpleHome list={list} positions={positions} onOpen={openVehicle} refresh={refresh} />
        )}
        {view === 'list' && (layout === 'classic' || layout === 'list') && (
          <View style={[StyleSheet.absoluteFill, styles.listLayer]}>
            <View style={styles.search}>
              <MaterialIcons name="search" size={22} color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="IMEI / Device Name / SIM No."
                value={keyword}
                onChangeText={setKeyword}
              />
            </View>
            <View style={styles.tabs}>
              {tabs.map((item) => (
                <Pressable
                  key={item.key}
                  style={[styles.tab, tab === item.key && styles.tabActive]}
                  onPress={() => setTab(item.key)}
                >
                  <Text style={[styles.tabText, tab === item.key && { color: '#FFF' }]}>
                    {`${item.label}(${counts[item.key]})`}
                  </Text>
                </Pressable>
              ))}
            </View>
            <PullToRefresh
              onRefresh={refresh}
              summary={`Online ${counts.online}  •  Offline ${counts.offline + counts.unknown}`}
            >
              {(onScroll) => (
                <FlatList
                  data={filtered}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={renderRow}
                  onScroll={onScroll}
                  scrollEventThrottle={16}
                  overScrollMode="never"
                  contentContainerStyle={{ paddingBottom: 24 }}
                  ListEmptyComponent={<Text style={styles.empty}>No devices found</Text>}
                />
              )}
            </PullToRefresh>
          </View>
        )}
      </View>

      <Modal visible={mapTypeOpen} transparent animationType="fade" onRequestClose={() => setMapTypeOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMapTypeOpen(false)}>
          <View style={styles.menu}>
            {mapStyles.map((item, index) => (
              <View key={item.id}>
                {(index === 0 || mapStyles[index - 1].group !== item.group) && (
                  <Text style={styles.menuGroup}>{item.group === 'Google' ? 'Google maps' : 'Free maps'}</Text>
                )}
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    chooseMapStyle(item.id);
                    setMapTypeOpen(false);
                  }}
                >
                  <MaterialIcons
                    name={mapStyle === item.id ? 'radio-button-checked' : 'radio-button-unchecked'}
                    size={20}
                    color={colors.teal}
                  />
                  <Text style={styles.menuText}>{item.label}</Text>
                  {mapStyle === item.id && activeStyle !== item.id && (
                    <Text style={styles.menuBadge}>not loading</Text>
                  )}
                </Pressable>
              </View>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.card },
  header: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: colors.header },
  headerAction: { position: 'absolute', right: 16 },
  headerIcon: { position: 'absolute', left: 16, width: 28, height: 28 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.headerText },
  segment: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  segmentText: { fontSize: 16, color: colors.muted, fontWeight: '600' },
  segmentActive: { color: colors.teal },
  segmentBar: { position: 'absolute', bottom: 0, width: '60%', height: 3, borderRadius: 2, backgroundColor: colors.teal },
  listLayer: { backgroundColor: colors.background, zIndex: 20, elevation: 30 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    marginBottom: 6,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: colors.card,
    elevation: 2,
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 15, color: colors.text },
  tabs: { flexDirection: 'row', paddingHorizontal: 10, paddingBottom: 6, gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18 },
  tabActive: { backgroundColor: colors.teal, elevation: 3 },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginVertical: 5,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.card,
    elevation: 2,
  },
  cardSelected: { borderWidth: 2, borderColor: colors.teal },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 13, color: colors.muted, marginTop: 2, fontWeight: '500' },
  statePill: { fontSize: 13, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', padding: 40 },
  menu: { backgroundColor: colors.card, borderRadius: 16, paddingVertical: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  menuText: { fontSize: 16, color: colors.text, fontWeight: '500', flex: 1 },
  menuGroup: { fontSize: 12, fontWeight: '700', color: colors.muted, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 2, textTransform: 'uppercase' },
  menuBadge: { fontSize: 11, fontWeight: '700', color: colors.offline },
});
