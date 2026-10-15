import { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const passwordInputRef = useRef<TextInput>(null);
  const { signIn, isAuthenticated, isLoading } = useSession();
  const { width } = useWindowDimensions();
  const isNativeMobile = Platform.OS !== 'web' && width < 768;

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/(tabs)');
  }, [isAuthenticated, isLoading]);

  const submit = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Ingresa tu correo electrónico y contraseña.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      await signIn(email, password);
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
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scrollContent, isNativeMobile && styles.scrollContentMobile]} keyboardShouldPersistTaps="handled">
        <View style={[styles.content, isNativeMobile && styles.contentMobile]}>
          <View style={[styles.brandPanel, isNativeMobile && styles.brandPanelMobile]}>
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
          </View>

          <View style={[styles.card, isNativeMobile && styles.cardMobile]}>
            <Text style={[styles.cardTitle, isNativeMobile && styles.cardTitleMobile]}>Bienvenido</Text>
            <Text style={[styles.cardCopy, isNativeMobile && styles.cardCopyMobile]}>Ingresa con tu correo y contraseña para acceder a ZacApp.</Text>

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
            />

            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.passwordField}>
              <TextInput style={styles.passwordInput} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholder="Contraseña" placeholderTextColor={colors.muted} editable={!isSubmitting} onSubmitEditing={submit} returnKeyType="done" ref={passwordInputRef} />
              <Pressable accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onPress={() => setShowPassword((value) => !value)} style={styles.passwordToggle}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.secondary} /></Pressable>
            </View>

            {errorMessage ? <View style={styles.errorBox}><Text style={styles.errorText}>{errorMessage}</Text></View> : null}

            <AppButton
              label={isSubmitting ? 'Ingresando...' : 'Iniciar sesión'}
              icon="log-in-outline"
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
  scrollContentMobile: { flexGrow: 0, justifyContent: 'flex-start', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
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
  forgotText: { color: colors.secondary, fontSize: 13, fontWeight: '800' }
});
