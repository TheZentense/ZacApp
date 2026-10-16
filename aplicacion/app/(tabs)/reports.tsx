import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IncidentCard } from '@/components/IncidentCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState, LoadingState } from '@/components/DataState';
import { useReports } from '@/hooks/useReports';
import { colors, radius, spacing } from '@/theme/tokens';
import { isIncidentPriority, type Incident, type IncidentStatus } from '@/types/domain';
import { useSession } from '@/context/SessionContext';
import { roleVisuals } from '@/theme/roles';
import { updateReportStatus } from '@/services/reports';
import { AppButton } from '@/components/AppButton';
import { backendPendingMessage } from '@/lib/backendCapabilities';

type OperationalFilter = 'TODOS' | 'PENDIENTES' | 'ASIGNADO' | 'EN_ATENCION' | 'POR_VERIFICAR' | 'CERRADO' | 'RECHAZADO';
type Filter = OperationalFilter | 'ACTIVOS';
type FilterOption = { key: Filter; label: string };

const citizenFilters: FilterOption[] = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'ACTIVOS', label: 'Activos' },
  { key: 'CERRADO', label: 'Resueltos' }
];

const operationalFilters: FilterOption[] = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'PENDIENTES', label: 'Pendientes' },
  { key: 'ASIGNADO', label: 'Asignados' },
  { key: 'EN_ATENCION', label: 'En atención' },
  { key: 'POR_VERIFICAR', label: 'Por verificar' },
  { key: 'CERRADO', label: 'Cerrados' },
  { key: 'RECHAZADO', label: 'Rechazados' }
];

const operationalFilterByStatus: Record<IncidentStatus, Exclude<OperationalFilter, 'TODOS'>> = {
  REGISTRADO: 'PENDIENTES',
  EN_REVISION: 'PENDIENTES',
  VALIDADO: 'PENDIENTES',
  ASIGNADO: 'ASIGNADO',
  EN_ATENCION: 'EN_ATENCION',
  POR_VERIFICAR: 'POR_VERIFICAR',
  CERRADO: 'CERRADO',
  RECHAZADO: 'RECHAZADO'
};

function matchesFilter(status: IncidentStatus, filter: Filter) {
  if (filter === 'TODOS') return true;
  if (filter === 'ACTIVOS') return status !== 'CERRADO';
  return operationalFilterByStatus[status] === filter;
}

function formatPriority(value: unknown): string {
  if (value === undefined) return 'no consultada';
  return isIncidentPriority(value) ? String(value) : 'no disponible';
}

const statusLabels: Record<IncidentStatus, string> = {
  REGISTRADO: 'Registrado',
  EN_REVISION: 'En revisión',
  VALIDADO: 'Validado',
  ASIGNADO: 'Asignado',
  EN_ATENCION: 'En atención',
  POR_VERIFICAR: 'Por verificar',
  CERRADO: 'Resuelto',
  RECHAZADO: 'Rechazado'
};

const administrativeTransitions: Partial<Record<IncidentStatus, IncidentStatus[]>> = {
  REGISTRADO: ['EN_REVISION', 'RECHAZADO'],
  EN_REVISION: ['VALIDADO', 'RECHAZADO'],
  VALIDADO: ['ASIGNADO', 'RECHAZADO'],
  ASIGNADO: ['EN_ATENCION'],
  EN_ATENCION: ['POR_VERIFICAR'],
  POR_VERIFICAR: ['CERRADO', 'EN_ATENCION'],
  RECHAZADO: ['EN_REVISION']
};

const maintenanceTransitions: Partial<Record<IncidentStatus, IncidentStatus[]>> = {
  ASIGNADO: ['EN_ATENCION'],
  EN_ATENCION: ['POR_VERIFICAR']
};

