import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../state/status';

const Button = ({ icon, family = 'm', onPress, active, disabled }) => {
  const Icon = family === 'c' ? MaterialCommunityIcons : MaterialIcons;
  return (
    <Pressable style={[styles.button, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled}>
      <Icon name={icon} size={24} color={active ? colors.teal : colors.text} />
    </Pressable>
  );
};

// Fixed map buttons: left = refresh, geofences (web), map type, previous/next vehicle;
// right = fit all, satellite, alerts, live traffic, center vehicle.
export default function MapButtons({
  onRefresh,
  onMapType,
  satellite,
  onSatellite,
  onPrevious,
  onNext,
  canSwitch,
  onFitAll,
  onCenter,
  traffic,
  onTraffic,
}) {
  return (
    <>
      <View style={[styles.column, { left: 14 }]}>
        <Button icon="autorenew" onPress={onRefresh} />
        <Button icon="fence" family="c" onPress={() => router.push('/geofences')} />
        <Button icon="map" onPress={onMapType} />
        <View style={[styles.pair, !canSwitch && { opacity: 0.45 }]}>
          <Pressable style={styles.pairButton} onPress={onPrevious} disabled={!canSwitch}>
            <MaterialIcons name="keyboard-arrow-up" size={26} color={colors.text} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.pairButton} onPress={onNext} disabled={!canSwitch}>
            <MaterialIcons name="keyboard-arrow-down" size={26} color={colors.text} />
          </Pressable>
        </View>
      </View>
      <View style={[styles.column, { right: 14 }]}>
        <Button icon="zoom-out-map" onPress={onFitAll} />
        <Button icon="satellite-alt" onPress={onSatellite} active={satellite} />
        <Button icon="chat-bubble-outline" onPress={() => router.push('/(tabs)/alerts')} />
        <Button icon="traffic" onPress={onTraffic} active={traffic} />
        <Button icon="gps-fixed" onPress={onCenter} />
      </View>
    </>
  );
}

const shadow = { elevation: 4, shadowColor: '#0F172A', shadowOpacity: 0.15, shadowRadius: 6 };

const styles = StyleSheet.create({
  column: { position: 'absolute', top: 14, gap: 10 },
  button: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  pair: { width: 44, borderRadius: 10, backgroundColor: colors.card, ...shadow },
  pairButton: { height: 40, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, marginHorizontal: 8, backgroundColor: colors.border },
});
