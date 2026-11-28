import { useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { api, getBase } from '../api/server';
import { colors } from '../state/status';
import { logWarn } from '../state/log';
import { Button, Chips } from './ui';

const durations = [
  { value: 1, label: '1 hour' },
  { value: 8, label: '8 hours' },
  { value: 24, label: '1 day' },
  { value: 168, label: '7 days' },
];

// Live location link for people without an account (family, mechanic): opens the vehicle on the
// website, read-only, until it expires. Uses the server's device sharing (a temporary read-only user).
export default function ShareLinkModal({ device, visible, onClose }) {
  const insets = useSafeAreaInsets();
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const removeShare = () =>
    api(`api/share/device/${device.id}`, { method: 'DELETE', raw: true }).catch(() => null);

  const share = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await removeShare(); // a new link replaces the old one
      const expiration = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      const link = await api('api/share/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `deviceId=${device.id}&expiration=${encodeURIComponent(expiration)}`,
      });
      const url = `${getBase().replace(/\/+$/, '')}/share.html?token=${encodeURIComponent(link.token)}`;
      const label = durations.find((d) => d.value === hours)?.label || `${hours} hours`;
      await Share.share({ message: `${device.name} – live location (valid ${label}):\n${url}` });
      setMessage({ ok: true, text: `Link created, valid for ${label}.` });
    } catch (error) {
      logWarn('share', 'share link failed', error);
      setMessage({ ok: false, text: String(error.message || error) });
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    await removeShare();
    setBusy(false);
    setMessage({ ok: true, text: 'Sharing stopped: old links no longer open.' });
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]} onPress={() => {}}>
          <View style={styles.titleRow}>
            <MaterialIcons name="share-location" size={26} color={colors.teal} />
            <Text style={styles.title}>Share live location</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <MaterialIcons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={styles.text}>
            Anyone with the link sees {device?.name} live on the map (read-only), without an account, until the link
            expires.
          </Text>
          <Text style={styles.label}>Link valid for</Text>
          <Chips options={durations} value={hours} onChange={setHours} />
          <Button title="Create link and share" icon="share" loading={busy} style={{ marginTop: 14 }} onPress={share} />
          <Button title="Stop sharing" icon="link-off" outline color={colors.offline} style={{ marginTop: 10 }} onPress={stop} disabled={busy} />
          {message && (
            <Text style={[styles.message, { color: message.ok ? colors.moving : colors.offline }]}>{message.text}</Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  text: { color: colors.muted, marginTop: 8, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 14, marginBottom: 6 },
  message: { marginTop: 12, fontWeight: '700', textAlign: 'center' },
});
