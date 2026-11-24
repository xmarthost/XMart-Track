import { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../state/status';
import { logInfo, logWarn } from '../state/log';
import { Button } from './ui';

// Every APK build publishes update.json and XMartTrack.apk on the "android-latest" GitHub release.
const RELEASE = 'https://github.com/xmarthost/XMart-Track/releases/download/android-latest';
const INSTALL_FLAGS = 0x10000000 | 0x00000001; // FLAG_ACTIVITY_NEW_TASK | FLAG_GRANT_READ_URI_PERMISSION

const currentBuild = () => Number(Constants.expoConfig?.android?.versionCode || 0);

// plain text only: no links, no technical trailer lines
const cleanNotes = (notes) =>
  (Array.isArray(notes) ? notes : [])
    .map((line) => String(line).replace(/https?:\/\/\S+/g, '').trim())
    .filter((line) => line && !/^(co-authored-by|claude-session|signed-off-by)/i.test(line))
    .slice(0, 8);

const fetchUpdate = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${RELEASE}/update.json?t=${Date.now()}`, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return null;
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

// Checks GitHub for a newer app build when the app opens and offers to download and install it.
export default function UpdatePrompt() {
  const [update, setUpdate] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUpdate()
      .then((info) => {
        const build = Number(info?.versionCode || 0);
        logInfo('update', `installed build ${currentBuild()}, latest ${build || 'unknown'}`);
        if (build > currentBuild() && currentBuild() > 0) setUpdate({ ...info, versionCode: build });
      })
      .catch((e) => logWarn('update', `check failed: ${e.message || e}`));
  }, []);

  const install = async () => {
    setError(null);
    setProgress(0);
    try {
      const target = `${FileSystem.cacheDirectory}XMartTrack-${update.versionCode}.apk`;
      await FileSystem.deleteAsync(target, { idempotent: true });
      const task = FileSystem.createDownloadResumable(`${RELEASE}/XMartTrack.apk`, target, {}, (p) => {
        if (p.totalBytesExpectedToWrite > 0) setProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
      });
      const result = await task.downloadAsync();
      if (!result || result.status !== 200) throw new Error(`download failed (${result?.status})`);
      const uri = await FileSystem.getContentUriAsync(result.uri);
      setProgress(null);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: uri,
        type: 'application/vnd.android.package-archive',
        flags: INSTALL_FLAGS,
      });
    } catch (e) {
      logWarn('update', `install failed: ${e.message || e}`);
      setProgress(null);
      setError('Download failed. Check the internet connection and try again.');
    }
  };

  if (!update) return null;
  const notes = cleanNotes(update.notes);
  const downloading = progress !== null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => !downloading && setUpdate(null)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#FFF', borderRadius: 18, padding: 20, maxHeight: '80%' }}>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.teal,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name="system-update" size={30} color="#FFF" />
            </View>
            <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text, marginTop: 10 }}>
              New version released
            </Text>
            <Text style={{ color: colors.muted, marginTop: 2 }}>Version {update.versionCode}</Text>
          </View>
          {notes.length > 0 && (
            <>
              <Text style={{ fontWeight: '700', color: colors.text, marginBottom: 6 }}>What&apos;s new</Text>
              <ScrollView style={{ maxHeight: 220 }}>
                {notes.map((line, index) => (
                  <View key={index} style={{ flexDirection: 'row', marginBottom: 6 }}>
                    <Text style={{ color: colors.teal, marginRight: 8 }}>•</Text>
                    <Text style={{ flex: 1, color: colors.muted, lineHeight: 20 }}>{line}</Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
          {downloading && (
            <View style={{ marginTop: 12 }}>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}>
                <View style={{ height: 8, width: `${Math.round(progress * 100)}%`, backgroundColor: colors.teal }} />
              </View>
              <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'center' }}>
                Downloading {Math.round(progress * 100)}%
              </Text>
            </View>
          )}
          {error && <Text style={{ color: colors.offline, marginTop: 10, textAlign: 'center' }}>{error}</Text>}
          <Button
            title={downloading ? 'Downloading…' : 'Update now'}
            icon="download"
            loading={downloading}
            style={{ marginTop: 16 }}
            onPress={install}
          />
          {!downloading && (
            <Button title="Later" outline style={{ marginTop: 10 }} onPress={() => setUpdate(null)} />
          )}
        </View>
      </View>
    </Modal>
  );
}
