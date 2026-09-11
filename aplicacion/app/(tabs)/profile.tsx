import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  return (
    <View style={styles.page}>
      <View style={styles.content}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}><Text style={styles.initials}>DC</Text></View>
          <View style={styles.identity}>
            <Text style={styles.name}>Demo Ciudadano</Text>
            <Text style={styles.role}>Ciudadano · Zacapa</Text>
          </View>
        </View>

        <View style={styles.card}>
          <InfoRow label="Correo" value="demo@zacapp.gt" />
          <InfoRow label="Municipio" value="Zacapa" />
          <InfoRow label="Reportes activos" value="8 en proceso" />
          <InfoRow label="Rol actual" value="Ciudadano" />
        </View>

        <AppButton label="Cerrar sesión" variant="secondary" icon="log-out-outline" onPress={() => router.replace('/login')} />
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
