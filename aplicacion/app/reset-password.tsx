import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { useSession } from '@/context/SessionContext';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ResetPasswordScreen() {
  const { completePasswordRecovery, profileError } = useSession();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => setRecoveryReady(Boolean(data.session)));
    const listener = supabase?.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') setRecoveryReady(true); });
    return () => listener?.data.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    setError('');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (password !== confirmation) return setError('La confirmación no coincide.');
    try { setLoading(true); await completePasswordRecovery(password); setComplete(true); }
    catch { setError('El enlace venció o no fue posible actualizar la contraseña. Solicita uno nuevo.'); }
    finally { setLoading(false); }
  };

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}><View style={styles.card}>
    <View style={styles.icon}><Ionicons name={complete ? 'checkmark-circle-outline' : 'lock-closed-outline'} size={30} color={colors.primary} /></View>
    <Text style={styles.title}>{complete ? 'Contraseña actualizada' : 'Establece una contraseña nueva'}</Text>
    {!complete && !recoveryReady ? <><Text style={styles.copy}>{profileError || 'Este enlace no contiene una sesión de recuperación válida o ya venció.'}</Text><AppButton label="Solicitar otro enlace" icon="mail-outline" onPress={() => router.replace('/forgot-password')} /></> : null}
    {!complete && recoveryReady ? <><Text style={styles.copy}>Utiliza al menos 8 caracteres y evita reutilizar tu contraseña anterior.</Text><Text style={styles.label}>Contraseña nueva</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Mínimo 8 caracteres" placeholderTextColor={colors.muted} style={styles.input} /><Text style={styles.label}>Confirmar contraseña</Text><TextInput value={confirmation} onChangeText={setConfirmation} secureTextEntry placeholder="Repite la contraseña" placeholderTextColor={colors.muted} style={styles.input} />{error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}<AppButton label={loading ? 'Actualizando...' : 'Guardar contraseña'} icon="key-outline" disabled={loading} onPress={submit} /></> : null}
    {complete && <><Text style={styles.copy}>Ya puedes utilizar la contraseña nueva para ingresar a ZacApp.</Text><AppButton label="Ir al inicio de sesión" icon="log-in-outline" onPress={() => router.replace('/login')} /></>}
  </View></ScrollView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg }, card: { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: spacing.md }, icon: { width: 58, height: 58, borderRadius: 19, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' }, title: { color: colors.primary, fontSize: 25, fontWeight: '800' }, copy: { color: colors.muted, lineHeight: 21 }, label: { color: colors.text, fontWeight: '700' }, input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface, color: colors.text, fontSize: 16 }, errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md }, errorText: { color: colors.danger, lineHeight: 18, fontWeight: '700' } });
