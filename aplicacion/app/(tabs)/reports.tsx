import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { IncidentCard } from '@/components/IncidentCard';
import { mockIncidents } from '@/data/mockIncidents';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ReportsScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis reportes</Text>
        <Text style={styles.copy}>Consulta el estado y la trazabilidad de tus incidencias registradas.</Text>
      </View>

      <View style={styles.filters}>
        <Text style={[styles.filter, styles.filterActive]}>Todos</Text>
        <Text style={styles.filter}>En proceso</Text>
        <Text style={styles.filter}>Resueltos</Text>
      </View>

      <View style={styles.list}>
        {mockIncidents.map((item) => <IncidentCard key={item.id} incident={item} />)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  header: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 28, fontWeight: '800', color: colors.primary },
  copy: { color: colors.muted, marginTop: spacing.xs, lineHeight: 21 },
  filters: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  filter: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.white, color: colors.muted, fontWeight: '700', borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.primary, color: colors.white, borderColor: colors.primary },
  list: { gap: spacing.md }
});