export default function ReportsScreen() {
  const { role, department, databaseRole } = useSession();
  const visual = roleVisuals[role];
  const { incidents: availableIncidents, isLoading, error, reload } = useReports();
  const [filter, setFilter] = useState<Filter>('TODOS');
  const filters = role === 'citizen' ? citizenFilters : operationalFilters;
  const selectedFilter = filters.find((item) => item.key === filter) ?? filters[0];
  const [selected, setSelected] = useState<Incident | null>(null);
  const [nextStatus, setNextStatus] = useState<IncidentStatus | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusError, setStatusError] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('TODAS');
  const [departmentFilter, setDepartmentFilter] = useState('TODOS');
  const requestInFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const departmentOptions = useMemo(() => Array.from(new Set(availableIncidents.map((item) => item.department).filter((name): name is string => Boolean(name)))).sort(), [availableIncidents]);
  const incidents = useMemo(() => availableIncidents.filter((item) => {
    const query = search.trim().toLocaleLowerCase('es');
    const matchesSearch = !query || [item.code, item.title, item.category, item.location].some((value) => value.toLocaleLowerCase('es').includes(query));
    const matchesPriority = priorityFilter === 'TODAS' || (priorityFilter === 'DESCONOCIDA' ? item.priority === undefined : priorityFilter === 'INVALIDA' ? item.priority === null : item.priority === Number(priorityFilter));
    const matchesDepartment = departmentFilter === 'TODOS' || item.department === departmentFilter;
    return matchesFilter(item.status, selectedFilter.key) && matchesSearch && matchesPriority && matchesDepartment;
  }), [availableIncidents, departmentFilter, priorityFilter, search, selectedFilter.key]);
  const heading = role === 'superadmin' ? 'Reportes generales' : role === 'admin' ? 'Gestión de reportes' : role === 'maintenance' ? `Asignaciones · ${department}` : role === 'employee' ? `Reportes del área · ${department}` : 'Mis reportes';
  const description = role === 'citizen' ? 'Consulta únicamente los reportes enviados desde tu cuenta.' : department ? `Consulta únicamente los casos de ${department}.` : 'Consulta reportes de todos los departamentos.';
  const availableTransitions = selected && databaseRole && ['administrador', 'supervisor', 'coordinador', 'operador', 'mantenimiento'].includes(databaseRole)
    ? (role === 'maintenance' ? maintenanceTransitions[selected.status] : role === 'citizen' ? [] : administrativeTransitions[selected.status]) ?? []
    : [];

  const selectReport = (incident: Incident) => {
    setSelected(incident);
    setNextStatus(null);
    setStatusNote('');
    setStatusMessage('');
    setStatusError('');
  };

  const changeStatus = async () => {
    if (!selected || !nextStatus || requestInFlight.current) return;
    if (['RECHAZADO', 'POR_VERIFICAR', 'CERRADO'].includes(nextStatus) && !statusNote.trim()) { setStatusError('Agrega una observación para este cambio de estado.'); return; }
    requestInFlight.current = true;
    setIsUpdatingStatus(true);
    setStatusMessage('');
    setStatusError('');
    try {
      const result = await updateReportStatus(selected.id, selected.status, nextStatus, statusNote, selected.category);
      if (!mounted.current) return;
      setSelected({ ...selected, status: nextStatus, updatedAt: result.updatedAt });
      setStatusMessage(result.historyRecorded ? 'El estado y la trazabilidad se actualizaron correctamente.' : 'El estado se actualizó, pero el historial requiere revisión.');
      setNextStatus(null);
      setStatusNote('');
      await reload();
    } catch (updateError) {
      if (mounted.current) setStatusError(updateError instanceof Error ? updateError.message : 'No fue posible actualizar el reporte.');
    } finally {
      requestInFlight.current = false;
      if (mounted.current) setIsUpdatingStatus(false);
    }
  };

  return <ScrollView style={[styles.scroll, { backgroundColor: visual.background }]} contentContainerStyle={styles.page}>
    <View style={[styles.header, { backgroundColor: visual.primary }]}>
      <View style={styles.headerTop}><View style={[styles.headerIcon, { backgroundColor: visual.accent }]}><Ionicons name={role === 'maintenance' ? 'clipboard-outline' : 'documents-outline'} size={24} color={visual.primary} /></View><Text style={[styles.eyebrow, { color: visual.accent }]}>{visual.eyebrow}</Text></View>
      <Text style={styles.title}>{selected ? 'Detalle del reporte' : heading}</Text>
      <Text style={styles.copy}>{selected ? 'Información y estado actual de la incidencia seleccionada.' : description}</Text>
      {!selected && <View style={styles.headerSummary}><Text style={styles.summaryValue}>{incidents.length}</Text><Text style={styles.summaryLabel}>{incidents.length === 1 ? 'caso visible' : 'casos visibles'} para este acceso</Text></View>}
    </View>
    {selected ? <>
      <Pressable disabled={isUpdatingStatus} style={styles.backButton} onPress={() => setSelected(null)}><Ionicons name="arrow-back" size={19} color={visual.primary} /><Text style={[styles.backText, { color: visual.primary }]}>Volver a reportes</Text></Pressable>
      <IncidentCard incident={selected} />
      <View style={styles.detailCard}>
        <DetailRow label="Fecha de registro" value={selected.createdAt} />
        <DetailRow label="Última actualización" value={selected.updatedAt} />
        <DetailRow label="Categoría" value={selected.category} />
        <DetailRow label="Ubicación" value={selected.location} />
        <DetailRow label="Prioridad:" value={formatPriority(selected.priority)} />
        <DetailRow label="Departamento asignado" value={selected.department ?? 'Sin asignación disponible'} />
      </View>
      {role !== 'citizen' && <View style={styles.managementCard}><Text style={styles.managementTitle}>Asignación y evidencia de atención</Text><Text style={styles.managementCopy}>{backendPendingMessage} Se conserva la consulta de asignaciones y el flujo actual de estados.</Text><AppButton label="Asignar responsable y prioridad · pendiente" disabled onPress={() => {}} /><AppButton label="Adjuntar evidencia de atención · pendiente" disabled onPress={() => {}} /></View>}
      {role !== 'citizen' && <View style={styles.managementCard}>
        <View style={styles.managementHeader}><View style={[styles.managementIcon, { backgroundColor: `${visual.accent}22` }]}><Ionicons name="git-branch-outline" size={22} color={visual.primary} /></View><View style={styles.managementTitleBlock}><Text style={styles.managementTitle}>Actualizar proceso</Text><Text style={styles.managementCopy}>Registra el siguiente avance permitido para este reporte.</Text></View></View>
        {availableTransitions.length ? <>
          <Text style={styles.fieldLabel}>Siguiente estado</Text>
          <View style={styles.statusOptions}>{availableTransitions.map((status) => <Pressable key={status} onPress={() => { setNextStatus(status); setStatusError(''); setStatusMessage(''); }} style={[styles.statusOption, nextStatus === status && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.statusOptionText, nextStatus === status && styles.statusOptionTextSelected]}>{statusLabels[status]}</Text></Pressable>)}</View>
          {nextStatus === 'ASIGNADO' && <View style={styles.assignmentNotice}><Ionicons name="business-outline" size={19} color={visual.primary} /><Text style={styles.assignmentNoticeText}>Se asignará automáticamente al departamento de {selected.category}.</Text></View>}
          <Text style={styles.fieldLabel}>Nota del cambio</Text>
          <TextInput value={statusNote} onChangeText={setStatusNote} multiline maxLength={300} placeholder="Agrega una observación para la trazabilidad..." placeholderTextColor={colors.muted} style={styles.noteInput} />
          {statusError ? <View style={styles.inlineError}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.inlineErrorText}>{statusError}</Text></View> : null}
          {statusMessage ? <View style={styles.inlineSuccess}><Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} /><Text style={styles.inlineSuccessText}>{statusMessage}</Text></View> : null}
          <AppButton disabled={!nextStatus || isUpdatingStatus} label={isUpdatingStatus ? 'Actualizando...' : 'Confirmar cambio'} icon="checkmark-circle-outline" onPress={changeStatus} />
        </> : <View style={styles.noTransitions}><Ionicons name="lock-closed-outline" size={20} color={colors.muted} /><Text style={styles.noTransitionsText}>{selected.status === 'CERRADO' ? 'Este reporte ya está cerrado.' : 'No hay cambios disponibles para tu rol en el estado actual.'}</Text></View>}
      </View>}
    </> : <>
      <TextInput style={styles.noteInput} accessibilityLabel="Buscar reportes" value={search} onChangeText={setSearch} placeholder="Buscar por código, título, categoría o ubicación" placeholderTextColor={colors.muted} />
      <View style={styles.filters}>{filters.map((item) => <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: selectedFilter.key === item.key }} onPress={() => setFilter(item.key)} style={[styles.filter, selectedFilter.key === item.key && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.filterText, selectedFilter.key === item.key && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</View>
      <Text style={styles.fieldLabel}>Prioridad</Text>
      <View style={styles.filters}>{[{ key: 'TODAS', label: 'Todas' }, ...[1, 2, 3, 4].map((value) => ({ key: String(value), label: String(value) })), { key: 'DESCONOCIDA', label: 'No consultada' }, { key: 'INVALIDA', label: 'No disponible' }].map((item) => <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: priorityFilter === item.key }} onPress={() => setPriorityFilter(item.key)} style={[styles.filter, priorityFilter === item.key && { backgroundColor: visual.primary }]}><Text style={[styles.filterText, priorityFilter === item.key && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</View>
      {(role === 'admin' || role === 'superadmin') && departmentOptions.length > 0 && <><Text style={styles.fieldLabel}>Departamento</Text><View style={styles.filters}>{['TODOS', ...departmentOptions].map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: departmentFilter === item }} onPress={() => setDepartmentFilter(item)} style={[styles.filter, departmentFilter === item && { backgroundColor: visual.primary }]}><Text style={[styles.filterText, departmentFilter === item && styles.filterTextActive]}>{item === 'TODOS' ? 'Todos' : item}</Text></Pressable>)}</View></>}
      {!isLoading && !error && <Text style={styles.resultCount}>{incidents.length} {incidents.length === 1 ? 'reporte encontrado' : 'reportes encontrados'}</Text>}
      {isLoading ? <LoadingState /> : error ? <ErrorState description={error} onRetry={reload} /> : incidents.length ? <View style={styles.list}>{incidents.map((item) => <IncidentCard key={item.id} incident={item} compact onPress={() => selectReport(item)} />)}</View> : <EmptyState title={selectedFilter.key === 'TODOS' ? 'No hay reportes con estos criterios' : `No hay reportes en «${selectedFilter.label}»`} description="Cambia la búsqueda o alguno de los filtros para consultar otros casos." />}
    </>}
  </ScrollView>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  header: { borderRadius: radius.xl, padding: spacing.lg, overflow: 'hidden' },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  headerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  title: { fontSize: 28, fontWeight: '800', color: colors.white },
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
  detailLabel: { color: colors.secondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  detailValue: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: spacing.xs },
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
  noteInput: { minHeight: 92, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, color: colors.text, fontSize: 15, textAlignVertical: 'top' },
  inlineError: { borderRadius: radius.md, backgroundColor: colors.dangerSoft, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  inlineErrorText: { flex: 1, color: colors.danger, lineHeight: 19, fontWeight: '700' },
  inlineSuccess: { borderRadius: radius.md, backgroundColor: colors.softGreen, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  inlineSuccessText: { flex: 1, color: colors.primary, lineHeight: 19, fontWeight: '700' },
  noTransitions: { minHeight: 64, borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noTransitionsText: { flex: 1, color: colors.muted, lineHeight: 19 }
});
