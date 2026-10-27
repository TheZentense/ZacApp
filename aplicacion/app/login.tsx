import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';
import { TurnstileChallenge } from '@/components/TurnstileChallenge';
import { BiometricLockScreen } from '@/components/BiometricLockScreen';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const passwordInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const { signIn, isAuthenticated, isGuest, isLoading, isLocked } = useSession();
  const { width } = useWindowDimensions();
  const isNativeMobile = Platform.OS !== 'web' && width < 768;
  const captchaSiteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
  const captchaRequired = Boolean(captchaSiteKey);

  const resetCaptcha = () => { setCaptchaToken(''); setCaptchaResetKey((value) => value + 1); };

  useEffect(() => {
    if (!isLoading && !isLocked && isAuthenticated) router.replace(isGuest ? '/report/new' : '/(tabs)');
  }, [isAuthenticated, isGuest, isLoading, isLocked]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const submit = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Ingresa tu correo electrónico y contraseña.');
      return;
    }
    if (captchaRequired && !captchaToken) {
      setErrorMessage('Completa la verificación de seguridad para continuar.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      await signIn(email, password, captchaToken || undefined);
      router.replace('/(tabs)');
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('invalid login credentials')) setErrorMessage('El correo o la contraseña no son correctos.');
      else if (message.includes('email not confirmed')) setErrorMessage('Confirma tu correo electrónico antes de ingresar.');
      else if (message.includes('account inactive')) setErrorMessage('Esta cuenta se encuentra inactiva. Contacta al administrador del sistema.');
      else if (message.includes('failed to fetch') || message.includes('network')) setErrorMessage('No fue posible conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
      else setErrorMessage('No fue posible iniciar sesión. Inténtalo nuevamente.');
    } finally {
      setIsSubmitting(false);
      if (captchaRequired) resetCaptcha();
    }
  };

  const continueAsGuest = () => {
    if (isSubmitting) return;
    setErrorMessage('');
    router.push('/report/new');
  };

  if (isLocked) return <BiometricLockScreen embedded />;

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, isNativeMobile && styles.scrollContentMobile, isNativeMobile && isKeyboardVisible && styles.scrollContentKeyboard]}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        <View style={[styles.content, isNativeMobile && styles.contentMobile]}>
          {!isNativeMobile || !isKeyboardVisible ? <View style={[styles.brandPanel, isNativeMobile && styles.brandPanelMobile]}>
            <View style={[styles.logoMark, isNativeMobile && styles.logoMarkMobile]}>
              <Image source={require('../assets/images/zacapp-logo-dark.png')} style={styles.logoImage} resizeMode="contain" />
            </View>
            <Text style={[styles.kicker, isNativeMobile && styles.kickerMobile]}>Sistema comunitario</Text>
            <Text style={[styles.title, isNativeMobile && styles.titleMobile]}>ZacApp</Text>
            <Text style={[styles.subtitle, isNativeMobile && styles.subtitleMobile]}>Reportes ciudadanos para dar seguimiento a incidencias en Zacapa.</Text>
            {!isNativeMobile && <View style={styles.brandSteps}>
              <View style={styles.brandStep}><View style={styles.brandStepIcon}><Ionicons name="camera-outline" size={19} color={colors.primary} /></View><View><Text style={styles.brandStepTitle}>Reporta</Text><Text style={styles.brandStepCopy}>Registra una incidencia desde tu dispositivo.</Text></View></View>
              <View style={styles.brandStep}><View style={styles.brandStepIcon}><Ionicons name="trail-sign-outline" size={19} color={colors.primary} /></View><View><Text style={styles.brandStepTitle}>Consulta</Text><Text style={styles.brandStepCopy}>Sigue el avance de cada solicitud.</Text></View></View>
            </View>}
          </View> : null}

          <View style={[styles.card, isNativeMobile && styles.cardMobile]}>
            <View style={styles.quickReportPanel}>
              <View style={styles.quickReportHeading}>
                <View style={styles.quickReportIcon}><Ionicons name="megaphone" size={22} color={colors.white} /></View>
                <View style={styles.quickReportText}>
                  <Text style={styles.quickReportKicker}>Sin crear una cuenta</Text>
                  <Text style={styles.quickReportTitle}>¿Viste un problema?</Text>
                </View>
              </View>
              <Text style={styles.quickReportCopy}>Envía una fotografía, la ubicación y una breve descripción. Te tomará solo unos minutos.</Text>

              <AppButton label="Hacer un reporte" icon="camera-outline" disabled={isSubmitting} onPress={continueAsGuest} style={styles.quickReportButton} />
              <Text style={styles.guestNote}>Podrás enviar hasta cinco reportes al día. La fotografía y la ubicación son necesarias.</Text>
            </View>

            <View style={styles.loginDivider}><View style={styles.guestLine} /><Text style={styles.loginDividerText}>¿Ya tienes una cuenta?</Text><View style={styles.guestLine} /></View>
            <Text style={[styles.cardTitle, isNativeMobile && styles.cardTitleMobile]}>Iniciar sesión</Text>
            <Text style={[styles.cardCopy, isNativeMobile && styles.cardCopyMobile]}>Consulta tus reportes y revisa su avance.</Text>

            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="correo@zacapp.gt"
              placeholderTextColor={colors.muted}
              editable={!isSubmitting}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              returnKeyType="next"
            />

            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.passwordField}>
              <TextInput style={styles.passwordInput} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholder="Contraseña" placeholderTextColor={colors.muted} editable={!isSubmitting} onSubmitEditing={submit} returnKeyType="done" ref={passwordInputRef} />
              <Pressable accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onPress={() => setShowPassword((value) => !value)} style={styles.passwordToggle}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.secondary} /></Pressable>
            </View>

            {errorMessage ? <View style={styles.errorBox}><Text style={styles.errorText}>{errorMessage}</Text></View> : null}

            {captchaRequired ? <TurnstileChallenge siteKey={captchaSiteKey} action="zacapp_login" resetKey={captchaResetKey} onToken={setCaptchaToken} onExpire={() => setCaptchaToken('')} onError={() => { setCaptchaToken(''); setErrorMessage('No fue posible cargar la verificación de seguridad. Inténtalo nuevamente.'); }} /> : null}

            <AppButton
              label={isSubmitting ? 'Ingresando...' : 'Iniciar sesión'}
              icon="log-in-outline"
              disabled={isSubmitting || (captchaRequired && !captchaToken)}
              onPress={submit}
            />
            <Pressable style={styles.forgotButton} onPress={() => router.push('/forgot-password')}><Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text></Pressable>
            <AppButton label="Crear cuenta ciudadana" variant="ghost" icon="person-add-outline" onPress={() => router.push('/register')} />
            <View style={styles.secureNote}><Ionicons name="shield-checkmark-outline" size={17} color={colors.secondary} /><Text style={styles.secureNoteText}>Acceso protegido mediante Supabase Auth.</Text></View>
            <Text style={styles.helpText}>¿Necesitas ayuda? Contacta al administrador del sistema.</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  scrollContentMobile: { flexGrow: 1, justifyContent: 'flex-start', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  scrollContentKeyboard: { justifyContent: 'flex-end', paddingTop: spacing.md, paddingBottom: spacing.md },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', flexDirection: 'row', gap: spacing.xl, alignItems: 'stretch', flexWrap: 'wrap' },
  contentMobile: { maxWidth: 430, flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch', gap: spacing.lg },
  brandPanel: { flex: 1, minWidth: 280, backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.xl, justifyContent: 'center', gap: spacing.md },
  brandPanelMobile: { flex: 0, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, maxHeight: 340, width: '100%', borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, justifyContent: 'flex-start', gap: 6 },
  logoMark: { width: 104, height: 104, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoMarkMobile: { width: 88, height: 88, borderRadius: 20 },
  logoImage: { width: '100%', height: '100%' },
  kicker: { color: colors.accent, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  kickerMobile: { fontSize: 12 },
  title: { color: colors.white, fontSize: 42, fontWeight: '800' },
  titleMobile: { fontSize: 44 },
  subtitle: { color: '#DDE8D7', fontSize: 17, lineHeight: 25, maxWidth: 420 },
  subtitleMobile: { fontSize: 17, lineHeight: 23 },
  brandSteps: { marginTop: spacing.lg, gap: spacing.md },
  brandStep: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brandStepIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  brandStepTitle: { color: colors.white, fontSize: 14, fontWeight: '800' },
  brandStepCopy: { color: '#DDE8D7', fontSize: 12, marginTop: 2 },
  card: { flex: 1, minWidth: 300, backgroundColor: colors.white, padding: spacing.xl, borderRadius: radius.xl, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, elevation: 3 },
  cardMobile: { flex: 0, flexGrow: 0, minWidth: 0, width: '100%', padding: spacing.lg, borderRadius: radius.lg, gap: spacing.xs },
  cardTitle: { color: colors.primary, fontSize: 28, fontWeight: '800' },
  cardTitleMobile: { fontSize: 24 },
  cardCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: spacing.md },
  cardCopyMobile: { fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  quickReportPanel: { backgroundColor: colors.softGreen, borderWidth: 1, borderColor: colors.accent, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  quickReportHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  quickReportIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  quickReportText: { flex: 1, minWidth: 0 },
  quickReportKicker: { color: colors.secondary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  quickReportTitle: { color: colors.primary, fontSize: 22, lineHeight: 27, fontWeight: '800', marginTop: 2 },
  quickReportCopy: { color: colors.text, fontSize: 14, lineHeight: 20 },
  quickReportButton: { minHeight: 56 },
  label: { color: colors.text, fontWeight: '600', marginTop: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 16, backgroundColor: colors.surface },
  passwordField: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, minHeight: 50, paddingHorizontal: spacing.md, fontSize: 16, color: colors.text },
  passwordToggle: { width: 48, height: 50, alignItems: 'center', justifyContent: 'center' },
  secureNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xs },
  secureNoteText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  helpText: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: spacing.xs },
  errorBox: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: '#F2B8B5', borderRadius: radius.md, padding: spacing.md, marginVertical: spacing.xs },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  forgotButton: { alignSelf: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  forgotText: { color: colors.secondary, fontSize: 13, fontWeight: '800' },
  loginDivider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xs },
  guestLine: { flex: 1, height: 1, backgroundColor: colors.border },
  loginDividerText: { color: colors.secondary, fontSize: 12, fontWeight: '800' },
  guestNote: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' }
});
