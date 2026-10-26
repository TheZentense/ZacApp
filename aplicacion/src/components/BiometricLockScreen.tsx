import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { useSession } from '@/context/SessionContext';
import { colors, radius, spacing } from '@/theme/tokens';

export function BiometricLockScreen({ embedded = false }: { embedded?: boolean }) {
  const { isLoading, isUnlocking, biometricEnabled, unlockWithBiometrics, unlockWithPassword, signOut } = useSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const unlock = async (method: 'biometric' | 'password') => {
    setError('');
    try {
      if (method === 'biometric') await unlockWithBiometrics();
      else {
        await unlockWithPassword(password);
        setPassword('');
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (/invalid login credentials/i.test(message)) setError('La contraseña no es correcta.');
      else if (/failed to fetch|network/i.test(message)) setError('No fue posible conectar con Supabase. Revisa tu conexión.');
      else setError(message || 'No fue posible desbloquear ZacApp.');
    }
  };

  return (
    <KeyboardAvoidingView style={embedded ? styles.embeddedPage : styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        {isLoading ? <ActivityIndicator color={colors.primary} size="large" /> : <>
          <Text style={styles.title}>ZacApp bloqueada</Text>
          <Text style={styles.copy}>Verifica tu identidad para continuar con la sesión guardada en este dispositivo.</Text>
          {biometricEnabled && <AppButton label={isUnlocking ? 'Verificando...' : 'Desbloquear con biometría'} icon="finger-print-outline" disabled={isUnlocking} onPress={() => { void unlock('biometric'); }} />}
          <Text style={styles.label}>Contraseña de la cuenta</Text>
          <TextInput accessibilityLabel="Contraseña de la cuenta" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="off" editable={!isUnlocking} style={styles.input} placeholder="Contraseña" placeholderTextColor={colors.muted} onSubmitEditing={() => { void unlock('password'); }} />
          <AppButton label={isUnlocking ? 'Verificando...' : 'Ingresar con contraseña'} icon="key-outline" disabled={isUnlocking || !password} onPress={() => { void unlock('password'); }} />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <AppButton label="Cambiar de cuenta" variant="ghost" icon="log-out-outline" disabled={isUnlocking} onPress={() => { void signOut(); }} />
        </>}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, zIndex: 100 },
  embeddedPage: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 440, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 25, fontWeight: '800', color: colors.text },
  copy: { color: colors.secondary, lineHeight: 21 },
  label: { color: colors.text, fontWeight: '700' },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.text },
  error: { color: colors.danger, fontWeight: '700' }
});
