import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';
import { TurnstileChallenge } from '@/components/TurnstileChallenge';

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
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const requestInFlight = useRef(false);
  const isBusy = isSubmitting;
  const { signUp, linkGuestEmail, isAuthenticated, isGuest, isLoading } = useSession();
  const captchaSiteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
  const captchaRequired = Boolean(captchaSiteKey);
  const resetCaptcha = () => { setCaptchaToken(''); setCaptchaResetKey((value) => value + 1); };

  if (!isLoading && isAuthenticated && !isGuest) return <Redirect href="/(tabs)" />;

  const submit = async () => {
    if (requestInFlight.current) return;
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
    if (!isGuest && captchaRequired && !captchaToken) {
      setErrorMessage('Completa la verificación de seguridad para continuar.');
      return;
    }

    requestInFlight.current = true;
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      if (isGuest) {
        await linkGuestEmail(name, email, password);
        router.replace('/reports');
        return;
      }
      const hasSession = await signUp(name, email, password, captchaToken || undefined);
      setPassword('');
      setConfirmation('');
      if (hasSession) {
        router.replace('/(tabs)');
      } else {
        setErrorMessage('La cuenta fue creada, pero no fue posible iniciar la sesión. Vuelve al acceso e ingresa con tus datos.');
      }
    } catch (error) {
      setErrorMessage(registrationError(error));
    } finally {
      requestInFlight.current = false;
      setIsSubmitting(false);
      if (!isGuest && captchaRequired) resetCaptcha();
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerIcon}><Ionicons name="person-add-outline" size={25} color={colors.primary} /></View>
            <View style={styles.headerText}><Text style={styles.eyebrow}>CUENTA CIUDADANA</Text><Text style={styles.title}>{isGuest ? 'Conserva tu seguimiento' : 'Registro ciudadano'}</Text><Text style={styles.copy}>{isGuest ? 'Vincula un correo a esta sesión para no perder tus reportes.' : 'Crea una cuenta para registrar incidencias y consultar su seguimiento.'}</Text></View>
          </View>
          <View style={styles.progress}><View style={styles.progressActive} /><View style={styles.progressInactive} /></View>
          <Text style={styles.label}>Nombre completo</Text>
          <View style={styles.inputWithIcon}><Ionicons name="person-outline" size={19} color={colors.secondary} /><TextInput editable={!isBusy} style={styles.inlineInput} value={name} onChangeText={setName} placeholder="Nombre y apellidos" placeholderTextColor={colors.muted} /></View>
          <Text style={styles.label}>Correo electrónico</Text>
          <View style={styles.inputWithIcon}><Ionicons name="mail-outline" size={19} color={colors.secondary} /><TextInput editable={!isBusy} style={styles.inlineInput} value={email} onChangeText={(value) => { setEmail(value); setErrorMessage(''); }} placeholder="correo@ejemplo.com" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" /></View>
          <>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputWithIcon}><Ionicons name="lock-closed-outline" size={19} color={colors.secondary} /><TextInput editable={!isBusy} style={styles.inlineInput} value={password} onChangeText={setPassword} placeholder="Mínimo 8 caracteres" placeholderTextColor={colors.muted} secureTextEntry={!showPassword} /><Pressable accessibilityLabel={showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'} onPress={() => setShowPassword((value) => !value)} style={styles.eyeButton}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.secondary} /></Pressable></View>
            <Text style={styles.label}>Confirmar contraseña</Text>
            <View style={styles.inputWithIcon}><Ionicons name="checkmark-circle-outline" size={19} color={colors.secondary} /><TextInput editable={!isBusy} style={styles.inlineInput} value={confirmation} onChangeText={setConfirmation} placeholder="Repite la contraseña" placeholderTextColor={colors.muted} secureTextEntry={!showPassword} /></View>
          </>
          {errorMessage ? <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={19} color={colors.danger} /><Text style={styles.errorText}>{errorMessage}</Text></View> : null}
          <View style={styles.privacy}><Ionicons name="shield-checkmark-outline" size={19} color={colors.secondary} /><Text style={styles.privacyText}>{isGuest ? 'El correo se vinculará a la misma identidad anónima para conservar sus reportes.' : 'La cuenta se crea únicamente con acceso ciudadano. Los roles internos los asigna la administración.'}</Text></View>
          {!isGuest && captchaRequired ? <TurnstileChallenge siteKey={captchaSiteKey} action="zacapp_registro" resetKey={captchaResetKey} onToken={setCaptchaToken} onExpire={() => setCaptchaToken('')} onError={() => { setCaptchaToken(''); setErrorMessage('No fue posible cargar la verificación de seguridad. Inténtalo nuevamente.'); }} /> : null}
          <AppButton label={isSubmitting ? (isGuest ? 'Vinculando correo...' : 'Creando cuenta...') : (isGuest ? 'Conservar mis reportes' : 'Crear cuenta')} icon="person-add-outline" disabled={isBusy || (!isGuest && captchaRequired && !captchaToken)} onPress={submit} />
          <AppButton label={isGuest ? 'Volver a mis reportes' : 'Volver a iniciar sesión'} variant="secondary" icon="arrow-back-outline" disabled={isBusy} onPress={() => router.replace(isGuest ? '/reports' : '/login')} />
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
