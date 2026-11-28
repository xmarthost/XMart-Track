import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { api, apiJson } from '../../../api/server';
import { useApp } from '../../../state/AppState';
import { colors, formatDateTime } from '../../../state/status';
import { Button } from '../../../components/ui';

// type: Traccar command type; data: text command ({key} replaced by the field values)
// WanWay G19S / Concox (GT06 protocol)
const gt06Groups = [
  {
    title: 'Control',
    items: [
      { label: 'Engine stop (cut fuel)', icon: 'power-settings-new', type: 'engineStop', danger: true },
      { label: 'Engine resume', icon: 'play-circle-outline', type: 'engineResume' },
    ],
  },
  {
    title: 'Data upload',
    items: [
      {
        label: 'Upload interval',
        icon: 'timer',
        data: 'TIMER,{moving},{parked}#',
        fields: [
          { key: 'moving', label: 'While driving (seconds)', initial: '10', numeric: true },
          { key: 'parked', label: 'While parked / ACC off (seconds)', initial: '300', numeric: true },
        ],
        note: 'Lower = more real-time tracking and more data use. 10 s while driving is recommended.',
      },
      { label: 'Real-time mode (10 s / 5 min)', icon: 'bolt', data: 'TIMER,10,300#' },
      { label: 'Battery saver (60 s / 30 min)', icon: 'battery-saver', data: 'TIMER,60,1800#' },
    ],
  },
  {
    title: 'SMS from tracker SIM',
    items: [
      {
        label: 'Google Maps link in tracker SMS',
        icon: 'map',
        data: 'LANG,0#',
        note: 'Tracker alarm SMS will carry a maps.google.com link instead of carhere.net.',
      },
      {
        label: 'Check SMS link setting',
        icon: 'fact-check',
        data: 'GPRSSET#',
        note: 'The reply shows URL:http://maps.google.com/maps?q= when the Google link is active.',
      },
      { label: 'ACC SMS alert ON', icon: 'notifications-active', data: 'ACCALM,ON,1#' },
      { label: 'ACC SMS alert OFF', icon: 'notifications-off', data: 'ACCALM,OFF#' },
      {
        label: 'Set center number',
        icon: 'contact-phone',
        data: 'center,a,{value}#',
        fields: [{ key: 'value', label: 'Mobile number', phone: true }],
      },
      {
        label: 'SOS numbers (up to 3)',
        icon: 'sos',
        data: 'SOS,A,{sos1},{sos2},{sos3}#',
        fields: [
          { key: 'sos1', label: 'SOS number 1', phone: true },
          { key: 'sos2', label: 'SOS number 2 (optional)', phone: true, optional: true },
          { key: 'sos3', label: 'SOS number 3 (optional)', phone: true, optional: true },
        ],
        // empty optional numbers are left out: SOS,A,num1,num2#
        build: (v) => `SOS,A,${[v.sos1, v.sos2, v.sos3].map((n) => (n || '').trim()).filter(Boolean).join(',')}#`,
        note: 'The tracker calls / sends SMS to these numbers on SOS and alarms. Sending again replaces the list.',
      },
      { label: 'Check SOS numbers', icon: 'contact-phone', data: 'SOS#' },
      { label: 'Delete all SOS numbers', icon: 'phonelink-erase', data: 'SOS,D,1,2,3#' },
    ],
  },
  {
    title: 'Query',
    items: [
      { label: 'Status', icon: 'info-outline', data: 'status#' },
      { label: 'Location', icon: 'my-location', data: 'DW' },
      { label: 'Parameters', icon: 'tune', data: 'PARAM#' },
      {
        label: 'Tracker SMS time zone (GMT+5)',
        icon: 'schedule',
        data: 'GMT,E,5,0#',
        note: 'Only changes the time written in the tracker\'s own SMS. The server always reads tracker time as UTC.',
      },
    ],
  },
  {
    title: 'Custom',
    items: [{ label: 'Custom command', icon: 'terminal', data: '{value}', fields: [{ key: 'value', label: 'Command text' }] }],
  },
];

