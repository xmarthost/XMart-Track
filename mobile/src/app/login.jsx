import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { login, getBase } from '../api/server';
import { useApp } from '../state/AppState';
import { colors } from '../state/status';

export default function Login() {
  const { setUser } = useApp();
  const [server, setServer] = useState(getBase());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showServer, setShowServer] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const user = await login(server, email.trim(), password);
      setUser(user);
      router.replace('/(tabs)');
    } catch {
      setError('Login failed. Check email and password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="height" style={{ flex: 1, backgroundColor: colors.tealDark }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoTile}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
        </View>
        <Text style={styles.title}>
          XMart <Text style={{ color: '#7DD3DC' }}>Track</Text>
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />
          {showServer && (
            <TextInput
              style={styles.input}
              placeholder="Server"
              autoCapitalize="none"
              value={server}
              onChangeText={setServer}
            />
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={[styles.button, (!email || !password || busy) && { opacity: 0.6 }]}
            onPress={submit}
            disabled={!email || !password || busy}
          >
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Log in</Text>}
          </Pressable>
          <Pressable onPress={() => setShowServer(!showServer)}>
            <Text style={styles.link}>{showServer ? 'Hide server' : 'Change server'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoTile: {
    width: 96,
    height: 96,
    borderRadius: 26,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 76, height: 76 },
  title: { marginTop: 16, marginBottom: 24, fontSize: 28, fontWeight: '800', color: '#FFF' },
  card: { width: '100%', backgroundColor: '#FFF', borderRadius: 20, padding: 20, elevation: 6 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    color: colors.text,
    backgroundColor: colors.background,
  },
  error: { color: colors.offline, marginBottom: 8 },
  button: {
    backgroundColor: colors.teal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  link: { textAlign: 'center', color: colors.teal, marginTop: 14, fontWeight: '600' },
});
