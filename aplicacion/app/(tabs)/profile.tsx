import { StyleSheet, Text, View } from 'react-native';
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
  const { role, email, department, signOut } = useSession();
  const content = profileContent[role];
  const visual = roleVisuals[role];
  const isCitizen = role === 'citizen';

  return (
    <View style={styles.page}>
      <View style={styles.content}>
        <View style={[styles.profileHeader, { backgroundColor: visual.primary }]}>
          <View style={[styles.avatar, { backgroundColor: visual.accent }]}><Text style={[styles.initials, { color: visual.primary }]}>{content.initials}</Text></View>
          <View style={styles.identity}>
            <Text style={styles.name}>{content.name}</Text>
            <Text style={styles.role}>{department ? `${content.role} · ${department}` : `${content.role} · Zacapa`}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <InfoRow label="Correo" value={email} />
          <InfoRow label="Municipio" value="Zacapa" />
          <InfoRow label={isCitizen ? 'Acceso' : 'Área'} value={isCitizen ? 'Reportes y servicios ciudadanos' : department ?? content.area} />
          <InfoRow label="Rol actual" value={content.role} />
        </View>

        <AppButton label="Cerrar sesión" variant="secondary" icon="log-out-outline" onPress={() => { signOut(); router.replace('/login'); }} />
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: spacing.md },
  profileHeader: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.xl, flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 28, fontWeight: '800', color: colors.primary },
  identity: { flex: 1 },
  name: { fontSize: 24, fontWeight: '800', color: colors.white },
  role: { color: '#DDE8D7', marginTop: spacing.xs },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  infoRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { color: colors.secondary, fontWeight: '700', marginBottom: spacing.xs },
  value: { color: colors.text, fontSize: 16, fontWeight: '600' }
});
