import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { useSession } from '@/context/SessionContext';
import { colors, radius, spacing } from '@/theme/tokens';

export function BiometricLockScreen({ embedded = false }: { embedded?: boolean }) {
  const { isLoading, isUnlocking, biometricEnabled, unlockWithBiometrics, signOut } = useSession();
  const [error, setError] = useState('');
  const [switchingAccount, setSwitchingAccount] = useState(false);

  const unlock = async () => {
    setError('');
    try {
      await unlockWithBiometrics();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (/invalid login credentials/i.test(message)) setError('La contraseña no es correcta.');
      else if (/failed to fetch|network/i.test(message)) setError('No fue posible conectar con Supabase. Revisa tu conexión.');
      else setError(message || 'No fue posible desbloquear ZacApp.');
    }
  };

  const returnToLogin = async () => {
    if (switchingAccount) return;
    setSwitchingAccount(true);
    setError('');
    try {
      await signOut();
      router.replace('/login');
    } catch {
      setError('No fue posible cerrar la sesión local. Inténtalo nuevamente.');
    } finally {
      setSwitchingAccount(false);
    }
  };

  return (
    <View style={embedded ? styles.embeddedPage : styles.page}>
      <View style={styles.card}>
        {isLoading ? <ActivityIndicator color={colors.primary} size="large" /> : <>
          <Text style={styles.title}>ZacApp bloqueada</Text>
          <Text style={styles.copy}>Verifica tu identidad para continuar con la sesión guardada en este dispositivo.</Text>
          {biometricEnabled && <AppButton label={isUnlocking ? 'Verificando...' : 'Desbloquear con biometría'} icon="finger-print-outline" disabled={isUnlocking || switchingAccount} onPress={() => { void unlock(); }} />}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <AppButton label={switchingAccount ? 'Saliendo...' : 'Usar contraseña o cambiar de cuenta'} variant="ghost" icon="log-out-outline" disabled={isUnlocking || switchingAccount} onPress={() => { void returnToLogin(); }} />
        </>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, zIndex: 100 },
  embeddedPage: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 440, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 25, fontWeight: '800', color: colors.text },
  copy: { color: colors.secondary, lineHeight: 21 },
  error: { color: colors.danger, fontWeight: '700' }
});