// MiCODUS MV710G (JT808 protocol): commands from the MV710G user manual, sent as text messages
const micodusGroups = [
  {
    title: 'Fuel / engine (relay)',
    items: [
      { label: 'Cut off fuel now', icon: 'power-settings-new', data: 'RELAY,1#', danger: true, note: 'Stops the engine at once. Use only when the vehicle is safe to stop.' },
      { label: 'Cut off fuel safely', icon: 'shield', data: 'RELAY,2#', danger: true, note: 'Cuts only when the vehicle is slower than 20 km/h (or parked without GPS).' },
      { label: 'Restore fuel', icon: 'play-circle-outline', data: 'RELAY,0#' },
    ],
  },
  {
    title: 'Data upload',
    items: [
      {
        label: 'Upload interval',
        icon: 'timer',
        data: 'TIMER,{moving},{parked}#',
        fields: [
          { key: 'moving', label: 'While ACC is ON (seconds)', initial: '10', numeric: true },
          { key: 'parked', label: 'While ACC is OFF (seconds)', initial: '300', numeric: true },
        ],
      },
      { label: 'Real-time mode (10 s / 5 min)', icon: 'bolt', data: 'TIMER,10,300#' },
    ],
  },
  {
    title: 'Alarms',
    items: [
      {
        label: 'Overspeed alarm ON',
        icon: 'speed',
        data: 'SPEED,ON,{kmh},{method}#',
        fields: [
          { key: 'kmh', label: 'Speed limit (km/h)', initial: '100', numeric: true, min: 10, max: 250 },
          { key: 'method', label: 'Alert method (manual: 0 platform, 1 + SMS)', initial: '1', numeric: true, min: 0, max: 2 },
        ],
      },
      { label: 'Overspeed alarm OFF', icon: 'speed', data: 'SPEED,OFF#' },
    ],
  },
  {
    title: 'Phone numbers',
    items: [
      { label: 'Center number (controls the tracker by SMS)', icon: 'contact-phone', data: 'CENTER,A,{value}#', fields: [{ key: 'value', label: 'Mobile number', phone: true }] },
      {
        label: 'SOS numbers (up to 3)',
        icon: 'sos',
        data: 'SOS,A,{sos1},{sos2},{sos3}#',
        fields: [
          { key: 'sos1', label: 'SOS number 1', phone: true },
          { key: 'sos2', label: 'SOS number 2 (optional)', phone: true, optional: true },
          { key: 'sos3', label: 'SOS number 3 (optional)', phone: true, optional: true },
        ],
        build: (v) => `SOS,A,${[v.sos1, v.sos2, v.sos3].map((n) => (n || '').trim()).filter(Boolean).join(',')}#`,
      },
    ],
  },
  {
    title: 'Device',
    items: [
      { label: 'Status (relay, alarm, arm state)', icon: 'info-outline', data: 'STATUS#' },
      { label: 'Parameters (timer, numbers)', icon: 'tune', data: 'PARAM#' },
      { label: 'Time zone GMT+5 (Pakistan)', icon: 'schedule', data: 'GMT,E,5#' },
      { label: 'Restart tracker', icon: 'restart-alt', type: 'rebootDevice' },
    ],
  },
  {
    title: 'Custom',
    items: [{ label: 'Custom command', icon: 'terminal', data: '{value}', fields: [{ key: 'value', label: 'Command text' }] }],
  },
];

// which command list a tracker gets, from its model in the vehicle settings
export const isMicodus = (device) => /micodus|^mv\d|^ml\d/i.test(device?.model || '');

