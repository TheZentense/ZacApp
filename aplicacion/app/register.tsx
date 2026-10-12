import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signUp } = useSession();

  const submit = async () => {
    if (!name.trim() || !email.trim() || !password || !confirmation) {
      Alert.alert('Datos incompletos', 'Completa todos los campos para crear tu cuenta.');
      return;
    }
    if (password !== confirmation) {
      Alert.alert('Contraseñas diferentes', 'La confirmación debe coincidir con la contraseña.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Contraseña corta', 'Utiliza al menos 8 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      const hasSession = await signUp(name, email, password);
      Alert.alert(
        'Cuenta creada',
        hasSession ? 'Tu cuenta ciudadana fue registrada correctamente.' : 'Revisa tu correo para confirmar la cuenta antes de iniciar sesión.',
        [{ text: 'Continuar', onPress: () => router.replace(hasSession ? '/(tabs)' : '/login') }]
      );
    } catch (error) {
      Alert.alert('No fue posible crear la cuenta', error instanceof Error ? error.message : 'Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Registro ciudadano</Text>
          <Text style={styles.copy}>Crea una cuenta para registrar incidencias y consultar su seguimiento.</Text>
          <Text style={styles.label}>Nombre completo</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nombre y apellidos" placeholderTextColor={colors.muted} />
          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="correo@ejemplo.com" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" />
          <Text style={styles.label}>Contraseña</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Contraseña" placeholderTextColor={colors.muted} secureTextEntry />
          <Text style={styles.label}>Confirmar contraseña</Text>
          <TextInput style={styles.input} value={confirmation} onChangeText={setConfirmation} placeholder="Repite la contraseña" placeholderTextColor={colors.muted} secureTextEntry />
          <AppButton label={isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'} icon="person-add-outline" onPress={submit} />
          <AppButton label="Volver a iniciar sesión" variant="secondary" icon="arrow-back-outline" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.primary, fontSize: 28, fontWeight: '800' },
  copy: { color: colors.muted, lineHeight: 21, marginBottom: spacing.md },
  label: { color: colors.text, fontWeight: '700', marginTop: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 16, backgroundColor: colors.surface }
});
