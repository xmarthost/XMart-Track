import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { api, getBase } from '../../../api/server';
import { useApp } from '../../../state/AppState';
import { colors, formatDateTime } from '../../../state/status';

const groups = [
  ['Control', [
    { label: 'Engine Stop', type: 'engineStop', danger: true },
    { label: 'Engine Resume', type: 'engineResume' },
  ]],
  ['Query', [
    { label: 'Query status', data: 'status#' },
    { label: 'Query location', data: 'DW' },
    { label: 'Query parameters', data: 'PARAM#' },
    { label: 'Query ACC SMS alert', data: 'ACCALM#' },
  ]],
  ['Data upload', [
    {
      label: 'Upload interval',
      data: 'TIMER,{moving},{parked}#',
      fields: [
        { key: 'moving', label: 'While driving (seconds, 5–18000)', initial: '10', numeric: true },
        { key: 'parked', label: 'While parked / ACC off (seconds)', initial: '300', numeric: true },
      ],
      note: 'Lower = more real-time tracking, more data use. 10 s while driving is recommended.',
    },
    { label: 'Real-time mode (10 s driving / 5 min parked)', data: 'TIMER,10,300#' },
    { label: 'Battery saver (60 s driving / 30 min parked)', data: 'TIMER,60,1800#' },
  ]],
  ['Setting', [
    { label: 'Add SOS number', data: 'sos,a,{value}#', fields: [{ key: 'value', label: 'Mobile number', phone: true }] },
    { label: 'Set center number', data: 'center,a,{value}#', fields: [{ key: 'value', label: 'Mobile number', phone: true }] },
    { label: 'ACC SMS alert ON (tracker SIM)', data: 'ACCALM,ON,1#' },
    { label: 'ACC SMS alert OFF', data: 'ACCALM,OFF#' },
    { label: 'Set time zone (GMT+5)', data: 'GMT,E,5,0#' },
  ]],
  ['Map link in tracker SMS', [
    {
      label: 'Set Google link — try 1 (EURL)',
      data: 'EURL,http://maps.google.com/maps?q=#',
      note: 'Then send GPRSSET# below: the URL line should show maps.google.com. If not, use try 2.',
    },
    {
      label: 'Set Google link — try 2 (URL)',
      data: 'URL,http://maps.google.com/maps?q=#',
      note: 'Check again with GPRSSET#.',
    },
    { label: 'Get Google map link (URL#)', data: 'URL#' },
    { label: 'Show link / server settings (GPRSSET#)', data: 'GPRSSET#' },
    { label: 'Firmware version (VERSION#)', data: 'VERSION#' },
  ]],
  ['Custom', [{ label: 'Custom command', data: '{value}', fields: [{ key: 'value', label: 'Command text' }] }]],
];

