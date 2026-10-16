import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';
import { supabase } from '@/lib/supabase';

function registrationError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  if (status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return 'Se alcanzó el límite de solicitudes. Espera unos minutos antes de intentar nuevamente.';
  }
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'Revisa el formato del correo y los datos ingresados.';
  if (code === 'weak_password') return 'Elige una contraseña más segura e intenta nuevamente.';
  return 'No fue posible completar la solicitud. Revisa tu conexión o inténtalo más tarde. Si el problema continúa, contacta al administrador.';
}

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const requestInFlight = useRef(false);
  const resendAvailableAt = useRef(0);
  const isBusy = isSubmitting || isResending;
  const { signUp, isAuthenticated, isLoading } = useSession();

  if (!isLoading && isAuthenticated) return <Redirect href="/(tabs)" />;

  const submit = async () => {
    if (requestInFlight.current || pendingEmail) return;
    if (!name.trim() || !email.trim() || !password || !confirmation) {
      setErrorMessage('Completa todos los campos para crear tu cuenta.');
      return;
    }
    if (password !== confirmation) {
      setErrorMessage('La confirmación debe coincidir con la contraseña.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Utiliza una contraseña de al menos 8 caracteres.');
      return;
    }

    requestInFlight.current = true;
    setErrorMessage('');
    setNotice('');
    setIsSubmitting(true);
    try {
      const hasSession = await signUp(name, email, password);
      setPassword('');
      setConfirmation('');
      if (hasSession) {
        router.replace('/(tabs)');
      } else {
        setPendingEmail(email.trim().toLowerCase());
        resendAvailableAt.current = Date.now() + 60_000;
        setNotice('Solicitud de registro recibida. Si corresponde confirmar este correo, recibirás un enlace. Revisa tu bandeja de entrada y spam; abre el enlace y después vuelve a ZacApp para iniciar sesión. Si ya tienes una cuenta confirmada, puedes iniciar sesión.');
      }
    } catch (error) {
      setErrorMessage(registrationError(error));
    } finally {
      requestInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  const resendConfirmation = async () => {
    if (requestInFlight.current || !pendingEmail) return;
    setErrorMessage('');
    if (Date.now() < resendAvailableAt.current) {
      setErrorMessage('Espera al menos un minuto desde la última solicitud antes de reenviar el correo.');
      return;
    }
    requestInFlight.current = true;
    setIsResending(true);
    setNotice('');
    resendAvailableAt.current = Date.now() + 60_000;
    try {
      if (!supabase) throw new Error('Supabase no está configurado.');
      const { error } = await supabase.auth.resend({ type: 'signup', email: pendingEmail });
      if (error) throw error;
      setNotice('Solicitud de confirmación recibida. Si corresponde confirmar este correo, recibirás un enlace. Revisa tu bandeja de entrada y spam; después de confirmar, vuelve a iniciar sesión.');
    } catch (error) {
      setErrorMessage(registrationError(error));
    } finally {
      requestInFlight.current = false;
      setIsResending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerIcon}><Ionicons name="person-add-outline" size={25} color={colors.primary} /></View>
            <View style={styles.headerText}><Text style={styles.eyebrow}>CUENTA CIUDADANA</Text><Text style={styles.title}>Registro ciudadano</Text><Text style={styles.copy}>Crea una cuenta para registrar incidencias y consultar su seguimiento.</Text></View>
          </View>
          <View style={styles.progress}><View style={styles.progressActive} /><View style={styles.progressInactive} /></View>
          <Text style={styles.label}>Nombre completo</Text>
          <View style={styles.inputWithIcon}><Ionicons name="person-outline" size={19} color={colors.secondary} /><TextInput editable={!isBusy && !pendingEmail} style={styles.inlineInput} value={name} onChangeText={setName} placeholder="Nombre y apellidos" placeholderTextColor={colors.muted} /></View>
          <Text style={styles.label}>Correo electrónico</Text>
          <View style={styles.inputWithIcon}><Ionicons name="mail-outline" size={19} color={colors.secondary} /><TextInput editable={!isBusy} style={styles.inlineInput} value={email} onChangeText={(value) => { setEmail(value); setPendingEmail(''); setNotice(''); setErrorMessage(''); }} placeholder="correo@ejemplo.com" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" /></View>
          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.inputWithIcon}><Ionicons name="lock-closed-outline" size={19} color={colors.secondary} /><TextInput editable={!isBusy && !pendingEmail} style={styles.inlineInput} value={password} onChangeText={setPassword} placeholder="Mínimo 8 caracteres" placeholderTextColor={colors.muted} secureTextEntry={!showPassword} /><Pressable accessibilityLabel={showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'} onPress={() => setShowPassword((value) => !value)} style={styles.eyeButton}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.secondary} /></Pressable></View>
          <Text style={styles.label}>Confirmar contraseña</Text>
          <View style={styles.inputWithIcon}><Ionicons name="checkmark-circle-outline" size={19} color={colors.secondary} /><TextInput editable={!isBusy && !pendingEmail} style={styles.inlineInput} value={confirmation} onChangeText={setConfirmation} placeholder="Repite la contraseña" placeholderTextColor={colors.muted} secureTextEntry={!showPassword} /></View>
          {notice ? <View style={styles.privacy}><Text accessibilityLiveRegion="polite" style={styles.privacyText}>{notice}</Text></View> : null}
          {errorMessage ? <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={19} color={colors.danger} /><Text style={styles.errorText}>{errorMessage}</Text></View> : null}
          <View style={styles.privacy}><Ionicons name="shield-checkmark-outline" size={19} color={colors.secondary} /><Text style={styles.privacyText}>La cuenta se crea únicamente con acceso ciudadano. Los roles internos los asigna la administración.</Text></View>
          {pendingEmail ? <AppButton label={isResending ? 'Solicitando correo...' : 'Reenviar correo de confirmación'} icon="mail-outline" disabled={isBusy} onPress={resendConfirmation} /> : <AppButton label={isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'} icon="person-add-outline" disabled={isBusy} onPress={submit} />}
          <AppButton label="Volver a iniciar sesión" variant="secondary" icon="arrow-back-outline" disabled={isBusy} onPress={() => router.replace('/login')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 620, alignSelf: 'center', backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  header: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  headerIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: colors.white, fontSize: 26, fontWeight: '800', marginTop: 2 },
  copy: { color: '#DDE8D7', lineHeight: 20, marginTop: spacing.xs },
  progress: { flexDirection: 'row', gap: spacing.xs, marginVertical: spacing.sm },
  progressActive: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  progressInactive: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  label: { color: colors.text, fontWeight: '700', marginTop: spacing.xs },
  inputWithIcon: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inlineInput: { flex: 1, minHeight: 50, color: colors.text, fontSize: 16 },
  eyeButton: { width: 40, height: 48, alignItems: 'center', justifyContent: 'center' },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, borderWidth: 1, borderColor: '#F2B8B5', padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '600' },
  privacy: { marginVertical: spacing.sm, backgroundColor: colors.softGreen, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  privacyText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 }
});
