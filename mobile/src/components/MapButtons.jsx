import { Pressable, StyleSheet, Text, View } from 'react-native';
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

const SmallButton = ({ icon, onPress, active }) => (
  <Pressable style={styles.small} onPress={onPress}>
    <MaterialIcons name={icon} size={20} color={active ? colors.teal : colors.text} />
  </Pressable>
);

// Map buttons by layout. Classic (sides): left = refresh, geofences (web), map type, previous/next vehicle;
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
  variant = 'sides',
  bottom = 0,
  onList,
}) {
  // Full Map layout: one row of options along the bottom of the map
  if (variant === 'bar') {
    const items = [
      ['format-list-bulleted', 'Vehicles', onList],
      ['map', 'Map', onMapType],
      ['satellite-alt', 'Satellite', onSatellite, satellite],
      ['traffic', 'Traffic', onTraffic, traffic],
      ['zoom-out-map', 'All', onFitAll],
      ['gps-fixed', 'Center', onCenter],
    ];
    return (
      <View style={[styles.bar, { bottom: bottom + 12 }]}>
        {items.map(([icon, label, action, active]) => (
          <Pressable key={label} style={styles.barItem} onPress={action}>
            <MaterialIcons name={icon} size={22} color={active ? colors.teal : colors.text} />
            <Text style={[styles.barText, active && { color: colors.teal }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    );
  }
  // Simple Mode: three big buttons
  if (variant === 'big') {
    return (
      <View style={[styles.column, { right: 14 }]}>
        <Pressable style={styles.bigButton} onPress={onCenter}>
          <MaterialIcons name="gps-fixed" size={30} color={colors.teal} />
        </Pressable>
        <Pressable style={styles.bigButton} onPress={onSatellite}>
          <MaterialIcons name="satellite-alt" size={30} color={satellite ? colors.teal : colors.text} />
        </Pressable>
        <Pressable style={styles.bigButton} onPress={onFitAll}>
          <MaterialIcons name="zoom-out-map" size={30} color={colors.text} />
        </Pressable>
      </View>
    );
  }
  // Dashboard / Split: one compact column on the right
  if (variant === 'column') {
    return (
      <View style={[styles.column, { right: 12, gap: 8 }]}>
        <SmallButton icon="map" onPress={onMapType} />
        <SmallButton icon="satellite-alt" onPress={onSatellite} active={satellite} />
        <SmallButton icon="traffic" onPress={onTraffic} active={traffic} />
        <SmallButton icon="zoom-out-map" onPress={onFitAll} />
        <SmallButton icon="gps-fixed" onPress={onCenter} />
        {canSwitch && <SmallButton icon="keyboard-arrow-down" onPress={onNext} />}
      </View>
    );
  }
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
  small: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
  bigButton: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 6,
    ...shadow,
  },
  barItem: { flex: 1, alignItems: 'center', gap: 2 },
  barText: { fontSize: 11, fontWeight: '600', color: colors.muted },
  pair: { width: 44, borderRadius: 10, backgroundColor: colors.card, ...shadow },
  pairButton: { height: 40, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, marginHorizontal: 8, backgroundColor: colors.border },
});
