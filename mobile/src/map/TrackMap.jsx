import { forwardRef, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Images, Layer, Map } from '@maplibre/maplibre-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { carImages } from '../state/status';
import { logError, logInfo } from '../state/log';
import { buildStyle } from './mapStyles';
import { dismissMapNotice, initMapStyle, reportMapFailure, useMapState } from './mapState';

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

export const lineGeoJSON = (points) => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates: points.map((p) => [p.longitude, p.latitude]) },
});

// Map drawn by MapLibre with Google or free raster tiles, car markers and an optional green trail.
const TrackMap = forwardRef(function TrackMap(
  { style, initialViewState, cars = [], trail, onCarPress, onPress, children },
  cameraRef,
) {
  const { active, notice } = useMapState();
  const renderedRef = useRef(false);

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
        mapStyle={buildStyle(active)}
        androidView="texture"
        logo={false}
        compass={false}
        attribution
        attributionPosition={{ bottom: 6, left: 6 }}
        touchPitch={false}
        onPress={onPress}
        onWillStartLoadingMap={() => logInfo('map', `loading ${active}`)}
        onDidFinishLoadingStyle={() => logInfo('map', `style ready ${active}`)}
        onDidFinishLoadingMap={() => logInfo('map', `map loaded ${active}`)}
        onDidFinishRenderingMapFully={() => {
          if (!renderedRef.current) {
            renderedRef.current = true;
            logInfo('map', `tiles rendered ${active}`);
          }
        }}
        onDidFailLoadingMap={() => {
          logError('map', `failed to load ${active}`);
          reportMapFailure(active);
        }}
      >
        <Camera ref={cameraRef} initialViewState={initialViewState} />
        <Images images={carIcons} />
        {trail && trail.length > 1 && (
          <GeoJSONSource id="trail" data={lineGeoJSON(trail)}>
            <Layer
              id="trail-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': '#16A34A', 'line-width': 5 }}
            />
          </GeoJSONSource>
        )}
        <GeoJSONSource
          id="cars"
          data={carsGeoJSON(cars)}
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
