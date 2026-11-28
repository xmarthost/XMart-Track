import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../state/status';
import { saveTheme, setLayout, themeId, themes, useLayout } from '../state/theme';
import { chooseMapStyle, getMapState } from '../map/mapState';
import { Button, ui, useContentStyle } from '../components/ui';

const layoutInfo = [
  { id: 'classic', name: 'Classic', icon: 'map', who: 'Like common tracking apps', text: 'List and Map tabs, buttons on both sides, big vehicle card with all details.' },
  { id: 'fullmap', name: 'Full Map', icon: 'fullscreen', who: 'Everyone who wants a big map', text: 'Map on the whole screen, options in a bar at the bottom, small vehicle card.' },
  { id: 'dashboard', name: 'Dashboard', icon: 'space-dashboard', who: 'Owners', text: "Today's km, engine time, top speed and alerts above a small map; compact map buttons." },
  { id: 'split', name: 'Split View', icon: 'vertical-split', who: 'Office, tablet', text: 'Map and list together; side by side when the phone is turned.' },
  { id: 'simple', name: 'Simple Mode', icon: 'touch-app', who: 'Elders, drivers', text: 'Big cards and big buttons: Map, Share, Playback.' },
];

// little picture of each layout
function Preview({ id }) {
  const block = (style) => <View style={[{ backgroundColor: colors.border, borderRadius: 3 }, style]} />;
  const map = (style) => <View style={[{ backgroundColor: '#BFE3D0', borderRadius: 3 }, style]} />;
  return (
    <View style={styles.preview}>
      {id === 'classic' && (<>{map({ flex: 1 })}{block({ height: 14, marginTop: 3 })}</>)}
      {id === 'fullmap' && (<>{map({ flex: 1 })}<View style={{ position: 'absolute', left: 6, right: 6, bottom: 6, height: 10, borderRadius: 4, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }} /></>)}
      {id === 'dashboard' && (
        <>
          <View style={{ flexDirection: 'row', gap: 3 }}>{block({ flex: 1, height: 10 })}{block({ flex: 1, height: 10 })}</View>
          {map({ flex: 1, marginVertical: 3 })}
          {block({ height: 10 })}
        </>
      )}
      {id === 'split' && (<>{map({ flex: 1, marginBottom: 3 })}{block({ height: 8, marginBottom: 2 })}{block({ height: 8 })}</>)}
      {id === 'simple' && (<>{block({ flex: 1, marginBottom: 3 })}<View style={{ flexDirection: 'row', gap: 3 }}>{[0, 1, 2].map((i) => <View key={i} style={{ flex: 1, height: 12, borderRadius: 3, backgroundColor: colors.teal }} />)}</View></>)}
    </View>
  );
}

export default function Appearance() {
  const { first } = useLocalSearchParams();
  const contentStyle = useContentStyle();
  const layout = useLayout();
  const [theme, setTheme] = useState(themeId);

  const pickTheme = (id) => {
    setTheme(id);
    saveTheme(id).catch(() => {});
    // a dark map fits the dark theme; back to the Google map when leaving it
    const map = getMapState().chosen;
    if (themes[id].dark && map !== 'freeDark') chooseMapStyle('freeDark');
    else if (!themes[id].dark && map === 'freeDark') chooseMapStyle('googleRoad');
  };

  return (
    <ScrollView style={ui.screen} contentContainerStyle={contentStyle}>
      {first ? <Stack.Screen options={{ title: 'Choose your layout', headerBackVisible: false }} /> : null}
      {first ? (
        <Text style={styles.intro}>How should XMart Track look? You can change it any time from the button at the top of Monitor.</Text>
      ) : null}
      <Text style={styles.section}>Layout</Text>
      {layoutInfo.map((item) => {
        const active = layout === item.id || (item.id === 'classic' && layout === 'list');
        return (
          <Pressable key={item.id} style={[styles.card, active && styles.cardActive]} onPress={() => setLayout(item.id)}>
            <Preview id={item.id} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name={item.icon} size={18} color={colors.teal} />
                <Text style={styles.name}>{item.name}</Text>
              </View>
              <Text style={styles.who}>{item.who}</Text>
              <Text style={styles.text}>{item.text}</Text>
            </View>
            <MaterialIcons name={active ? 'radio-button-checked' : 'radio-button-unchecked'} size={22} color={active ? colors.teal : colors.muted} />
          </Pressable>
        );
      })}

      <Text style={styles.section}>Theme</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {Object.entries(themes).map(([id, t]) => {
          const active = theme === id;
          return (
            <Pressable key={id} style={[styles.theme, { backgroundColor: t.background }, active && styles.cardActive]} onPress={() => pickTheme(id)}>
              <View style={[styles.themeHeader, { backgroundColor: t.header }]} />
              <View style={[styles.themeCard, { backgroundColor: t.card }]}>
                <View style={{ height: 6, width: '70%', borderRadius: 3, backgroundColor: t.text, opacity: 0.8 }} />
                <View style={{ height: 6, width: '45%', borderRadius: 3, backgroundColor: t.teal, marginTop: 5 }} />
              </View>
              <Text style={[styles.themeName, { color: t.text }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {theme !== themeId && (
        <View style={styles.notice}>
          <MaterialIcons name="restart-alt" size={20} color={colors.amber} />
          <Text style={styles.noticeText}>Close XMart Track and open it again to see the new theme.</Text>
        </View>
      )}

      {first ? <Button title="Continue" icon="check" style={{ marginTop: 16 }} onPress={() => {
            setLayout(layout);
            router.replace('/(tabs)');
          }} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', marginTop: 6 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 16, padding: 12, borderWidth: 2, borderColor: 'transparent' },
  cardActive: { borderColor: colors.teal },
  preview: { width: 52, height: 78, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 4, backgroundColor: colors.background },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  who: { fontSize: 12, fontWeight: '700', color: colors.teal, marginTop: 2 },
  text: { fontSize: 13, color: colors.muted, marginTop: 2 },
  theme: { flex: 1, borderRadius: 16, padding: 8, borderWidth: 2, borderColor: colors.border },
  themeHeader: { height: 14, borderRadius: 4, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  themeCard: { borderRadius: 6, padding: 8 },
  themeName: { fontWeight: '800', textAlign: 'center', marginTop: 8 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 12, padding: 12 },
  noticeText: { flex: 1, color: colors.text, fontWeight: '600' },
});
