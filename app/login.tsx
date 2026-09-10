import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { colors, radius, spacing } from '@/theme/tokens';

export default function LoginScreen() {
  const [email, setEmail] = useState('demo@zacapp.gt');
  const [password, setPassword] = useState('demo1234');

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.brand}>
        <Text style={styles.logo}>🌵</Text>
        <Text style={styles.title}>ZacApp</Text>
        <Text style={styles.subtitle}>Reportes comunitarios de Zacapa</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Correo electrónico</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Text style={styles.label}>Contraseña</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
        <AppButton label="Ingresar al MVP" onPress={() => router.replace('/(tabs)')} />
        <Text style={styles.note}>Acceso de demostración. La conexión real con Supabase está preparada como siguiente paso.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { fontSize: 56 },
  title: { color: colors.primary, fontSize: 36, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 15 },
  card: { backgroundColor: colors.white, padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm, elevation: 3 },
  label: { color: colors.text, fontWeight: '600', marginTop: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 16 },
  note: { color: colors.muted, textAlign: 'center', fontSize: 12, marginTop: spacing.xs }
});
