import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { demoUsers, departmentLabels, getDepartmentSummary, mockIncidents } from '@/data/mockIncidents';
import { colors, radius, spacing } from '@/theme/tokens';

export default function AdminMenuScreen() {
  const openDemo = (title: string) => Alert.alert(title, 'Accion administrativa simulada.');

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Administracion</Text>
        <Text style={styles.title}>Usuarios, departamentos y asignaciones</Text>
        <Text style={styles.copy}>Vista sencilla para presentar funciones administrativas sin backend real.</Text>
      </View>

      <View style={styles.card}>
        <SectionHeader title="Usuarios" meta={`${demoUsers.length} demo`} />
        {demoUsers.map((user) => (
          <View key={user.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{user.name}</Text>
              <Text style={styles.rowMeta}>{user.email}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.smallLabel}>{user.role}</Text>
              <Text style={styles.activeText}>{user.status}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <SectionHeader title="Departamentos" meta="Resumen" />
        {departmentLabels.map((department) => {
          const summary = getDepartmentSummary(department);
          return (
            <View key={department} style={styles.departmentRow}>
              <Text style={styles.rowTitle}>{department}</Text>
              <View style={styles.metricsRow}>
                <Metric label="Pendientes" value={summary.pending} />
                <Metric label="En proceso" value={summary.inProgress} />
                <Metric label="Resueltos" value={summary.resolved} />
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <SectionHeader title="Asignaciones" meta="Reporte → Departamento → Personal → Estado" />
        {mockIncidents.slice(0, 5).map((incident) => (
          <View key={incident.id} style={styles.assignment}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{incident.code}</Text>
              <Text style={styles.rowMeta}>{incident.department} → Personal demo</Text>
            </View>
            <StatusBadge status={incident.status} />
          </View>
        ))}
        <AppButton label="Crear asignacion" icon="git-branch-outline" onPress={() => openDemo('Asignaciones')} />
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 980, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  header: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  kicker: { color: colors.secondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: colors.primary, fontSize: 24, fontWeight: '800', marginTop: spacing.xs },
  copy: { color: colors.muted, lineHeight: 21, marginTop: spacing.xs },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  rowMeta: { color: colors.muted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  smallLabel: { color: colors.secondary, fontSize: 12, fontWeight: '800' },
  activeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  departmentRow: { gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { flexGrow: 1, flexBasis: 100, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  metricValue: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  metricLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  assignment: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }
});