export default function Commands() {
  const { id } = useLocalSearchParams();
  const deviceId = Number(id);
  const { devices, events } = useApp();
  const device = devices[deviceId];
  const [inputs, setInputs] = useState({});
  const [history, setHistory] = useState([]);

  const loadReplies = () => {
    const from = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    api(`api/reports/events?deviceId=${deviceId}&type=commandResult&from=${from}&to=${new Date(Date.now() + 60000).toISOString()}`)
      .then((result) => setHistory(result.sort((a, b) => new Date(b.eventTime) - new Date(a.eventTime))))
      .catch(() => {});
  };
  useEffect(loadReplies, [deviceId, events.length]);

  const fieldValue = (item, field) => {
    const value = inputs[`${item.label}:${field.key}`];
    return (value === undefined ? field.initial || '' : value).trim();
  };

  const send = (item) => {
    const missing = (item.fields || []).find((field) => !fieldValue(item, field));
    if (missing) {
      Alert.alert(item.label, `Enter ${missing.label.toLowerCase()} first.`);
      return;
    }
    const badNumber = (item.fields || []).find((field) => {
      if (!field.numeric) return false;
      const n = Number(fieldValue(item, field));
      return !Number.isInteger(n) || n < 5 || n > 18000;
    });
    if (badNumber) {
      Alert.alert(item.label, 'Seconds must be a whole number between 5 and 18000.');
      return;
    }
    const text = item.data
      ? (item.fields || []).reduce((result, field) => result.replace(`{${field.key}}`, fieldValue(item, field)), item.data)
      : null;
    const run = async () => {
      try {
        const body = item.type
          ? { deviceId, type: item.type, attributes: {} }
          : { deviceId, type: 'custom', attributes: { data: text } };
        const response = await fetch(`${getBase()}/api/commands/send`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(await response.text());
        Alert.alert('Sent', response.status === 202 ? 'Tracker offline: command queued.' : 'Command sent to tracker.');
        setTimeout(loadReplies, 4000);
      } catch (error) {
        Alert.alert('Failed', String(error.message || error));
      }
    };
    const buttons = [{ text: 'Cancel', style: 'cancel' }];
    if (text && device?.phone) {
      buttons.push({ text: 'Send SMS', onPress: () => Linking.openURL(`sms:${device.phone}?body=${encodeURIComponent(text)}`) });
    }
    buttons.push({ text: 'Send', style: item.danger ? 'destructive' : 'default', onPress: run });
    Alert.alert(item.label, item.danger ? 'Stop the engine? Use only when the vehicle is safe to stop.' : text || item.label, buttons);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 12, gap: 12 }}>
      <Text style={styles.subtitle}>{`${device?.name || ''} • ${device?.status === 'online' ? 'Online' : 'Offline'}`}</Text>
      {groups.map(([title, items]) => (
        <View key={title} style={styles.group}>
          <Text style={styles.groupTitle}>{title}</Text>
          {items.map((item) => (
            <View key={item.label}>
              <Pressable style={styles.item} onPress={() => send(item)} android_ripple={{ color: '#E2E8F0' }}>
                <Text style={[styles.itemText, item.danger && { color: colors.offline }]}>{item.label}</Text>
                <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
              </Pressable>
              {(item.fields || []).map((field) => (
                <View key={field.key} style={styles.field}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={field.label}
                    keyboardType={field.numeric ? 'number-pad' : field.phone ? 'phone-pad' : 'default'}
                    value={inputs[`${item.label}:${field.key}`] ?? field.initial ?? ''}
                    onChangeText={(value) => setInputs({ ...inputs, [`${item.label}:${field.key}`]: value })}
                  />
                </View>
              ))}
              {item.note && <Text style={styles.note}>{item.note}</Text>}
            </View>
          ))}
        </View>
      ))}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>Tracker replies</Text>
        {history.length === 0 && <Text style={styles.empty}>No replies yet.</Text>}
        {history.slice(0, 20).map((reply) => (
          <View key={reply.id} style={styles.reply}>
            <Text style={styles.replyTime}>{formatDateTime(reply.eventTime)}</Text>
            <Text style={styles.replyText}>{reply.attributes?.result}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  subtitle: { textAlign: 'center', color: colors.muted, fontWeight: '500' },
  group: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', paddingBottom: 4 },
  groupTitle: { fontSize: 16, fontWeight: '700', color: colors.text, margin: 14, marginBottom: 4, paddingLeft: 8, borderLeftWidth: 3, borderLeftColor: colors.teal },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.background },
  itemText: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.muted },
  field: { marginTop: 2 },
  fieldLabel: { marginHorizontal: 16, marginBottom: 4, fontSize: 12, color: colors.muted, fontWeight: '600' },
  note: { marginHorizontal: 16, marginBottom: 10, fontSize: 12, color: colors.muted },
  input: { marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  empty: { color: colors.muted, paddingHorizontal: 16, paddingBottom: 12 },
  reply: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.background },
  replyTime: { fontSize: 12, color: colors.muted },
  replyText: { fontSize: 14, color: colors.text, fontFamily: 'monospace' },
});
