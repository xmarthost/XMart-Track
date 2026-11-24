import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { api, apiJson } from '../api/server';
import { useApp } from '../state/AppState';
import { colors } from '../state/status';
import { Button, Card, Field, SwitchRow, ui } from '../components/ui';

// Same rules as the web page "SMS & WhatsApp", so both stay in sync.
const alertTypes = [
  { key: 'accOn', types: ['ignitionOn'], label: 'ACC ON (vehicle started)' },
  { key: 'accOff', types: ['ignitionOff'], label: 'ACC OFF (vehicle stopped)' },
  { key: 'overspeed', types: ['deviceOverspeed'], label: 'Overspeed' },
  { key: 'geofence', types: ['geofenceEnter', 'geofenceExit'], label: 'Geofence enter / exit' },
  { key: 'alarm', types: ['alarm'], label: 'Alarms (SOS, power cut, …)' },
  { key: 'offline', types: ['deviceOffline'], label: 'Device offline' },
];
const WHATSAPP = 'xmwhatsapp';
const PUSH = 'firebase';
const split = (value) =>
  (value || '')
    .split(/[,;\s]+/)
    .map((it) => it.trim())
    .filter(Boolean);
const notificatorList = (n) => (n.notificators || '').split(',');
const isManaged = (n) => Boolean(n.attributes?.xmSms);

export default function AlertSettings() {
  const { user, setUser } = useApp();
  const [sms, setSms] = useState(split(user?.phone).join(', '));
  const [whatsapp, setWhatsapp] = useState(split(user?.attributes?.['xm.whatsappNumbers']).join(', '));
  const [notifications, setNotifications] = useState([]);
  const [enabled, setEnabled] = useState({});
  const [channels, setChannels] = useState({ sms: true, whatsapp: true, push: true });
  const [available, setAvailable] = useState({ sms: true, whatsapp: true, push: false });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);

  useEffect(() => {
    Promise.all([api('api/notifications'), api('api/notifications/notificators')])
      .then(([items, notificatorItems]) => {
        const types = notificatorItems.map((it) => it.type);
        setNotifications(items);
        setAvailable({ sms: types.includes('sms'), whatsapp: types.includes(WHATSAPP), push: types.includes(PUSH) });
        const state = {};
        alertTypes.forEach((alert) => {
          state[alert.key] = alert.types.every((type) =>
            items.some((n) => n.type === type && ['sms', WHATSAPP, PUSH].some((c) => notificatorList(n).includes(c))),
          );
        });
        setEnabled(state);
        const managed = items.filter(isManaged);
        if (managed.length) {
          setChannels({
            sms: managed.some((n) => notificatorList(n).includes('sms')),
            whatsapp: managed.some((n) => notificatorList(n).includes(WHATSAPP)),
            push: managed.some((n) => notificatorList(n).includes(PUSH)) || !managed.length,
          });
        }
      })
      .catch((error) => Alert.alert('Could not load alerts', String(error.message || error)));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const phone = split(sms).join(',');
      const wa = split(whatsapp).join(',');
      if (phone !== (user.phone || '') || wa !== (user.attributes?.['xm.whatsappNumbers'] || '')) {
        const attributes = { ...user.attributes };
        if (wa) attributes['xm.whatsappNumbers'] = wa;
        else delete attributes['xm.whatsappNumbers'];
        setUser(await apiJson(`api/users/${user.id}`, 'PUT', { ...user, phone: phone || null, attributes }));
      }
      const wanted = ['web'];
      if (channels.sms && available.sms) wanted.push('sms');
      if (channels.whatsapp && available.whatsapp) wanted.push(WHATSAPP);
      if (channels.push && available.push) wanted.push(PUSH);
      const notificators = wanted.join(',');
      const updated = [...notifications];
      for (const alert of alertTypes) {
        for (const type of alert.types) {
          const existing = updated.find((n) => n.type === type && isManaged(n));
          const on = enabled[alert.key] && wanted.length > 1;
          if (on && !existing) {
            updated.push(
              await apiJson('api/notifications', 'POST', { type, always: true, notificators, attributes: { xmSms: true } }),
            );
          } else if (on && existing && existing.notificators !== notificators) {
            updated[updated.indexOf(existing)] = await apiJson(`api/notifications/${existing.id}`, 'PUT', {
              ...existing,
              notificators,
            });
          } else if (!on && existing) {
            await apiJson(`api/notifications/${existing.id}`, 'DELETE');
            updated.splice(updated.indexOf(existing), 1);
          }
        }
      }
      setNotifications(updated);
      Alert.alert('Saved', 'Alert settings saved.');
    } catch (error) {
      Alert.alert('Save failed', String(error.message || error));
    } finally {
      setSaving(false);
    }
  };

  const test = async (notificator) => {
    setTesting(notificator);
    try {
      await apiJson(`api/notifications/test/${notificator}`, 'POST');
      Alert.alert('Test sent', 'Check your phone for the test message.');
    } catch (error) {
      Alert.alert('Test failed', String(error.message || error));
    } finally {
      setTesting(null);
    }
  };

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Card title="Push notifications" subtitle="Alerts on this phone with sound, even when the app is closed.">
        <SwitchRow
          label="Send alerts to the app"
          value={channels.push && available.push}
          disabled={!available.push}
          onValueChange={(value) => setChannels({ ...channels, push: value })}
        />
        {!available.push && (
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
            Not enabled on the server yet: run the server update after adding the Firebase key.
          </Text>
        )}
        <Button
          title="Send push test"
          icon="notifications-active"
          outline
          style={{ marginTop: 10 }}
          disabled={!available.push}
          loading={testing === PUSH}
          onPress={() => test(PUSH)}
        />
      </Card>
      <Card title="WhatsApp" subtitle="Alerts with a Google Maps link through XMart Sender.">
        <SwitchRow
          label="Send alerts on WhatsApp"
          value={channels.whatsapp && available.whatsapp}
          disabled={!available.whatsapp}
          onValueChange={(value) => setChannels({ ...channels, whatsapp: value })}
        />
        <Field
          label="WhatsApp numbers"
          value={whatsapp}
          onChangeText={setWhatsapp}
          placeholder="923001234567, 923331234567"
          keyboardType="phone-pad"
          help="Country code without +, separate several numbers with commas."
        />
        <Button title="Send WhatsApp test" icon="send" outline style={{ marginTop: 10 }} loading={testing === WHATSAPP} onPress={() => test(WHATSAPP)} />
      </Card>
      <Card title="SMS" subtitle="Server SMS gateway (set by the admin on the website).">
        <SwitchRow
          label="Send alerts by SMS"
          value={channels.sms && available.sms}
          disabled={!available.sms}
          onValueChange={(value) => setChannels({ ...channels, sms: value })}
        />
        <Field
          label="SMS numbers"
          value={sms}
          onChangeText={setSms}
          placeholder="03001234567, 03331234567"
          keyboardType="phone-pad"
          help="Separate several numbers with commas."
        />
        <Button title="Send SMS test" icon="sms" outline style={{ marginTop: 10 }} loading={testing === 'sms'} onPress={() => test('sms')} />
      </Card>
      <Card title="Which alerts">
        {alertTypes.map((alert) => (
          <SwitchRow
            key={alert.key}
            label={alert.label}
            value={Boolean(enabled[alert.key])}
            onValueChange={(value) => setEnabled({ ...enabled, [alert.key]: value })}
          />
        ))}
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
          In-app alerts always show; these switches control SMS and WhatsApp.
        </Text>
      </Card>
      <Button title="Save" icon="check" loading={saving} onPress={save} />
    </ScrollView>
  );
}
