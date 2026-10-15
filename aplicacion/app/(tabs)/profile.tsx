import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';
import { roleVisuals } from '@/theme/roles';

const profileContent = {
  citizen: { name: 'Ciudadano ZacApp', initials: 'CZ', role: 'Ciudadano', area: 'Cuenta ciudadana' },
  admin: { name: 'Administrador ZacApp', initials: 'AZ', role: 'Administrador', area: 'Administración general' },
  superadmin: { name: 'Superadministrador ZacApp', initials: 'SA', role: 'Superadministrador', area: 'Control de la plataforma' },
  maintenance: { name: 'Personal de mantenimiento', initials: 'MA', role: 'Mantenimiento', area: 'Atención en campo' },
  employee: { name: 'Empleado municipal', initials: 'EA', role: 'Empleado departamental', area: 'Gestión del departamento' }
} as const;

export default function ProfileScreen() {
  const { role, email, fullName, department, signOut, updatePassword } = useSession();
  const content = profileContent[role];
  const visual = roleVisuals[role];
  const isCitizen = role === 'citizen';
  const [showSecurityForm, setShowSecurityForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const submitPassword = async () => {
    setPasswordError(''); setPasswordMessage('');
    if (!currentPassword || !newPassword || !confirmPassword) return setPasswordError('Completa los tres campos de contraseña.');
    if (newPassword.length < 8) return setPasswordError('La contraseña nueva debe tener al menos 8 caracteres.');
    if (newPassword !== confirmPassword) return setPasswordError('La confirmación no coincide con la contraseña nueva.');
    if (currentPassword === newPassword) return setPasswordError('La contraseña nueva debe ser diferente de la actual.');
    try {
      setIsUpdatingPassword(true);
      await updatePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setPasswordMessage('La contraseña se actualizó correctamente.');
      setShowSecurityForm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      setPasswordError(message.includes('password') ? 'La contraseña actual no es correcta o la nueva no cumple los requisitos.' : 'No fue posible actualizar la contraseña.');
    } finally { setIsUpdatingPassword(false); }
  };

  return (
    <ScrollView style={[styles.page, { backgroundColor: visual.background }]} contentContainerStyle={styles.pageContent}>
      <View style={styles.content}>
        <View style={[styles.profileHeader, { backgroundColor: visual.primary }]}>
          <View style={[styles.avatar, { backgroundColor: visual.accent }]}><Text style={[styles.initials, { color: visual.primary }]}>{content.initials}</Text></View>
          <View style={styles.identity}>
            <Text style={[styles.eyebrow, { color: visual.accent }]}>{visual.eyebrow} · CUENTA</Text>
            <Text style={styles.name}>{fullName || content.name}</Text>
            <Text style={styles.role}>{department ? `${content.role} · ${department}` : `${content.role} · Zacapa`}</Text>
          </View>
          <View style={styles.verified}><Ionicons name="shield-checkmark" size={18} color={visual.accent} /><Text style={styles.verifiedText}>Verificada</Text></View>
        </View>

        <View style={styles.sectionHeading}><Text style={styles.sectionKicker}>IDENTIDAD DIGITAL</Text><Text style={styles.sectionTitle}>Información de la cuenta</Text></View>
        <View style={styles.card}>
          <InfoRow icon="mail-outline" label="Correo" value={email} />
          <InfoRow icon="location-outline" label="Municipio" value="Zacapa" />
          <InfoRow icon="business-outline" label={isCitizen ? 'Acceso' : 'Área'} value={isCitizen ? 'Reportes y servicios ciudadanos' : department ?? content.area} />
          <InfoRow icon="key-outline" label="Rol actual" value={content.role} />
        </View>

        <Pressable style={styles.securityCard} onPress={() => { setShowSecurityForm((value) => !value); setPasswordError(''); setPasswordMessage(''); }}><View style={[styles.securityIcon, { backgroundColor: `${visual.accent}22` }]}><Ionicons name="lock-closed-outline" size={22} color={visual.primary} /></View><View style={styles.securityText}><Text style={styles.securityTitle}>Seguridad de la cuenta</Text><Text style={styles.securityCopy}>Cambia tu contraseña verificando primero la actual.</Text></View><Ionicons name={showSecurityForm ? 'chevron-up' : 'chevron-down'} size={19} color={visual.primary} /></Pressable>
        {showSecurityForm && <View style={styles.passwordCard}>
          <Text style={styles.passwordTitle}>Cambiar contraseña</Text>
          <Text style={styles.label}>Contraseña actual</Text><TextInput value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="Contraseña actual" placeholderTextColor={colors.muted} style={styles.input} editable={!isUpdatingPassword} />
          <Text style={styles.label}>Contraseña nueva</Text><TextInput value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Mínimo 8 caracteres" placeholderTextColor={colors.muted} style={styles.input} editable={!isUpdatingPassword} />
          <Text style={styles.label}>Confirmar contraseña nueva</Text><TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Repite la contraseña nueva" placeholderTextColor={colors.muted} style={styles.input} editable={!isUpdatingPassword} />
          {passwordError ? <View style={styles.errorBox}><Text style={styles.errorText}>{passwordError}</Text></View> : null}
          <AppButton label={isUpdatingPassword ? 'Actualizando...' : 'Actualizar contraseña'} icon="key-outline" disabled={isUpdatingPassword} onPress={submitPassword} />
        </View>}
        {passwordMessage ? <View style={styles.successBox}><Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} /><Text style={styles.successText}>{passwordMessage}</Text></View> : null}
        <AppButton label="Cerrar sesión" variant="secondary" icon="log-out-outline" onPress={async () => { await signOut(); router.replace('/login'); }} />
      </View>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}><Ionicons name={icon} size={19} color={colors.primary} /></View>
      <View style={styles.infoText}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  pageContent: { padding: spacing.lg },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: spacing.md },
  profileHeader: { backgroundColor: colors.primary, borderRadius: 28, padding: spacing.xl, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, alignItems: 'center' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 28, fontWeight: '800', color: colors.primary },
  identity: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: spacing.xs },
  name: { fontSize: 24, fontWeight: '800', color: colors.white },
  role: { color: '#DDE8D7', marginTop: spacing.xs },
  verified: { borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.10)', paddingHorizontal: spacing.md, minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  verifiedText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  sectionHeading: { marginTop: spacing.sm },
  sectionKicker: { color: colors.secondary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  infoRow: { minHeight: 66, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1 },
  label: { color: colors.secondary, fontWeight: '700', marginBottom: spacing.xs },
  value: { color: colors.text, fontSize: 16, fontWeight: '700' },
  securityCard: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  securityIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  securityText: { flex: 1 },
  securityTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  securityCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  passwordCard: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  passwordTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.xs },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface, color: colors.text, fontSize: 15 },
  errorBox: { borderRadius: radius.md, backgroundColor: colors.dangerSoft, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  successBox: { borderRadius: radius.md, backgroundColor: colors.softGreen, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  successText: { flex: 1, color: colors.primary, fontSize: 13, lineHeight: 18, fontWeight: '700' }
});
