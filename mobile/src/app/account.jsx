import { useState } from 'react';
import { Alert, Linking, ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { apiJson, getBase, logout } from '../api/server';
import { unregisterPush } from '../state/push';
import { colors } from '../state/status';
import { useApp } from '../state/AppState';
import { Button, Card, Field, ui, useContentStyle } from '../components/ui';

export default function Account() {
  const contentStyle = useContentStyle();
  const { user, setUser } = useApp();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Account', 'Name and login are required.');
      return;
    }
    if (password && password !== confirm) {
      Alert.alert('Account', 'The two passwords do not match.');
      return;
    }
    if (password && password.length < 6) {
      Alert.alert('Account', 'Use at least 6 characters for the password.');
      return;
    }
    setSaving(true);
    try {
      const body = { ...user, name: name.trim(), email: email.trim() };
      if (password) body.password = password;
      setUser(await apiJson(`api/users/${user.id}`, 'PUT', body));
      setPassword('');
      setConfirm('');
      Alert.alert('Saved', password ? 'Account and password updated.' : 'Account updated.');
    } catch (error) {
      Alert.alert('Save failed', String(error.message || error));
    } finally {
      setSaving(false);
    }
  };

  // Google Play: users can delete their account from inside the app
  const removeAccount = () =>
    Alert.alert('Delete account', 'Your account will be deleted permanently. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await unregisterPush(user).catch(() => {});
            await apiJson(`api/users/${user.id}`, 'DELETE');
            await logout();
            setUser(null);
            router.replace('/login');
            Alert.alert('Account deleted', 'Your account has been deleted.');
          } catch (error) {
            Alert.alert('Delete failed', String(error.message || error));
          }
        },
      },
    ]);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
      <Card title="Profile">
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Login (email)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      </Card>
      <Card title="Change password" subtitle="Leave empty to keep the current password.">
        <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry />
        <Field label="Repeat new password" value={confirm} onChangeText={setConfirm} secureTextEntry />
      </Card>
      <Button title="Save" icon="check" loading={saving} onPress={save} />

      <Card
        title="Delete account"
        subtitle="Deletes your login, alert numbers and settings. Vehicles and their history belong to the fleet owner and stay with them."
      >
        {user?.administrator ? (
          <Text style={[ui.help, { marginTop: 8 }]}>
            This is the administrator account of the server. It cannot be deleted from the app.
          </Text>
        ) : (
          <Button title="Delete my account" icon="delete-forever" color={colors.offline} style={{ marginTop: 10 }} onPress={removeAccount} />
        )}
        <Button title="Privacy policy" icon="policy" outline style={{ marginTop: 10 }} onPress={() => Linking.openURL(`${getBase()}/privacy.html`)} />
      </Card>
    </ScrollView>
  );
}
