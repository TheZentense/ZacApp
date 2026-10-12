import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const { role, email, fullName, department, signOut } = useSession();
  const content = profileContent[role];
  const visual = roleVisuals[role];
  const isCitizen = role === 'citizen';

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

        <View style={styles.securityCard}><View style={[styles.securityIcon, { backgroundColor: `${visual.accent}22` }]}><Ionicons name="lock-closed-outline" size={22} color={visual.primary} /></View><View style={styles.securityText}><Text style={styles.securityTitle}>Sesión protegida</Text><Text style={styles.securityCopy}>Tu acceso está conectado a la autenticación segura de ZacApp.</Text></View></View>
        <AppButton label="Cerrar sesión" variant="secondary" icon="log-out-outline" onPress={() => { signOut(); router.replace('/login'); }} />
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
  securityCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 2 }
});
