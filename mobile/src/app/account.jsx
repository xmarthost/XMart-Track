import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { apiJson } from '../api/server';
import { useApp } from '../state/AppState';
import { Button, Card, Field, ui } from '../components/ui';

export default function Account() {
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

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Card title="Profile">
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Login (email)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      </Card>
      <Card title="Change password" subtitle="Leave empty to keep the current password.">
        <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry />
        <Field label="Repeat new password" value={confirm} onChangeText={setConfirm} secureTextEntry />
      </Card>
      <Button title="Save" icon="check" loading={saving} onPress={save} />
    </ScrollView>
  );
}
