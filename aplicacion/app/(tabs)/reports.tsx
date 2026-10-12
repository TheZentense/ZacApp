import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IncidentCard } from '@/components/IncidentCard';
import { mockIncidents } from '@/data/mockIncidents';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Incident } from '@/types/domain';
import { useSession } from '@/context/SessionContext';
import { roleVisuals } from '@/theme/roles';

type Filter = 'TODOS' | 'ACTIVOS' | 'CERRADOS';
const filters: { key: Filter; label: string }[] = [{ key: 'TODOS', label: 'Todos' }, { key: 'ACTIVOS', label: 'Activos' }, { key: 'CERRADOS', label: 'Resueltos' }];

export default function ReportsScreen() {
  const { role, department } = useSession();
  const visual = roleVisuals[role];
  const [filter, setFilter] = useState<Filter>('TODOS');
  const [selected, setSelected] = useState<Incident | null>(null);
  const incidents = useMemo(() => mockIncidents.filter((item) => {
    const belongsToScope = department ? item.category === department : role === 'citizen' ? item.id !== '1' : true;
    const matchesStatus = filter === 'TODOS' || (filter === 'CERRADOS' ? item.status === 'CERRADO' : item.status !== 'CERRADO');
    return belongsToScope && matchesStatus;
  }), [department, filter, role]);
  const heading = role === 'superadmin' ? 'Reportes generales' : role === 'admin' ? 'Gestión de reportes' : role === 'maintenance' ? `Asignaciones · ${department}` : role === 'employee' ? `Reportes del área · ${department}` : 'Mis reportes';
  const description = role === 'citizen' ? 'Consulta únicamente los reportes enviados desde tu cuenta.' : department ? `Consulta únicamente los casos de ${department}.` : 'Consulta reportes de todos los departamentos.';

  return <ScrollView style={[styles.scroll, { backgroundColor: visual.background }]} contentContainerStyle={styles.page}>
    <View style={styles.header}>
      <Text style={[styles.title, { color: visual.primary }]}>{selected ? 'Detalle del reporte' : heading}</Text>
      <Text style={styles.copy}>{selected ? 'Información y estado actual de la incidencia seleccionada.' : description}</Text>
    </View>
    {selected ? <>
      <Pressable style={styles.backButton} onPress={() => setSelected(null)}><Ionicons name="arrow-back" size={19} color={visual.primary} /><Text style={[styles.backText, { color: visual.primary }]}>Volver a reportes</Text></Pressable>
      <IncidentCard incident={selected} />
      <View style={styles.detailCard}>
        <DetailRow label="Fecha de registro" value={selected.createdAt} />
        <DetailRow label="Última actualización" value={selected.updatedAt} />
        <DetailRow label="Categoría" value={selected.category} />
        <DetailRow label="Ubicación" value={selected.location} />
      </View>
    </> : <>
      <View style={styles.filters}>{filters.map((item) => <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.filter, filter === item.key && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</View>
      <Text style={styles.resultCount}>{incidents.length} reportes encontrados</Text>
      <View style={styles.list}>{incidents.map((item) => <IncidentCard key={item.id} incident={item} compact onPress={() => setSelected(item)} />)}</View>
    </>}
  </ScrollView>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  header: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 28, fontWeight: '800', color: colors.primary },
  copy: { color: colors.muted, marginTop: spacing.xs, lineHeight: 21 },
  filters: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  filter: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.muted, fontWeight: '700' },
  filterTextActive: { color: colors.white },
  resultCount: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  list: { gap: spacing.md },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  backText: { color: colors.primary, fontWeight: '800' },
  detailCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  detailRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.secondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  detailValue: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: spacing.xs }
});
