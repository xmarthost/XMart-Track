import { forwardRef, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Images, Layer, Map, RasterSource } from '@maplibre/maplibre-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { carImages } from '../state/status';
import { logInfo, logWarn } from '../state/log';
import { TRAFFIC_OPACITY, buildStyle, trafficTiles } from './mapStyles';
import { dismissMapNotice, initMapStyle, useMapState } from './mapState';
import { trimLineToCar, useMatchedTrail } from './roadMatch';
import { useSmoothCars } from './smoothMotion';

const carIcons = {
  'car-moving': carImages.moving,
  'car-static': carImages.static,
  'car-offline': carImages.offline,
  'car-inactive': carImages.inactive,
};

// cars: [{ id, latitude, longitude, course, state }]
export const carsGeoJSON = (cars) => ({
  type: 'FeatureCollection',
  features: cars.map((car) => ({
    type: 'Feature',
    id: car.id,
    properties: { id: car.id, icon: `car-${car.state}`, course: car.course || 0 },
    geometry: { type: 'Point', coordinates: [car.longitude, car.latitude] },
  })),
});

const emptyCollection = { type: 'FeatureCollection', features: [] };

export const lineGeoJSON = (points) => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates: points.map((p) => [p.longitude, p.latitude]) },
});

const coordsLine = (coordinates) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });

// Map drawn by MapLibre with Google or free raster tiles, car markers and an optional green trail.
const TrackMap = forwardRef(function TrackMap(
  { style, initialViewState, cars = [], trail, trailCarId, smooth = true, onCarPress, onPress, onRegionChange, children },
  cameraRef,
) {
  const { active, tiles, notice, traffic, trafficStamp } = useMapState();
  const renderedRef = useRef(false);
  // cars glide between fixes; the green line follows the roads and ends under the moving car
  const smoothCars = useSmoothCars(cars, smooth);
  const roadLine = useMatchedTrail(trail);
  const trailCar = trailCarId != null ? smoothCars.find((c) => c.id === trailCarId) : null;
  const line = trailCar && roadLine.length > 1 ? trimLineToCar(roadLine, [trailCar.longitude, trailCar.latitude]) : roadLine;
  const lastFailRef = useRef(0);

  useEffect(() => {
    initMapStyle();
  }, []);

  useEffect(() => {
    renderedRef.current = false;
  }, [active]);

  return (
    <View style={style}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={buildStyle(active, tiles)}
        androidView="texture"
        logo={false}
        compass={false}
        attribution
        attributionPosition={{ bottom: 6, left: 6 }}
        // north-up like tracking apps: map labels would turn upside down when rotated
        touchRotate={false}
        touchPitch={false}
        onPress={onPress}
        onRegionIsChanging={onRegionChange}
        onRegionDidChange={onRegionChange}
        onWillStartLoadingMap={() => logInfo('map', `loading ${active}`)}
        onDidFinishLoadingStyle={() => logInfo('map', `style ready ${active}`)}
        onDidFinishLoadingMap={() => logInfo('map', `map loaded ${active}`)}
        onDidFinishRenderingMapFully={() => {
          if (!renderedRef.current) {
            renderedRef.current = true;
            logInfo('map', `tiles rendered ${active}`);
          }
        }}
        onDidFailLoadingMap={(event) => {
          // usually one tile failing during a short network drop while zooming; MapLibre retries
          // it, so the Google map is kept (switching here made the map jump to a free layer)
          const now = Date.now();
          if (now - lastFailRef.current > 10000) {
            lastFailRef.current = now;
            logWarn('map', `tile/load error on ${active}`, event?.nativeEvent || '');
          }
        }}
      >
        <Camera ref={cameraRef} initialViewState={initialViewState} />
        <Images images={carIcons} />
        {/* live traffic: thin, light layer under the green trail and the cars */}
        {traffic && (
          <RasterSource key={`traffic-${trafficStamp}`} id="traffic" tiles={trafficTiles(trafficStamp)} tileSize={256} maxzoom={20}>
            <Layer id="traffic-layer" type="raster" paint={{ 'raster-opacity': TRAFFIC_OPACITY, 'raster-fade-duration': 0 }} />
          </RasterSource>
        )}
        {/* always mounted before the cars so the line stays under the car icons */}
        <GeoJSONSource id="trail" data={line.length > 1 ? coordsLine(line) : emptyCollection}>
          <Layer
            id="trail-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': '#4ADE80', 'line-opacity': 0.8, 'line-width': 4 }}
          />
        </GeoJSONSource>
        <GeoJSONSource
          id="cars"
          data={carsGeoJSON(smoothCars)}
          onPress={(event) => {
            const id = event.nativeEvent.features?.[0]?.properties?.id;
            if (id != null) onCarPress?.(Number(id));
          }}
          hitbox={{ top: 12, right: 12, bottom: 12, left: 12 }}
        >
          <Layer
            id="cars-icon"
            type="symbol"
            layout={{
              'icon-image': ['get', 'icon'],
              // smaller cars when zoomed out over a city or country
              'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.45, 10, 0.7, 14, 0.9, 16, 1],
              'icon-rotate': ['get', 'course'],
              'icon-rotation-alignment': 'map',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            }}
          />
        </GeoJSONSource>
        {children}
      </Map>
      {notice && (
        <Pressable style={styles.notice} onPress={dismissMapNotice}>
          <MaterialIcons name="info-outline" size={18} color="#FFF" />
          <Text style={styles.noticeText}>{notice}</Text>
          <MaterialIcons name="close" size={16} color="#FFF" />
        </Pressable>
      )}
    </View>
  );
});

export default TrackMap;

const styles = StyleSheet.create({
  notice: {
    position: 'absolute',
    bottom: 34,
    alignSelf: 'center',
    maxWidth: '86%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.82)',
  },
  noticeText: { color: '#FFF', fontSize: 13, fontWeight: '600', flexShrink: 1 },
});
