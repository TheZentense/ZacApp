import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { useSession } from '@/context/SessionContext';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useSession();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const submit = async () => {
    if (inFlight.current) return;
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Ingresa un correo electrónico válido.');
    inFlight.current = true;
    try {
      setLoading(true);
      await requestPasswordReset(email, Linking.createURL('/reset-password'));
      if (mounted.current) setSent(true);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message.toLowerCase() : '';
      if (mounted.current) setError(message.includes('rate') ? 'Espera unos minutos antes de solicitar otro correo.' : 'No fue posible solicitar la recuperación. Inténtalo nuevamente.');
    } finally { inFlight.current = false; if (mounted.current) setLoading(false); }
  };

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}><View style={styles.card}>
    <View style={styles.icon}><Ionicons name={sent ? 'mail-open-outline' : 'key-outline'} size={30} color={colors.primary} /></View>
    <Text style={styles.title}>{sent ? 'Revisa tu correo' : 'Recupera tu acceso'}</Text>
    <Text style={styles.copy}>{sent ? 'Si existe una cuenta asociada, recibirás un enlace para establecer una contraseña nueva.' : 'Ingresa el correo asociado a ZacApp y te enviaremos un enlace seguro.'}</Text>
    {!sent && <><Text style={styles.label}>Correo electrónico</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="correo@zacapp.gt" placeholderTextColor={colors.muted} editable={!loading} style={styles.input} />{error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}<AppButton label={loading ? 'Enviando...' : 'Enviar enlace'} icon="mail-outline" disabled={loading} onPress={submit} /></>}
    {sent && <AppButton label="Volver al inicio de sesión" icon="arrow-back-outline" onPress={() => router.replace('/login')} />}
    {!sent && <AppButton label="Cancelar" disabled={loading} variant="ghost" icon="arrow-back-outline" onPress={() => router.back()} />}
  </View></ScrollView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg }, card: { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: spacing.md }, icon: { width: 58, height: 58, borderRadius: 19, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' }, title: { color: colors.primary, fontSize: 26, fontWeight: '800' }, copy: { color: colors.muted, lineHeight: 21 }, label: { color: colors.text, fontWeight: '700' }, input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface, color: colors.text, fontSize: 16 }, errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md }, errorText: { color: colors.danger, lineHeight: 18, fontWeight: '700' } });
