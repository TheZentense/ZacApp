import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';
import { demoProfileByEmail } from '@/data/mockIncidents';

const demoRoles = [
  { label: 'Ciudadano', role: 'citizen' as const, department: null },
  { label: 'Administrador', role: 'admin' as const, department: null },
  { label: 'Mantenimiento Agua', role: 'maintenance' as const, department: 'Agua' as const },
  { label: 'Mantenimiento EEMZA', role: 'maintenance' as const, department: 'EEMZA' as const }
];

export default function ProfileScreen() {
  const { role, email, department, signOut, setDemoRole } = useSession();
  const profile = demoProfileByEmail[email as keyof typeof demoProfileByEmail] ?? demoProfileByEmail['ciudadano@zacapp.gt'];
  const roleLabel = role === 'admin' ? 'Administrador' : role === 'maintenance' ? `Mantenimiento · ${department}` : 'Ciudadano';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
      <View style={styles.content}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}><Text style={styles.initials}>{getInitials(profile.name)}</Text></View>
          <View style={styles.identity}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.role}>{roleLabel}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <InfoRow label="Nombre" value={profile.name} />
          <InfoRow label="Correo" value={email} />
          <InfoRow label="Telefono" value={profile.phone} />
          <InfoRow label="Direccion" value={profile.address} />
          <InfoRow label="Rol actual" value={roleLabel} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Modo demostracion</Text>
          <Text style={styles.sectionCopy}>Selector temporal para presentar ZacApp con distintos roles.</Text>
          <View style={styles.demoGrid}>
            {demoRoles.map((item) => {
              const selected = role === item.role && (item.role !== 'maintenance' || department === item.department);
              return (
                <Pressable key={item.label} style={[styles.demoButton, selected && styles.demoButtonActive]} onPress={() => setDemoRole(item.role, item.department)}>
                  <Text style={[styles.demoText, selected && styles.demoTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <AppButton label="Editar perfil" icon="create-outline" onPress={() => Alert.alert('Accion simulada', 'La edicion de perfil quedaria disponible en una siguiente etapa.')} />
        <AppButton label="Cerrar sesion" variant="secondary" icon="log-out-outline" onPress={() => { signOut(); router.replace('/login'); }} />
      </View>
    </ScrollView>
  );
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
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
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { padding: spacing.lg },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.md },
  profileHeader: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, flexDirection: 'row', gap: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 24, fontWeight: '800', color: colors.primary },
  identity: { flex: 1 },
  name: { fontSize: 22, fontWeight: '800', color: colors.primary },
  role: { color: colors.muted, marginTop: spacing.xs },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  infoRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { color: colors.secondary, fontWeight: '700', marginBottom: spacing.xs },
  value: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sectionTitle: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  sectionCopy: { color: colors.muted, lineHeight: 20 },
  demoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  demoButton: { flexGrow: 1, flexBasis: 150, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md },
  demoButtonActive: { backgroundColor: colors.softGreen, borderColor: colors.primary },
  demoText: { color: colors.muted, fontWeight: '800', textAlign: 'center' },
  demoTextActive: { color: colors.primary }
});
