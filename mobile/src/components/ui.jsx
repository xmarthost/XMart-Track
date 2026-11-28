import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../state/status';

export const Card = ({ title, subtitle, children, style }) => (
  <View style={[ui.card, style]}>
    {title ? <Text style={ui.cardTitle}>{title}</Text> : null}
    {subtitle ? <Text style={ui.cardSubtitle}>{subtitle}</Text> : null}
    {children}
  </View>
);

export const Field = ({ label, help, style, ...props }) => (
  <View style={[{ marginTop: 10 }, style]}>
    <Text style={ui.label}>{label}</Text>
    <TextInput style={ui.input} placeholderTextColor="#94A3B8" {...props} />
    {help ? <Text style={ui.help}>{help}</Text> : null}
  </View>
);

export const SwitchRow = ({ label, value, onValueChange, disabled }) => (
  <View style={ui.switchRow}>
    <Text style={[ui.switchLabel, disabled && { color: '#94A3B8' }]}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ true: '#7DD3DC', false: '#CBD5E1' }}
      thumbColor={value ? colors.teal : '#F8FAFC'}
    />
  </View>
);

export const Button = ({ title, onPress, icon, color = colors.teal, outline, loading, disabled, style }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled || loading}
    style={[
      ui.button,
      outline ? { borderWidth: 1.5, borderColor: color, backgroundColor: colors.card } : { backgroundColor: color },
      (disabled || loading) && { opacity: 0.55 },
      style,
    ]}
  >
    {loading ? (
      <ActivityIndicator color={outline ? color : '#FFF'} />
    ) : icon ? (
      <MaterialIcons name={icon} size={19} color={outline ? color : '#FFF'} />
    ) : null}
    <Text style={[ui.buttonText, outline && { color }]}>{title}</Text>
  </Pressable>
);

export const Chips = ({ options, value, onChange }) => (
  <View style={ui.chips}>
    {options.map((option) => {
      const active = Array.isArray(value) ? value.includes(option.value) : option.value === value;
      return (
        <Pressable
          key={String(option.value)}
          style={[ui.chip, active && { backgroundColor: colors.teal, borderColor: colors.teal }]}
          onPress={() => onChange(option.value)}
        >
          <Text style={[ui.chipText, active && { color: '#FFF' }]}>{option.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

export const Code = ({ children }) => <Text style={ui.code}>{children}</Text>;

export const Empty = ({ text }) => <Text style={ui.empty}>{text}</Text>;

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 12, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardSubtitle: { fontSize: 13, color: colors.muted, marginTop: 3 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
  help: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  switchLabel: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  buttonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
  chipText: { fontWeight: '600', color: colors.muted },
  code: {
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.subtle,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  empty: { textAlign: 'center', color: colors.muted, padding: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.background },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
});

// Screen content padding that keeps the last buttons above the phone's navigation bar.
export function useContentStyle(extra = 24) {
  const insets = useSafeAreaInsets();
  return [ui.content, { paddingBottom: extra + Math.max(insets.bottom, 16) }];
}
