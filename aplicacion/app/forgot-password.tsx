import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { useSession } from '@/context/SessionContext';
import { colors, radius, spacing } from '@/theme/tokens';
import { TurnstileChallenge } from '@/components/TurnstileChallenge';

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useSession();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const captchaSiteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
  const captchaRequired = Boolean(captchaSiteKey);

  const submit = async () => {
    setError('');
    if (!email.trim() || !email.includes('@')) return setError('Ingresa un correo electrónico válido.');
    if (captchaRequired && !captchaToken) return setError('Completa la verificación de seguridad para continuar.');
    try {
      setLoading(true);
      await requestPasswordReset(email, Linking.createURL('/reset-password'), captchaToken || undefined);
      setSent(true);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message.toLowerCase() : '';
      setError(message.includes('rate') ? 'Espera unos minutos antes de solicitar otro correo.' : 'No fue posible solicitar la recuperación. Inténtalo nuevamente.');
    } finally {
      setLoading(false);
      if (captchaRequired) { setCaptchaToken(''); setCaptchaResetKey((value) => value + 1); }
    }
  };

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}><View style={styles.card}>
    <View style={styles.icon}><Ionicons name={sent ? 'mail-open-outline' : 'key-outline'} size={30} color={colors.primary} /></View>
    <Text style={styles.title}>{sent ? 'Revisa tu correo' : 'Recupera tu acceso'}</Text>
    <Text style={styles.copy}>{sent ? 'Si existe una cuenta asociada, recibirás un enlace para establecer una contraseña nueva.' : 'Ingresa el correo asociado a ZacApp y te enviaremos un enlace seguro.'}</Text>
    {!sent && <><Text style={styles.label}>Correo electrónico</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="correo@zacapp.gt" placeholderTextColor={colors.muted} editable={!loading} style={styles.input} />{error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}{captchaRequired ? <TurnstileChallenge siteKey={captchaSiteKey} action="zacapp_recuperacion" resetKey={captchaResetKey} onToken={setCaptchaToken} onExpire={() => setCaptchaToken('')} onError={() => { setCaptchaToken(''); setError('No fue posible cargar la verificación de seguridad. Inténtalo nuevamente.'); }} /> : null}<AppButton label={loading ? 'Enviando...' : 'Enviar enlace'} icon="mail-outline" disabled={loading || (captchaRequired && !captchaToken)} onPress={submit} /></>}
    {sent && <AppButton label="Volver al inicio de sesión" icon="arrow-back-outline" onPress={() => router.replace('/login')} />}
    {!sent && <AppButton label="Cancelar" variant="ghost" icon="arrow-back-outline" onPress={() => router.back()} />}
  </View></ScrollView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg }, card: { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: spacing.md }, icon: { width: 58, height: 58, borderRadius: 19, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' }, title: { color: colors.primary, fontSize: 26, fontWeight: '800' }, copy: { color: colors.muted, lineHeight: 21 }, label: { color: colors.text, fontWeight: '700' }, input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface, color: colors.text, fontSize: 16 }, errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md }, errorText: { color: colors.danger, lineHeight: 18, fontWeight: '700' } });
