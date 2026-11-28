import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Alert, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { api, apiJson, getBase } from '../api/server';
import { useApp } from '../state/AppState';
import { colors, formatDateTime } from '../state/status';
import { ICON_COLOR_KEY, ICON_KEY, STATUS_COLOR, fixedColors, iconColors, vehicleImages, vehicleTypes } from '../state/vehicleLook';
import { Button, Card, Chips, Code, Empty, Field, SwitchRow, ui, useContentStyle } from '../components/ui';

const models = [
  { value: 'WanWay G19S (Wired)', label: 'WanWay G19S', port: 5023 },
  { value: 'Concox / GT06 compatible', label: 'Concox / GT06', port: 5023 },
  { value: 'MiCODUS MV710G', label: 'MiCODUS MV710G', port: 5015, micodus: true },
  { value: 'JT808 compatible', label: 'JT808', port: 5015 },
];
const apns = [
  { value: 'jazzconnect.mobilinkworld.com', label: 'Jazz' },
  { value: 'zonginternet', label: 'Zong' },
  { value: 'internet', label: 'Telenor' },
  { value: 'ufone.internet', label: 'Ufone' },
];
const baseHost = () => getBase().replace(/^\w+:\/\//, '').split(/[/:]/)[0];
const isIp = (host) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
const blank = { id: null, name: '', uniqueId: '', phone: '', model: models[0].value, attributes: {} };
const WA_NUMBERS = 'xm.whatsappNumbers';
const WA_ALSO_ACCOUNT = 'xm.whatsappAlsoAccount';
const PARK_ALARM = 'xm.parkAlarm';
const splitNumbers = (value) =>
  (value || '')
    .split(/[,;\s]+/)
    .map((it) => it.replace(/[^0-9]/g, ''))
    .filter(Boolean);
const toEditing = (device) => ({
  ...blank,
  ...device,
  phone: device.phone || '',
  attributes: device.attributes || {},
  whatsapp: splitNumbers(device.attributes?.[WA_NUMBERS]).join(', '),
});

export default function Devices() {
  const contentStyle = useContentStyle();
  const { devices, refresh } = useApp();
  const { id: openId } = useLocalSearchParams();
  const [editing, setEditing] = useState(null);
  const [host, setHost] = useState('');
  const [apn, setApn] = useState(apns[0].value);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(null);

  useEffect(() => {
    api('api/server')
      .then((server) => setHost(server.attributes?.['xm.deviceHost'] || baseHost()))
      .catch(() => setHost(baseHost()));
  }, []);

  // opened from the vehicle card (pencil): edit that vehicle directly
  useEffect(() => {
    const device = openId && devices[Number(openId)];
    if (device) setEditing(toEditing(device));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const list = Object.values(devices).sort((a, b) => a.name.localeCompare(b.name));
  const model = models.find((m) => m.value === (added || editing)?.model) || models[0];
  // MiCODUS: SERVER,0,IP,PORT#   Concox / WanWay: SERVER,0,IP,PORT,0#
  const serverCommand = model.micodus
    ? `SERVER,${isIp(host) ? 0 : 1},${host},${model.port}#`
    : `SERVER,${isIp(host) ? 0 : 1},${host},${model.port},0#`;

  const save = async () => {
    const imei = editing.uniqueId.trim();
    if (!editing.name.trim() || !imei) {
      Alert.alert('Device', 'Name and IMEI are required.');
      return;
    }
    if (!editing.id && !/^\d{10,17}$/.test(imei)) {
      Alert.alert('Device', 'IMEI should be 10–17 digits (printed on the tracker label).');
      return;
    }
    setSaving(true);
    try {
      const attributes = { ...(editing.attributes || {}) };
      const numbers = splitNumbers(editing.whatsapp).join(',');
      if (numbers) attributes[WA_NUMBERS] = numbers;
      else delete attributes[WA_NUMBERS];
      if (numbers && attributes[WA_ALSO_ACCOUNT]) attributes[WA_ALSO_ACCOUNT] = true;
      else delete attributes[WA_ALSO_ACCOUNT];
      if (attributes[PARK_ALARM]) attributes[PARK_ALARM] = true;
      else delete attributes[PARK_ALARM];
      if (!attributes[ICON_KEY] || attributes[ICON_KEY] === 'sedan') delete attributes[ICON_KEY];
      if (!attributes[ICON_COLOR_KEY] || attributes[ICON_COLOR_KEY] === STATUS_COLOR) delete attributes[ICON_COLOR_KEY];
      const { whatsapp, ...rest } = editing;
      const body = { ...rest, attributes, name: editing.name.trim(), uniqueId: imei, phone: editing.phone.trim() || null };
      if (!body.id) delete body.id;
      const saved = await apiJson(editing.id ? `api/devices/${editing.id}` : 'api/devices', editing.id ? 'PUT' : 'POST', body);
      await refresh().catch(() => {});
      if (!editing.id) setAdded(saved);
      setEditing(null);
    } catch (error) {
      Alert.alert('Save failed', String(error.message || error));
    } finally {
      setSaving(false);
    }
  };

  const remove = (device) =>
    Alert.alert('Delete device', `Delete ${device.name}? Its history is deleted too.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiJson(`api/devices/${device.id}`, 'DELETE');
            await refresh().catch(() => {});
            setEditing(null);
          } catch (error) {
            Alert.alert('Delete failed', String(error.message || error));
          }
        },
      },
    ]);

  const sms = (phone, text) => Linking.openURL(`sms:${phone || ''}?body=${encodeURIComponent(text)}`);

  const setupCard = (device) => (
    <Card title="Tracker setup by SMS" subtitle="Send these from your phone to the SIM inside the tracker, one by one.">
      <Field label="Server address (IP works on every tracker)" value={host} onChangeText={setHost} autoCapitalize="none" />
      <Text style={[ui.label, { marginTop: 12 }]}>1. Point the tracker to this server</Text>
      <Code>{serverCommand}</Code>
      <Button title="Send by SMS" icon="sms" outline style={{ marginTop: 8 }} onPress={() => sms(device?.phone, serverCommand)} />
      <Text style={[ui.label, { marginTop: 14 }]}>2. Internet (APN) of the tracker SIM</Text>
      <Chips options={apns} value={apn} onChange={setApn} />
      <Code>{`APN,${apn}#`}</Code>
      <Button title="Send by SMS" icon="sms" outline style={{ marginTop: 8 }} onPress={() => sms(device?.phone, `APN,${apn}#`)} />
      <Text style={[ui.label, { marginTop: 14 }]}>3. Real-time updates (10 s driving, 5 min parked)</Text>
      <Code>TIMER,10,300#</Code>
      <Button title="Send by SMS" icon="sms" outline style={{ marginTop: 8 }} onPress={() => sms(device?.phone, 'TIMER,10,300#')} />
      <Text style={[ui.help, { marginTop: 10 }]}>
        The tracker replies "SERVER OK" / "APN OK". It shows online here within a minute.
      </Text>
    </Card>
  );

  if (editing) {
    return (
      <ScrollView style={ui.screen} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
        <Card title={editing.id ? 'Edit device' : 'Add device'}>
          <Field label="Vehicle name" value={editing.name} onChangeText={(name) => setEditing({ ...editing, name })} placeholder="LEA-19-961" />
          <Field
            label="IMEI"
            value={editing.uniqueId}
            onChangeText={(uniqueId) => setEditing({ ...editing, uniqueId })}
            keyboardType="number-pad"
            placeholder="15 digits on the tracker label"
          />
          <Field
            label="Tracker SIM number"
            value={editing.phone || ''}
            onChangeText={(phone) => setEditing({ ...editing, phone })}
            keyboardType="phone-pad"
            placeholder="03001234567"
          />
          <Text style={[ui.label, { marginTop: 12 }]}>Model</Text>
          <Chips options={models} value={editing.model || models[0].value} onChange={(value) => setEditing({ ...editing, model: value })} />
        </Card>
        <Card title="Icon on the map" subtitle="Choose the vehicle type and colour. By status = green moving, blue parked, red offline.">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {vehicleTypes.map((type) => {
              const active = (editing.attributes?.[ICON_KEY] || 'sedan') === type.key;
              const color = editing.attributes?.[ICON_COLOR_KEY];
              const shown = color && color !== STATUS_COLOR ? color : 'green';
              return (
                <Pressable
                  key={type.key}
                  onPress={() => setEditing({ ...editing, attributes: { ...editing.attributes, [ICON_KEY]: type.key } })}
                  style={{
                    width: 72,
                    alignItems: 'center',
                    paddingVertical: 6,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: active ? colors.teal : 'transparent',
                    backgroundColor: active ? colors.subtle : 'transparent',
                  }}
                >
                  <Image source={vehicleImages[`${type.key}-${shown}`]} style={{ width: 44, height: 44 }} />
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
                    {type.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[ui.label, { marginTop: 12 }]}>Colour</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            {[STATUS_COLOR, ...fixedColors].map((name) => {
              const active = (editing.attributes?.[ICON_COLOR_KEY] || STATUS_COLOR) === name;
              return (
                <Pressable
                  key={name}
                  onPress={() => setEditing({ ...editing, attributes: { ...editing.attributes, [ICON_COLOR_KEY]: name } })}
                  style={{
                    height: 34,
                    minWidth: 34,
                    paddingHorizontal: name === STATUS_COLOR ? 12 : 0,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: name === STATUS_COLOR ? colors.subtle : iconColors[name],
                    borderWidth: active ? 3 : 1,
                    borderColor: active ? colors.teal : colors.border,
                  }}
                >
                  {name === STATUS_COLOR && <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>By status</Text>}
                </Pressable>
              );
            })}
          </View>
        </Card>
        <Card
          title="WhatsApp alerts for this vehicle"
          subtitle="Alerts of this vehicle go to these numbers only (e.g. the family member who drives it). Leave empty to use the account numbers from SMS & WhatsApp alerts."
        >
          <Field
            label="WhatsApp numbers (with country code)"
            value={editing.whatsapp || ''}
            onChangeText={(whatsapp) => setEditing({ ...editing, whatsapp })}
            keyboardType="phone-pad"
            placeholder="923001234567, 923331234567"
          />
          {splitNumbers(editing.whatsapp).length > 0 && (
            <SwitchRow
              label="Also send to the account numbers"
              value={Boolean(editing.attributes?.[WA_ALSO_ACCOUNT])}
              onValueChange={(on) =>
                setEditing({ ...editing, attributes: { ...editing.attributes, [WA_ALSO_ACCOUNT]: on } })
              }
            />
          )}
          <Text style={[ui.help, { marginTop: 8 }]}>
            Which alerts are sent (ACC, overspeed, geofence, …) is chosen in Me → SMS & WhatsApp alerts.
          </Text>
        </Card>
        <Card title="Theft protection" subtitle="Alert when this vehicle moves while ACC is OFF (towing, theft at night).">
          <SwitchRow
            label="Alert if moved while ACC is OFF"
            value={Boolean(editing.attributes?.[PARK_ALARM])}
            onValueChange={(on) => setEditing({ ...editing, attributes: { ...editing.attributes, [PARK_ALARM]: on } })}
          />
          <Text style={[ui.help, { marginTop: 8 }]}>
            Sent as an alarm: keep "Alarms" switched on in Me → SMS & WhatsApp alerts. Needs the ignition (ACC) wire.
          </Text>
        </Card>
        {editing.id && setupCard(editing)}
        <Button title="Save" icon="check" loading={saving} onPress={save} />
        <Button title="Cancel" outline color={colors.muted} onPress={() => setEditing(null)} />
        {editing.id && <Button title="Delete device" icon="delete-outline" color={colors.offline} onPress={() => remove(editing)} />}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={contentStyle}>
      {added && (
        <>
          <Card title={`${added.name} added`} subtitle="Now send the setup SMS to the tracker." />
          {setupCard(added)}
          <Button title="Done" outline onPress={() => setAdded(null)} />
        </>
      )}
      <Button title="Add device by IMEI" icon="add-circle-outline" onPress={() => setEditing({ ...blank, whatsapp: '' })} />
      <Card>
        {list.length === 0 && <Empty text="No devices yet" />}
        {list.map((device) => (
          <Pressable key={device.id} style={ui.row} onPress={() => setEditing(toEditing(device))}>
            <MaterialIcons name="directions-car" size={26} color={device.status === 'online' ? colors.moving : colors.inactive} />
            <View style={{ flex: 1 }}>
              <Text style={ui.rowTitle}>{device.name}</Text>
              <Text style={ui.rowSub}>{`${device.uniqueId}${device.phone ? ` • ${device.phone}` : ''}`}</Text>
              {device.attributes?.[WA_NUMBERS] ? (
                <Text style={ui.rowSub}>{`WhatsApp: ${splitNumbers(device.attributes[WA_NUMBERS]).join(', ')}`}</Text>
              ) : null}
              <Text style={ui.rowSub}>{`${device.status} • ${formatDateTime(device.lastUpdate)}`}</Text>
            </View>
            <MaterialIcons name="edit" size={20} color="#94A3B8" />
          </Pressable>
        ))}
      </Card>
    </ScrollView>
  );
}
