import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IncidentCard } from '@/components/IncidentCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState, LoadingState } from '@/components/DataState';
import { useReports } from '@/hooks/useReports';
import { colors, radius, spacing } from '@/theme/tokens';
import { isIncidentPriority, type IncidentStatus } from '@/types/domain';
import { useSession } from '@/context/SessionContext';
import { roleVisuals } from '@/theme/roles';
import { AppButton } from '@/components/AppButton';

import { reportReadScopeFor, workflowPermissionsFor } from '@/services/sessionPolicy';

type Filter = 'TODOS' | 'ACTIVOS' | 'PENDIENTES' | 'POR_ATENDER' | 'POR_VALIDAR' | 'CANALIZADOS' | 'SIN_RESPONSABLE' | 'ASIGNADO' | 'EN_ATENCION' | 'POR_VERIFICAR' | 'CERRADO' | 'RECHAZADO';
type FilterOption = { key: Filter; label: string };
const citizenFilters: FilterOption[] = [{ key: 'TODOS', label: 'Todos' }, { key: 'ACTIVOS', label: 'Activos' }, { key: 'CERRADO', label: 'Resueltos' }];
const operationalFilters: FilterOption[] = [
  { key: 'TODOS', label: 'Todos' }, { key: 'PENDIENTES', label: 'Pendientes' },
  { key: 'ASIGNADO', label: 'Canalizados' }, { key: 'EN_ATENCION', label: 'En atención' },
  { key: 'POR_VERIFICAR', label: 'Por verificar' }, { key: 'CERRADO', label: 'Cerrados' }, { key: 'RECHAZADO', label: 'Rechazados' }
];
function matchesFilter(status: IncidentStatus, filter: Filter) {
  if (filter === 'TODOS' || filter === 'SIN_RESPONSABLE') return true;
  if (filter === 'ACTIVOS') return status !== 'CERRADO';
  if (filter === 'PENDIENTES') return ['REGISTRADO', 'EN_REVISION', 'VALIDADO'].includes(status);
  if (filter === 'POR_VALIDAR') return ['REGISTRADO', 'EN_REVISION'].includes(status);
  if (filter === 'POR_ATENDER') return status === 'ASIGNADO';
  if (filter === 'CANALIZADOS') return ['ASIGNADO', 'EN_ATENCION', 'POR_VERIFICAR'].includes(status);
  return status === filter;
}
function formatPriority(value: unknown): string {
  return value === undefined ? 'no consultada' : isIncidentPriority(value) ? String(value) : 'no disponible';
}
export default function ReportsScreen() {
  const { role, department, databaseRole } = useSession();
  const visual = roleVisuals[role];
  const permissions = workflowPermissionsFor(databaseRole);
  const { incidents: availableIncidents, isLoading, error, reload, isPreview } = useReports();
  const pending = reportReadScopeFor(databaseRole) === 'pending' && (!isPreview || permissions.operator);
  const [filter, setFilter] = useState<Filter>('TODOS');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = pending || isPreview ? null : availableIncidents.find((item) => item.id === selectedId) ?? null;
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('TODAS');
  const [departmentFilter, setDepartmentFilter] = useState('TODOS');
  const citizen = permissions.citizenReports || (isPreview && role === 'citizen');
  const filters: FilterOption[] = citizen ? citizenFilters : [
    ...operationalFilters,
    ...(permissions.generalReports ? [{ key: 'POR_VALIDAR' as const, label: 'Por validar' }, { key: 'CANALIZADOS' as const, label: 'Canalizados por área' }] : []),
    ...(permissions.departmentReports ? [{ key: 'POR_ATENDER' as const, label: 'Por atender' }, { key: 'SIN_RESPONSABLE' as const, label: 'Sin responsable' }] : [])
  ];
  const selectedFilter = filters.find((item) => item.key === filter) ?? filters[0];
  const departmentOptions = useMemo(() => Array.from(new Set(availableIncidents.map((item) => item.department).filter((name): name is string => Boolean(name)))).sort(), [availableIncidents]);
  const incidents = availableIncidents.filter((item) => {
    const query = search.trim().toLocaleLowerCase('es');
    const matchesSearch = !query || [item.code, item.title, item.category, item.location].some((value) => value.toLocaleLowerCase('es').includes(query));
    const matchesPriority = priorityFilter === 'TODAS' || (priorityFilter === 'DESCONOCIDA' ? item.priority === undefined : priorityFilter === 'INVALIDA' ? item.priority === null : item.priority === Number(priorityFilter));
    const matchesDepartment = departmentFilter === 'TODOS' || item.department === departmentFilter;
    const matchesAssignee = selectedFilter.key !== 'SIN_RESPONSABLE' || (!item.assignedToId && !['CERRADO', 'RECHAZADO'].includes(item.status));
    return !pending && !isPreview && matchesFilter(item.status, selectedFilter.key) && matchesSearch && matchesPriority && matchesDepartment && matchesAssignee;
  });
  const hasFilters = Boolean(search.trim()) || selectedFilter.key !== 'TODOS' || priorityFilter !== 'TODAS' || departmentFilter !== 'TODOS';
  const resetFilters = () => { setSearch(''); setFilter('TODOS'); setPriorityFilter('TODAS'); setDepartmentFilter('TODOS'); };
  const heading = permissions.generalReports ? 'Reportes generales' : permissions.departmentReports ? 'Mi departamento' : permissions.operator ? 'Mis tareas' : citizen ? 'Mis reportes' : 'Consulta pendiente';
  return <ScrollView style={[styles.scroll, { backgroundColor: visual.background }]} contentContainerStyle={styles.page}>
    <View style={[styles.header, { backgroundColor: visual.primary }]}>
      <Text style={styles.eyebrow}>{visual.eyebrow}</Text>
      <Text style={styles.title}>{selected ? 'Detalle del reporte' : heading}</Text>
      <Text style={styles.copy}>{permissions.departmentReports ? department ? 'Reportes canalizados a ' + department + '.' : 'Se requiere un departamento verificado.' : citizen ? 'Consulta el avance de tus reportes.' : permissions.generalReports ? 'Reportes y seguimiento por departamento.' : 'Tareas y seguimiento personal.'}</Text>
      {!pending && !selected && <View style={styles.headerSummary}><Text style={styles.summaryValue}>{isLoading || error || isPreview ? '—' : incidents.length}</Text><Text style={styles.summaryLabel}>reportes en esta vista</Text></View>}
    </View>
    {pending ? <View style={styles.managementCard}><Text style={styles.managementTitle}>Consulta pendiente</Text><Text style={styles.managementCopy}>{permissions.operator ? 'Tus tareas aparecerán cuando se habilite la asignación de empleados.' : 'Esta consulta estará disponible en una próxima etapa.'}</Text></View> : selected ? <>
      <Pressable style={styles.backButton} onPress={() => setSelectedId(null)}><Ionicons name="arrow-back" size={19} color={visual.primary} /><Text style={styles.backText}>Volver a reportes</Text></Pressable>
      <IncidentCard incident={selected} />
      <View style={styles.detailCard}>
        <DetailRow label="Fecha de registro" value={selected.createdAt} /><DetailRow label="Última actualización" value={selected.updatedAt} />
        <DetailRow label="Categoría" value={selected.category} /><DetailRow label="Ubicación" value={selected.location} />
        <DetailRow label="Prioridad" value={formatPriority(selected.priority)} /><DetailRow label="Departamento asignado" value={selected.department ?? (selected.departmentId === null ? 'Sin canalizar' : 'Departamento no disponible')} />
        {!citizen && <DetailRow label="Responsable actual · ID" value={selected.assignedToId ?? 'Sin responsable asignado'} />}
      </View>
      {(permissions.generalReports || permissions.departmentReports) && <View style={styles.managementCard}>
        <Text style={styles.managementTitle}>{permissions.generalReports ? 'Validación y cierre' : 'Asignación y verificación'}</Text>
        <Text style={styles.managementCopy}>Estas acciones estarán disponibles en una próxima etapa.</Text>
        {permissions.generalReports ? <><AppButton label="Validar reporte · pendiente" disabled onPress={() => {}} /><AppButton label="Canalizar · pendiente" disabled onPress={() => {}} /><AppButton label="Cerrar reporte · pendiente" disabled onPress={() => {}} /></> : <><AppButton label="Asignar empleado · pendiente" disabled onPress={() => {}} /><AppButton label="Verificar atención · pendiente" disabled onPress={() => {}} /></>}
        <AppButton label="Evidencia de atención · pendiente" disabled onPress={() => {}} />
      </View>}
    </> : <>
      {permissions.departmentReports && <View style={styles.managementCard}><Text style={styles.managementTitle}>Empleados asignables</Text><Text style={styles.managementCopy}>La lista de empleados y la asignación estarán disponibles más adelante.</Text><AppButton label="Asignar empleado · pendiente" disabled onPress={() => {}} /></View>}
      <TextInput style={styles.searchInput} accessibilityLabel="Buscar reportes" value={search} onChangeText={setSearch} placeholder="Buscar reporte o ubicación" placeholderTextColor={colors.muted} />
      <View style={styles.filters}>{filters.map((item) => <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: selectedFilter.key === item.key }} onPress={() => setFilter(item.key)} style={[styles.filter, selectedFilter.key === item.key && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.filterText, selectedFilter.key === item.key && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</View>
      <Text style={styles.fieldLabel}>Prioridad</Text>
      <View style={styles.filters}>{[{ key: 'TODAS', label: 'Todas' }, ...[1, 2, 3, 4].map((value) => ({ key: String(value), label: String(value) })), { key: 'DESCONOCIDA', label: 'No consultada' }, { key: 'INVALIDA', label: 'No disponible' }].map((item) => <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: priorityFilter === item.key }} onPress={() => setPriorityFilter(item.key)} style={[styles.filter, priorityFilter === item.key && { backgroundColor: visual.primary }]}><Text style={[styles.filterText, priorityFilter === item.key && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</View>
      {permissions.generalReports && departmentOptions.length > 0 && <><Text style={styles.fieldLabel}>Departamento</Text><View style={styles.filters}>{['TODOS', ...departmentOptions].map((item) => <Pressable key={item} onPress={() => setDepartmentFilter(item)} style={[styles.filter, departmentFilter === item && { backgroundColor: visual.primary }]}><Text style={[styles.filterText, departmentFilter === item && styles.filterTextActive]}>{item === 'TODOS' ? 'Todos' : item}</Text></Pressable>)}</View></>}
      {!isLoading && !error && !isPreview && <Text style={styles.resultCount}>{incidents.length} reportes encontrados</Text>}
      {isLoading ? <LoadingState /> : error ? <ErrorState description={error} onRetry={reload} /> : isPreview ? <EmptyState title="Consulta real no disponible" description="Los reportes se mostrarán cuando la consulta real esté disponible." /> : incidents.length ? <View style={styles.list}>{incidents.map((item) => <IncidentCard key={item.id} incident={item} onPress={() => setSelectedId(item.id)} />)}</View> : <><EmptyState title={hasFilters ? 'Sin coincidencias' : 'Aún no hay reportes visibles'} description={hasFilters ? 'Prueba otra búsqueda o elimina los filtros.' : permissions.departmentReports ? 'Los reportes aparecerán cuando se canalicen a tu departamento.' : citizen ? 'Tus reportes aparecerán aquí después de registrarlos.' : 'Los reportes disponibles para tu cuenta aparecerán aquí.'} />{hasFilters && <AppButton label="Limpiar filtros" variant="secondary" onPress={resetFilters} />}</>}
    </>}
  </ScrollView>;
}
function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: spacing.md, gap: spacing.md },
  header: { borderRadius: radius.xl, padding: spacing.lg, overflow: 'hidden' },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  headerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  title: { fontSize: 25, lineHeight: 32, fontWeight: '800', color: colors.white },
  copy: { color: '#E3E9E1', marginTop: spacing.xs, lineHeight: 21 },
  headerSummary: { alignSelf: 'flex-start', marginTop: spacing.lg, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryValue: { color: colors.white, fontSize: 18, fontWeight: '900' },
  summaryLabel: { color: '#E3E9E1', fontSize: 12, fontWeight: '700' },
  filters: { alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', padding: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  filter: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.white },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.muted, fontWeight: '700' },
  filterTextActive: { color: colors.white },
  resultCount: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  list: { gap: spacing.md },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  backText: { color: colors.primary, fontWeight: '800' },
  detailCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  detailRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.secondary, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  detailValue: { color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '600', marginTop: spacing.xs },
  managementCard: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  managementHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  managementIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  managementTitleBlock: { flex: 1 },
  managementTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  managementCopy: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: '800' },
  statusOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusOption: { minHeight: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  statusOptionText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  statusOptionTextSelected: { color: colors.white },
  assignmentNotice: { borderRadius: radius.md, backgroundColor: colors.softGreen, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  assignmentNoticeText: { flex: 1, color: colors.primary, lineHeight: 19, fontWeight: '700' },
  searchInput: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, color: colors.text, fontSize: 15 },
  noteInput: { minHeight: 92, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, color: colors.text, fontSize: 15, textAlignVertical: 'top' },
  inlineError: { borderRadius: radius.md, backgroundColor: colors.dangerSoft, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  inlineErrorText: { flex: 1, color: colors.danger, lineHeight: 19, fontWeight: '700' },
  inlineSuccess: { borderRadius: radius.md, backgroundColor: colors.softGreen, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  inlineSuccessText: { flex: 1, color: colors.primary, lineHeight: 19, fontWeight: '700' },
  noTransitions: { minHeight: 64, borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noTransitionsText: { flex: 1, color: colors.muted, lineHeight: 19 }
});
