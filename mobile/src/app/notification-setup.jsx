import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, ScrollView, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { colors } from '../state/status';
import { apiJson } from '../api/server';
import { notificationSetupStatus } from '../state/push';
import { Button, Card, ui, useContentStyle } from '../components/ui';

const PACKAGE = Constants.expoConfig?.android?.package || 'site.xmarttrack.app';

const open = async (action, params) => {
  try {
    await IntentLauncher.startActivityAsync(action, params);
    return true;
  } catch {
    return false;
  }
};

// Steps that let alerts arrive with sound while the app is closed (Android cannot turn these on
// for an app; each button opens the right settings page).
export default function NotificationSetup() {
  const contentStyle = useContentStyle();
  const [status, setStatus] = useState({ permission: false, battery: false });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const refresh = useCallback(() => {
    notificationSetupStatus().then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    // re-check when the user comes back from a settings page
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => subscription.remove();
  }, [refresh]);

  const allowNotifications = async () => {
    const { status: result, canAskAgain } = await Notifications.requestPermissionsAsync();
    if (result !== 'granted' && !canAskAgain) {
      await open(IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS, {
        extra: { 'android.provider.extra.APP_PACKAGE': PACKAGE },
      });
    }
    refresh();
  };

  const noBatteryLimits = async () => {
    const ok = await open(IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, {
      data: `package:${PACKAGE}`,
    });
    if (!ok) await open(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
  };

  const autostart = async () => {
    // Xiaomi / Redmi / POCO autostart screen; other phones: app info page
    const ok = await open('android.intent.action.MAIN', {
      packageName: 'com.miui.securitycenter',
      className: 'com.miui.permcenter.autostart.AutoStartManagementActivity',
    });
    if (!ok) Linking.openSettings();
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await apiJson('api/notifications/test/firebase', 'POST');
      setTestResult({ ok: true, text: 'Sent. Close the app now to see that it still rings.' });
    } catch (error) {
      setTestResult({ ok: false, text: String(error.message || error) });
    } finally {
      setTesting(false);
    }
  };

  const Step = ({ number, title, text, done, action, buttonTitle, unknown }) => (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: done ? colors.moving : unknown ? colors.amber : colors.offline,
          }}
        >
          {done ? (
            <MaterialIcons name="check" size={18} color="#FFF" />
          ) : (
            <Text style={{ color: '#FFF', fontWeight: '800' }}>{number}</Text>
          )}
        </View>
        <Text style={[ui.cardTitle, { flex: 1 }]}>{title}</Text>
        <Text style={{ fontWeight: '700', color: done ? colors.moving : unknown ? colors.amber : colors.offline }}>
          {done ? 'Done' : unknown ? 'Check' : 'Needed'}
        </Text>
      </View>
      <Text style={[ui.cardSubtitle, { marginTop: 8 }]}>{text}</Text>
      {!done && <Button title={buttonTitle} icon="open-in-new" style={{ marginTop: 12 }} onPress={action} />}
    </Card>
  );

  return (
    <ScrollView style={ui.screen} contentContainerStyle={contentStyle}>
      <Text style={{ color: colors.muted, textAlign: 'center' }}>
        So that ACC, alarm and geofence alerts ring even when XMart Track is closed.
      </Text>
      <Step
        number={1}
        title="Allow notifications"
        text="Lets XMart Track show alerts with sound."
        done={status.permission}
        action={allowNotifications}
        buttonTitle="Allow notifications"
      />
      <Step
        number={2}
        title="Battery: No restrictions"
        text="Stops Android from holding back alerts while the app is closed. Choose Allow / No restrictions."
        done={status.battery}
        action={noBatteryLimits}
        buttonTitle="Open battery setting"
      />
      <Step
        number={3}
        title="Autostart (Xiaomi, Redmi, POCO)"
        text="Turn on Autostart for XMart Track. Android cannot report this setting, so check it once."
        unknown
        action={autostart}
        buttonTitle="Open autostart"
      />
      <Card title="Test" subtitle="Sends a test alert to this phone through the server.">
        <Button title="Send test notification" icon="notifications-active" style={{ marginTop: 10 }} loading={testing} onPress={test} />
        {testResult && (
          <Text style={{ marginTop: 10, fontWeight: '700', color: testResult.ok ? colors.moving : colors.offline }}>
            {testResult.text}
          </Text>
        )}
      </Card>
    </ScrollView>
  );
}
