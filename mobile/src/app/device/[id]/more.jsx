import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../../../state/AppState';
import { colors, formatDateTime } from '../../../state/status';
import { useContentStyle } from '../../../components/ui';
import ShareLinkModal from '../../../components/ShareLinkModal';

// Pro layout "More": every function of one vehicle in one place, grouped like common tracker apps.
export default function More() {
  const { id } = useLocalSearchParams();
  const deviceId = Number(id);
  const { devices } = useApp();
  const device = devices[deviceId];
  const contentStyle = useContentStyle();
  const [sharing, setSharing] = useState(false);
  if (!device) return null;

  const go = (path) => () => router.push(path);
  const groups = [
    {
      title: 'Common functions',
      round: true,
      items: [
        ['route', 'Playback', '#3B82F6', go(`/device/${deviceId}/playback`)],
        ['fence', 'Geo-fence', '#F59E0B', go(`/geofences?deviceId=${deviceId}`)],
        ['share-location', 'Share location', '#8B5CF6', () => setSharing(true)],
        ['notifications-active', 'Alerts', '#EF4444', go('/(tabs)/alerts')],
      ],
    },
    {
      title: 'Reports',
      items: [
        ['timeline', 'Trips', colors.teal, go(`/device/${deviceId}/trips`)],
        ['local-parking', 'Parking', colors.teal, go(`/device/${deviceId}/trips`)],
        ['insights', 'Summary', colors.teal, go('/reports')],
        ['speed', 'Mileage', colors.teal, go('/reports')],
      ],
    },
    {
      title: 'Vehicle settings',
      items: [
        ['edit', 'Name & SIM', '#0EA5E9', go(`/devices?id=${deviceId}`)],
        ['directions-car', 'Icon & colour', '#0EA5E9', go(`/devices?id=${deviceId}`)],
        ['security', 'Theft alert', '#0EA5E9', go(`/devices?id=${deviceId}`)],
        ['chat', 'WhatsApp numbers', '#0EA5E9', go(`/devices?id=${deviceId}`)],
      ],
    },
    {
      title: 'App',
      items: [
        ['notifications', 'Alert settings', '#64748B', go('/alert-settings')],
        ['dashboard-customize', 'Layout & theme', '#64748B', go('/appearance')],
        ['summarize', 'Fleet overview', '#64748B', go('/overview')],
        ['bug-report', 'Diagnostics', '#64748B', go('/diagnostics')],
      ],
    },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={contentStyle}>
      <Pressable style={styles.hero} onPress={go(`/devices?id=${deviceId}`)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroName} numberOfLines={1}>{device.name}</Text>
          <Text style={styles.heroSub}>{`IMEI ${device.uniqueId}`}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.heroLink}>Details ›</Text>
          {device.expirationTime ? <Text style={styles.heroSub}>{`Expires ${formatDateTime(device.expirationTime, false)}`}</Text> : null}
        </View>
      </Pressable>

      <Pressable style={styles.commands} onPress={go(`/device/${deviceId}/commands`)}>
        <MaterialIcons name="settings-remote" size={26} color={colors.teal} />
        <Text style={styles.commandsText}>Commands</Text>
        <MaterialIcons name="chevron-right" size={26} color={colors.muted} />
      </Pressable>

      {groups.map((group) => (
        <View key={group.title} style={styles.card}>
          <Text style={styles.cardTitle}>{group.title}</Text>
          <View style={styles.grid}>
            {group.items.map(([icon, label, color, onPress]) => (
              <Pressable key={label} style={styles.item} onPress={onPress}>
                {group.round ? (
                  <View style={[styles.round, { backgroundColor: color }]}>
                    <MaterialIcons name={icon} size={30} color="#FFF" />
                  </View>
                ) : (
                  <MaterialIcons name={icon} size={36} color={color} style={{ height: 52, textAlignVertical: 'center' }} />
                )}
                <Text style={styles.itemText} numberOfLines={2}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <ShareLinkModal device={device} visible={sharing} onClose={() => setSharing(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.teal, borderRadius: 18, padding: 18 },
  heroName: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  heroLink: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  commands: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 16, padding: 16 },
  commandsText: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.teal },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { width: '25%', alignItems: 'center', paddingVertical: 8 },
  round: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  itemText: { marginTop: 6, fontSize: 12, color: colors.muted, textAlign: 'center', fontWeight: '600' },
});