export default function Commands() {
  const { id } = useLocalSearchParams();
  const deviceId = Number(id);
  const { devices, events } = useApp();
  const insets = useSafeAreaInsets();
  const device = devices[deviceId];
  const [selected, setSelected] = useState(null);
  const [values, setValues] = useState({});
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);
  const [history, setHistory] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [supported, setSupported] = useState(null); // command types the server can send to this tracker
  const groups = isMicodus(device) ? micodusGroups : gt06Groups;

  useEffect(() => {
    api(`api/commands/types?deviceId=${deviceId}`)
      .then((list) => setSupported(new Set(list.map((t) => t.type))))
      .catch(() => setSupported(null));
  }, [deviceId]);
  const isSupported = (item) => !item.type || !supported || supported.has(item.type);

  const loadReplies = () => {
    const from = new Date(Date.now() - 3 * 864e5).toISOString();
    api(`api/reports/events?deviceId=${deviceId}&type=commandResult&from=${from}&to=${new Date(Date.now() + 60000).toISOString()}`)
      .then((result) => setHistory(result.sort((a, b) => new Date(b.eventTime) - new Date(a.eventTime))))
      .catch(() => {});
  };
  useEffect(loadReplies, [deviceId, events.length]);

  const open = (item) => {
    if (!isSupported(item)) {
      setMessage(null);
      Alert.alert(item.label, 'Not supported by this tracker.');
      return;
    }
    setValues(Object.fromEntries((item.fields || []).map((f) => [f.key, f.initial || ''])));
    setMessage(null);
    setSelected(item);
  };

  const text = selected?.build
    ? selected.build(values)
    : selected?.data
      ? (selected.fields || []).reduce((t, f) => t.replace(`{${f.key}}`, (values[f.key] || '').trim()), selected.data)
      : null;

  const problem = (() => {
    if (!selected) return null;
    const empty = (selected.fields || []).find((f) => !f.optional && !(values[f.key] || '').trim());
    if (empty) return `Enter ${empty.label.toLowerCase()}`;
    const bad = (selected.fields || []).find((f) => {
      if (!f.numeric) return false;
      const n = Number(values[f.key]);
      return !Number.isInteger(n) || n < (f.min ?? 5) || n > (f.max ?? 18000);
    });
    return bad ? `${bad.label}: a whole number from ${bad.min ?? 5} to ${bad.max ?? 18000}` : null;
  })();

  const sendGprs = async () => {
    setSending(true);
    try {
      const body = selected.type
        ? { deviceId, type: selected.type, attributes: {} }
        : { deviceId, type: 'custom', attributes: { data: text } };
      await apiJson('api/commands/send', 'POST', body);
      setMessage({
        ok: true,
        text:
          device?.status !== 'online'
            ? 'Tracker offline: command queued, it is sent when the tracker connects.'
            : 'Sent to the tracker. The reply appears under Tracker replies.',
      });
      setTimeout(loadReplies, 4000);
    } catch (error) {
      setMessage({ ok: false, text: String(error.message || error) });
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 32 + insets.bottom }}>
        <View style={styles.deviceRow}>
          <View style={[styles.dot, { backgroundColor: device?.status === 'online' ? colors.moving : colors.inactive }]} />
          <Text style={styles.subtitle}>{`${device?.name || ''} • ${device?.status === 'online' ? 'Online' : 'Offline'}${device?.model ? ` • ${device.model}` : ''}`}</Text>
        </View>
        {groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.items.map((item, index) => (
              <Pressable
                key={item.label}
                style={[styles.item, index === group.items.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => open(item)}
                android_ripple={{ color: colors.border }}
              >
                <View style={[styles.itemIcon, { backgroundColor: !isSupported(item) ? colors.inactive : item.danger ? colors.offline : colors.teal }]}>
                  <MaterialIcons name={item.icon} size={20} color="#FFF" />
                </View>
                <View style={{ flex: 1, opacity: isSupported(item) ? 1 : 0.5 }}>
                  <Text style={[styles.itemText, item.danger && { color: colors.offline }]}>{item.label}</Text>
                  {!isSupported(item) ? (
                    <Text style={styles.itemCode}>Not supported by this tracker</Text>
                  ) : item.data && !item.fields ? (
                    <Text style={styles.itemCode}>{item.data}</Text>
                  ) : null}
                </View>
                <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
              </Pressable>
            ))}
          </View>
        ))}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Tracker replies</Text>
          {history.length === 0 && <Text style={styles.empty}>No replies yet.</Text>}
          {history.slice(0, showAll ? 50 : 5).map((reply) => (
            <View key={reply.id} style={styles.reply}>
              <Text style={styles.replyTime}>{formatDateTime(reply.eventTime)}</Text>
              <Text style={styles.replyText}>{reply.attributes?.result}</Text>
            </View>
          ))}
          {history.length > 5 && (
            <Pressable style={styles.more} onPress={() => setShowAll(!showAll)}>
              <Text style={styles.moreText}>{showAll ? 'Show less' : `More (${history.length - 5})`}</Text>
              <MaterialIcons name={showAll ? 'expand-less' : 'expand-more'} size={20} color={colors.teal} />
            </Pressable>
          )}
        </View>
      </ScrollView>

      <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={() => setSelected(null)} />
          {selected && (
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.grabber} />
              <Text style={[styles.sheetTitle, selected.danger && { color: colors.offline }]}>{selected.label}</Text>
              {selected.danger && (
                <Text style={styles.warning}>Stops the engine. Use only when the vehicle is safe to stop.</Text>
              )}
              {(selected.fields || []).map((field, index) => (
                <View key={field.key} style={{ marginTop: 12 }}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <TextInput
                    style={styles.input}
                    autoFocus={index === 0}
                    keyboardType={field.numeric ? 'number-pad' : field.phone ? 'phone-pad' : 'default'}
                    autoCapitalize="none"
                    value={values[field.key] ?? ''}
                    onChangeText={(value) => setValues({ ...values, [field.key]: value })}
                    placeholder={field.label}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              ))}
              {text ? (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Command</Text>
                  <Text style={styles.code}>{text}</Text>
                </>
              ) : null}
              {selected.note ? <Text style={styles.note}>{selected.note}</Text> : null}
              {problem ? <Text style={[styles.note, { color: colors.offline }]}>{problem}</Text> : null}
              {message ? (
                <Text style={[styles.result, { color: message.ok ? colors.moving : colors.offline }]}>{message.text}</Text>
              ) : null}
              <View style={styles.buttons}>
                <Button
                  title={message?.ok ? 'Send again' : 'Send'}
                  icon="send"
                  color={selected.danger ? colors.offline : colors.teal}
                  style={{ flex: 1 }}
                  loading={sending}
                  disabled={Boolean(problem)}
                  onPress={sendGprs}
                />
                {text && device?.phone ? (
                  <Button
                    title="By SMS"
                    icon="sms"
                    outline
                    style={{ flex: 1 }}
                    disabled={Boolean(problem)}
                    onPress={() => Linking.openURL(`sms:${device.phone}?body=${encodeURIComponent(text)}`)}
                  />
                ) : null}
              </View>
              <Button title="Close" outline color={colors.muted} style={{ marginTop: 8 }} onPress={() => setSelected(null)} />
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  deviceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  subtitle: { color: colors.muted, fontWeight: '600' },
  group: { backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', paddingBottom: 2 },
  groupTitle: { fontSize: 16, fontWeight: '800', color: colors.text, margin: 14, marginBottom: 6, paddingLeft: 8, borderLeftWidth: 3, borderLeftColor: colors.teal },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.background },
  itemIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 15, fontWeight: '600', color: colors.text },
  itemCode: { fontSize: 12, color: '#94A3B8', fontFamily: 'monospace', marginTop: 2 },
  empty: { color: colors.muted, paddingHorizontal: 16, paddingBottom: 14 },
  reply: { paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.background },
  replyTime: { fontSize: 12, color: colors.muted },
  replyText: { fontSize: 14, color: colors.text, fontFamily: 'monospace', marginTop: 2 },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.background },
  moreText: { color: colors.teal, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 26 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  warning: { marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: '#FEE2E2', color: colors.offline, fontWeight: '600' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text },
  code: { fontFamily: 'monospace', fontWeight: '700', fontSize: 15, color: colors.text, backgroundColor: colors.subtle, borderRadius: 8, padding: 10 },
  note: { marginTop: 10, fontSize: 13, color: colors.muted },
  result: { marginTop: 10, fontSize: 14, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 16 },
});
