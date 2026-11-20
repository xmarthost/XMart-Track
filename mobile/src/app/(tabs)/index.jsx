import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../../state/AppState';
import { carImages, colors, getState, kmh, since } from '../../state/status';
import VehicleSheet from '../../components/VehicleSheet';
import MapButtons from '../../components/MapButtons';

const tabs = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
  { key: 'unknown', label: 'Inactive' },
];
const mapTypes = [
  { key: 'standard', label: 'Google Road' },
  { key: 'hybrid', label: 'Google Hybrid' },
  { key: 'satellite', label: 'Google Satellite' },
  { key: 'terrain', label: 'Google Terrain' },
];
const ZOOM_DELTA = 0.006; // street level

export default function Monitor() {
  const { user, devices, positions, trails, selectedId, setSelectedId, refresh } = useApp();
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [mapType, setMapType] = useState('standard');
  const [mapTypeOpen, setMapTypeOpen] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const mapRef = useRef(null);
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

  const [mapReady, setMapReady] = useState(false);
  const initialRegion = useMemo(() => {
    const first = selectedPosition || (withPositions[0] && positions[withPositions[0].id]);
    return first
      ? { latitude: first.latitude, longitude: first.longitude, latitudeDelta: ZOOM_DELTA, longitudeDelta: ZOOM_DELTA }
      : { latitude: 30.3753, longitude: 69.3451, latitudeDelta: 12, longitudeDelta: 12 };
    // only the first render matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const centerOn = (position, animated = true) => {
    if (!position || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: position.latitude,
        longitude: position.longitude,
        latitudeDelta: ZOOM_DELTA,
        longitudeDelta: ZOOM_DELTA,
      },
      animated ? 500 : 0,
    );
  };

  // follow the selected vehicle as live positions arrive
  useEffect(() => {
    if (view !== 'map' || !mapReady || !selectedPosition || !mapRef.current) return;
    const key = `${selectedId}:${selectedPosition.latitude}:${selectedPosition.longitude}`;
    if (lastCenteredRef.current === key) return;
    const first = !lastCenteredRef.current?.startsWith(`${selectedId}:`);
    lastCenteredRef.current = key;
    if (first) {
      centerOn(selectedPosition);
    } else {
      mapRef.current.animateCamera(
        { center: { latitude: selectedPosition.latitude, longitude: selectedPosition.longitude } },
        { duration: 800 },
      );
    }
  }, [selectedId, selectedPosition, view, mapReady]);

  const openVehicle = (id) => {
    setSelectedId(id);
    lastCenteredRef.current = null;
    setView('map');
  };

  const switchVehicle = (step) => {
    const ids = withPositions.map((d) => d.id);
    if (ids.length < 2) return;
    const index = ids.indexOf(selectedId);
    openVehicle(ids[(index + step + ids.length) % ids.length]);
  };

  const fitAll = () => {
    const coordinates = withPositions.map((d) => ({
      latitude: positions[d.id].latitude,
      longitude: positions[d.id].longitude,
    }));
    if (coordinates.length === 1) centerOn(coordinates[0]);
    else if (coordinates.length > 1) {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 80, right: 80, bottom: sheetHeight + 80, left: 80 },
        animated: true,
      });
    }
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
        android_ripple={{ color: '#E2E8F0' }}
      >
        <View style={[styles.avatar, { backgroundColor: `${colors[state]}1F` }]}>
          <MaterialIcons name="directions-car" size={26} color={colors[state]} />
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
      </View>
      <View style={styles.segment}>
        {['list', 'map'].map((key) => (
          <Pressable key={key} style={styles.segmentItem} onPress={() => setView(key)}>
            <Text style={[styles.segmentText, view === key && styles.segmentActive]}>
              {key === 'list' ? 'List' : 'Map'}
            </Text>
            {view === key && <View style={styles.segmentBar} />}
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        <View style={StyleSheet.absoluteFill}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            mapType={mapType}
            mapPadding={{ top: 0, right: 0, left: 0, bottom: selected ? sheetHeight : 0 }}
            showsMyLocationButton={false}
            showsCompass={false}
            toolbarEnabled={false}
            initialRegion={initialRegion}
            onMapReady={() => {
              setMapReady(true);
              if (!selectedId) fitAll();
            }}
          >
            {selectedId && trails[selectedId]?.length > 1 && (
              <Polyline coordinates={trails[selectedId]} strokeColor="#16A34A" strokeWidth={5} />
            )}
            {withPositions.map((device) => {
              const position = positions[device.id];
              return (
                <Marker
                  key={device.id}
                  coordinate={{ latitude: position.latitude, longitude: position.longitude }}
                  image={carImages[getState(device, position)]}
                  rotation={position.course || 0}
                  flat
                  anchor={{ x: 0.5, y: 0.5 }}
                  title={device.name}
                  tracksViewChanges={false}
                  onPress={() => openVehicle(device.id)}
                />
              );
            })}
          </MapView>
          <MapButtons
            onRefresh={() => refresh().catch(() => {})}
            onMapType={() => setMapTypeOpen(true)}
            satellite={mapType !== 'standard'}
            onSatellite={() => setMapType(mapType === 'standard' ? 'hybrid' : 'standard')}
            onPrevious={() => switchVehicle(-1)}
            onNext={() => switchVehicle(1)}
            canSwitch={withPositions.length > 1}
            onFitAll={fitAll}
            onCenter={() => centerOn(selectedPosition || positions[withPositions[0]?.id])}
            position={selectedPosition}
          />
          {selected && (
            <View
              style={StyleSheet.absoluteFill}
              pointerEvents="box-none"
              onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height * 0.5)}
            >
              <VehicleSheet
                device={selected}
                position={selectedPosition}
                onClose={() => setSelectedId(null)}
                onTrack={() => centerOn(selectedPosition)}
              />
            </View>
          )}
        </View>

        {view === 'list' && (
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
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderRow}
              contentContainerStyle={{ paddingBottom: 24 }}
              ListEmptyComponent={<Text style={styles.empty}>No devices found</Text>}
            />
          </View>
        )}
      </View>

      <Modal visible={mapTypeOpen} transparent animationType="fade" onRequestClose={() => setMapTypeOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMapTypeOpen(false)}>
          <View style={styles.menu}>
            {mapTypes.map((item) => (
              <Pressable
                key={item.key}
                style={styles.menuItem}
                onPress={() => {
                  setMapType(item.key);
                  setMapTypeOpen(false);
                }}
              >
                <MaterialIcons
                  name={mapType === item.key ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={20}
                  color={colors.teal}
                />
                <Text style={styles.menuText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF' },
  header: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  headerIcon: { position: 'absolute', left: 16, width: 28, height: 28 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
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
    backgroundColor: '#FFF',
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
    backgroundColor: '#FFF',
    elevation: 2,
  },
  cardSelected: { borderWidth: 2, borderColor: colors.teal },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 13, color: colors.muted, marginTop: 2, fontWeight: '500' },
  statePill: { fontSize: 13, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', padding: 40 },
  menu: { backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  menuText: { fontSize: 16, color: colors.text, fontWeight: '500' },
});
