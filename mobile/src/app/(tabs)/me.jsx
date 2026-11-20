import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getBase, logout } from '../../api/server';
import { useApp } from '../../state/AppState';
import { colors } from '../../state/status';

export default function Me() {
  const { user, setUser, connected } = useApp();
  const web = (path) => Linking.openURL(`${getBase()}/${path}`);

  const items = [
    ['dashboard', 'Fleet overview', () => web('reports/dashboard')],
    ['assessment', 'Reports', () => web('reports/combined')],
    ['sms', 'SMS & WhatsApp alerts', () => web('settings/sms-alerts')],
    ['devices', 'Devices', () => web('settings/devices')],
    ['hexagon', 'Geofences', () => web('geofences')],
    ['security', 'Account security', () => web(`settings/user/${user?.id}`)],
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <Text style={styles.email}>{connected ? '● Live connected' : '○ Reconnecting…'}</Text>
          </View>
        </View>
        <View style={styles.card}>
          {items.map(([icon, label, onPress]) => (
            <Pressable key={label} style={styles.item} onPress={onPress} android_ripple={{ color: '#E2E8F0' }}>
              <MaterialIcons name={icon} size={22} color={colors.teal} />
              <Text style={styles.itemText}>{label}</Text>
              <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
            </Pressable>
          ))}
        </View>
        <View style={styles.card}>
          <Pressable
            style={styles.item}
            onPress={async () => {
              await logout();
              setUser(null);
              router.replace('/login');
            }}
          >
            <MaterialIcons name="logout" size={22} color={colors.offline} />
            <Text style={[styles.itemText, { color: colors.offline }]}>Log out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 24, paddingTop: 36, backgroundColor: colors.tealDark },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 30, color: '#FFF', fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  card: { margin: 12, marginBottom: 0, borderRadius: 16, backgroundColor: '#FFF', overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.background },
  itemText: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.text },
});
