import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { IncidentCard } from '@/components/IncidentCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState, LoadingState } from '@/components/DataState';
import { useReports } from '@/hooks/useReports';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Incident, IncidentPriority, IncidentStatus } from '@/types/domain';
import { useSession } from '@/context/SessionContext';
import { roleVisuals } from '@/theme/roles';
import { listDepartments, listDepartmentStaff, updateReportManagement, updateReportStatus, uploadReportEvidence, type ReportAssignee, type ReportDepartment, type ReportEvidenceInput } from '@/services/reports';
import { AppButton } from '@/components/AppButton';

type Filter = 'TODOS' | 'ACTIVOS' | 'CERRADOS';
type PriorityFilter = 'TODAS' | IncidentPriority;
const filters: { key: Filter; label: string }[] = [{ key: 'TODOS', label: 'Todos' }, { key: 'ACTIVOS', label: 'Activos' }, { key: 'CERRADOS', label: 'Resueltos' }];
const priorities: IncidentPriority[] = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'];

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
  const { role, databaseRole, department } = useSession();
  const visual = roleVisuals[role];
  const { incidents: availableIncidents, isLoading, error, reload } = useReports();
  const [filter, setFilter] = useState<Filter>('TODOS');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('TODAS');
  const [departmentFilter, setDepartmentFilter] = useState('TODOS');
  const [selected, setSelected] = useState<Incident | null>(null);
  const [nextStatus, setNextStatus] = useState<IncidentStatus | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusError, setStatusError] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [departments, setDepartments] = useState<ReportDepartment[]>([]);
  const [staff, setStaff] = useState<ReportAssignee[]>([]);
  const [managementPriority, setManagementPriority] = useState<IncidentPriority>('MEDIA');
  const [managementDepartmentId, setManagementDepartmentId] = useState<number | null>(null);
  const [managementAssigneeId, setManagementAssigneeId] = useState<string | null>(null);
  const [managementMessage, setManagementMessage] = useState('');
  const [managementError, setManagementError] = useState('');
  const [isSavingManagement, setIsSavingManagement] = useState(false);
  const [workEvidence, setWorkEvidence] = useState<ReportEvidenceInput | null>(null);
  const [evidenceMessage, setEvidenceMessage] = useState('');
  const [evidenceError, setEvidenceError] = useState('');
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const canManageAssignment = databaseRole === 'administrador';
  const readableIncidents = availableIncidents;
  const departmentOptions = useMemo(() => Array.from(new Set(readableIncidents.map((item) => item.department))).sort(), [readableIncidents]);
  const incidents = useMemo(() => readableIncidents.filter((item) => {
    const matchesStatus = filter === 'TODOS' || (filter === 'CERRADOS' ? item.status === 'CERRADO' : item.status !== 'CERRADO');
    const normalizedSearch = search.trim().toLocaleLowerCase('es');
    const matchesSearch = !normalizedSearch || [item.code, item.title, item.category, item.location].some((value) => value.toLocaleLowerCase('es').includes(normalizedSearch));
    const matchesPriority = priorityFilter === 'TODAS' || item.priority === priorityFilter;
    const matchesDepartment = departmentFilter === 'TODOS' || item.department === departmentFilter;
    return matchesStatus && matchesSearch && matchesPriority && matchesDepartment;
  }), [readableIncidents, departmentFilter, filter, priorityFilter, search]);
  const heading = databaseRole === 'administrador' ? 'Reportes generales' : databaseRole === 'mantenimiento' ? `Asignaciones · ${department}` : databaseRole === 'operador' ? `Tareas asignadas · ${department}` : 'Mis reportes';
  const description = role === 'citizen' ? 'Consulta únicamente los reportes enviados desde tu cuenta.' : department ? `Consulta únicamente los casos de ${department}.` : 'Consulta reportes de todos los departamentos.';
  const availableTransitions = selected
    ? (databaseRole === 'mantenimiento' || databaseRole === 'operador' ? maintenanceTransitions[selected.status] : databaseRole === 'administrador' ? administrativeTransitions[selected.status] : []) ?? []
    : [];

  useEffect(() => {
    if (!canManageAssignment) return;
    listDepartments().then(setDepartments).catch(() => setManagementError('No fue posible cargar los departamentos.'));
  }, [canManageAssignment]);

  useEffect(() => {
    if (!canManageAssignment || !managementDepartmentId) return;
    listDepartmentStaff(managementDepartmentId).then(setStaff).catch(() => setManagementError('No fue posible cargar el personal del departamento.'));
  }, [canManageAssignment, managementDepartmentId]);

  const selectReport = (incident: Incident) => {
    setSelected(incident);
    setNextStatus(null);
    setStatusNote('');
    setStatusMessage('');
    setStatusError('');
    setManagementPriority(incident.priority);
    setManagementDepartmentId(incident.departmentId ?? null);
    setManagementAssigneeId(incident.assignedToId ?? null);
    if (!incident.departmentId) setStaff([]);
    setManagementMessage('');
    setManagementError('');
    setWorkEvidence(null);
    setEvidenceMessage('');
    setEvidenceError('');
  };

  const selectWorkEvidence = async () => {
    setEvidenceError(''); setEvidenceMessage('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1, selectionLimit: 1 });
      if (result.canceled || !result.assets[0]?.uri) return;
      const context = ImageManipulator.manipulate(result.assets[0].uri);
      context.resize({ width: 1600, height: null });
      const rendered = await context.renderAsync();
      const optimized = await rendered.saveAsync({ compress: 0.72, format: SaveFormat.JPEG });
      setWorkEvidence({ uri: optimized.uri, mimeType: 'image/jpeg' });
    } catch (selectionError) {
      setEvidenceError(selectionError instanceof Error ? selectionError.message : 'No fue posible preparar la fotografía.');
    }
  };

  const submitWorkEvidence = async () => {
    if (!selected || !workEvidence || isUploadingEvidence) return;
    setIsUploadingEvidence(true); setEvidenceError(''); setEvidenceMessage('');
    try {
      await uploadReportEvidence(selected.id, workEvidence);
      setWorkEvidence(null);
      setEvidenceMessage('La evidencia quedó asociada al historial del reporte.');
    } catch (uploadError) {
      setEvidenceError(uploadError instanceof Error ? uploadError.message : 'No fue posible adjuntar la evidencia.');
    } finally { setIsUploadingEvidence(false); }
  };

  const saveManagement = async () => {
    if (!selected || !managementDepartmentId || isSavingManagement) return;
    setIsSavingManagement(true); setManagementError(''); setManagementMessage('');
    try {
      const result = await updateReportManagement({ incidentId: selected.id, priority: managementPriority, departmentId: managementDepartmentId, assignedToId: managementAssigneeId });
      const departmentName = departments.find((item) => item.id === managementDepartmentId)?.name ?? selected.department;
      setSelected({ ...selected, priority: managementPriority, department: departmentName as Incident['department'], departmentId: managementDepartmentId, assignedToId: managementAssigneeId, updatedAt: result.updatedAt });
      setManagementMessage('La prioridad y asignación quedaron guardadas.');
      await reload();
    } catch (saveError) {
      setManagementError(saveError instanceof Error ? saveError.message : 'No fue posible guardar la asignación.');
    } finally { setIsSavingManagement(false); }
  };

  const changeStatus = async () => {
    if (!selected || !nextStatus || isUpdatingStatus) return;
    if (['RECHAZADO', 'POR_VERIFICAR', 'CERRADO'].includes(nextStatus) && !statusNote.trim()) {
      setStatusError('Agrega una nota para explicar este cambio de estado.');
      return;
    }
    setIsUpdatingStatus(true);
    setStatusMessage('');
    setStatusError('');
    try {
      const result = await updateReportStatus(selected.id, selected.status, nextStatus, statusNote, selected.category, managementDepartmentId);
      setSelected({ ...selected, status: nextStatus, updatedAt: result.updatedAt });
      setStatusMessage('El estado y la trazabilidad se actualizaron correctamente.');
      setNextStatus(null);
      setStatusNote('');
      await reload();
    } catch (updateError) {
      setStatusError(updateError instanceof Error ? updateError.message : 'No fue posible actualizar el reporte.');
    } finally {
      setIsUpdatingStatus(false);
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
      <Pressable style={styles.backButton} onPress={() => setSelected(null)}><Ionicons name="arrow-back" size={19} color={visual.primary} /><Text style={[styles.backText, { color: visual.primary }]}>Volver a reportes</Text></Pressable>
      <IncidentCard incident={selected} />
      <View style={styles.detailCard}>
        <DetailRow label="Fecha de registro" value={selected.createdAt} />
        <DetailRow label="Última actualización" value={selected.updatedAt} />
        <DetailRow label="Categoría" value={selected.category} />
        <DetailRow label="Prioridad" value={selected.priority} />
        <DetailRow label="Departamento" value={selected.department} />
        <DetailRow label="Ubicación" value={selected.location} />
        {selected.latitude != null && selected.longitude != null ? <DetailRow label="Coordenadas GPS" value={`${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(6)}`} /> : null}
        {databaseRole === 'administrador' ? <DetailRow label="Ciudadano" value={selected.citizenName} /> : null}
        {databaseRole === 'administrador' && selected.citizenEmail ? <DetailRow label="Correo" value={selected.citizenEmail} /> : null}
      </View>
      {canManageAssignment && <View style={styles.managementCard}>
        <View style={styles.managementHeader}><View style={[styles.managementIcon, { backgroundColor: `${visual.accent}22` }]}><Ionicons name="people-outline" size={22} color={visual.primary} /></View><View style={styles.managementTitleBlock}><Text style={styles.managementTitle}>Asignación operativa</Text><Text style={styles.managementCopy}>Define la urgencia, el área responsable y, si corresponde, una persona encargada.</Text></View></View>
        <Text style={styles.fieldLabel}>Prioridad</Text>
        <View style={styles.statusOptions}>{priorities.map((priority) => <Pressable key={priority} onPress={() => setManagementPriority(priority)} style={[styles.statusOption, managementPriority === priority && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.statusOptionText, managementPriority === priority && styles.statusOptionTextSelected]}>{priority.charAt(0) + priority.slice(1).toLowerCase()}</Text></Pressable>)}</View>
        <Text style={styles.fieldLabel}>Departamento responsable</Text>
        <View style={styles.statusOptions}>{departments.map((item) => <Pressable key={item.id} onPress={() => { setManagementDepartmentId(item.id); setManagementAssigneeId(null); setStaff([]); }} style={[styles.statusOption, managementDepartmentId === item.id && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.statusOptionText, managementDepartmentId === item.id && styles.statusOptionTextSelected]}>{item.name}</Text></Pressable>)}</View>
        {managementDepartmentId && <><Text style={styles.fieldLabel}>Responsable (opcional)</Text><View style={styles.statusOptions}><Pressable onPress={() => setManagementAssigneeId(null)} style={[styles.statusOption, !managementAssigneeId && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.statusOptionText, !managementAssigneeId && styles.statusOptionTextSelected]}>Sin asignar</Text></Pressable>{staff.map((item) => <Pressable key={item.id} onPress={() => setManagementAssigneeId(item.id)} style={[styles.statusOption, managementAssigneeId === item.id && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.statusOptionText, managementAssigneeId === item.id && styles.statusOptionTextSelected]}>{item.fullName}</Text></Pressable>)}</View>{!staff.length && <Text style={styles.helperText}>No hay personal activo disponible en esta área.</Text>}</>}
        {managementError ? <View style={styles.inlineError}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.inlineErrorText}>{managementError}</Text></View> : null}
        {managementMessage ? <View style={styles.inlineSuccess}><Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} /><Text style={styles.inlineSuccessText}>{managementMessage}</Text></View> : null}
        <AppButton disabled={!managementDepartmentId || isSavingManagement} label={isSavingManagement ? 'Guardando...' : 'Guardar asignación'} icon="save-outline" onPress={saveManagement} />
      </View>}
      {(databaseRole === 'administrador' || databaseRole === 'mantenimiento' || databaseRole === 'operador') && <View style={styles.managementCard}>
        <View style={styles.managementHeader}><View style={[styles.managementIcon, { backgroundColor: `${visual.accent}22` }]}><Ionicons name="git-branch-outline" size={22} color={visual.primary} /></View><View style={styles.managementTitleBlock}><Text style={styles.managementTitle}>Actualizar proceso</Text><Text style={styles.managementCopy}>Registra el siguiente avance permitido para este reporte.</Text></View></View>
        {availableTransitions.length ? <>
          <Text style={styles.fieldLabel}>Siguiente estado</Text>
          <View style={styles.statusOptions}>{availableTransitions.map((status) => <Pressable key={status} onPress={() => { setNextStatus(status); setStatusError(''); setStatusMessage(''); }} style={[styles.statusOption, nextStatus === status && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.statusOptionText, nextStatus === status && styles.statusOptionTextSelected]}>{statusLabels[status]}</Text></Pressable>)}</View>
          {nextStatus === 'ASIGNADO' && <View style={styles.assignmentNotice}><Ionicons name="business-outline" size={19} color={visual.primary} /><Text style={styles.assignmentNoticeText}>{managementDepartmentId ? `El reporte se enviará a ${departments.find((item) => item.id === managementDepartmentId)?.name ?? 'el departamento seleccionado'}.` : 'Selecciona y guarda primero el departamento responsable en la sección anterior.'}</Text></View>}
          <Text style={styles.fieldLabel}>Nota del cambio</Text>
          <TextInput value={statusNote} onChangeText={setStatusNote} multiline maxLength={300} placeholder="Agrega una observación para la trazabilidad..." placeholderTextColor={colors.muted} style={styles.noteInput} />
          {statusError ? <View style={styles.inlineError}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.inlineErrorText}>{statusError}</Text></View> : null}
          {statusMessage ? <View style={styles.inlineSuccess}><Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} /><Text style={styles.inlineSuccessText}>{statusMessage}</Text></View> : null}
          <AppButton disabled={!nextStatus || isUpdatingStatus || (nextStatus === 'ASIGNADO' && canManageAssignment && !managementDepartmentId)} label={isUpdatingStatus ? 'Actualizando...' : 'Confirmar cambio'} icon="checkmark-circle-outline" onPress={changeStatus} />
        </> : <View style={styles.noTransitions}><Ionicons name="lock-closed-outline" size={20} color={colors.muted} /><Text style={styles.noTransitionsText}>{selected.status === 'CERRADO' ? 'Este reporte ya está cerrado.' : 'No hay cambios disponibles para tu rol en el estado actual.'}</Text></View>}
      </View>}
      {(databaseRole === 'administrador' || databaseRole === 'mantenimiento' || databaseRole === 'operador') && <View style={styles.managementCard}>
        <View style={styles.managementHeader}><View style={[styles.managementIcon, { backgroundColor: `${visual.accent}22` }]}><Ionicons name="camera-outline" size={22} color={visual.primary} /></View><View style={styles.managementTitleBlock}><Text style={styles.managementTitle}>Evidencia de atención</Text><Text style={styles.managementCopy}>Adjunta una fotografía del avance o del trabajo realizado. Se optimizará antes de subirla.</Text></View></View>
        {workEvidence ? <View style={styles.evidenceReady}><Ionicons name="image-outline" size={23} color={visual.primary} /><View style={styles.managementTitleBlock}><Text style={styles.evidenceReadyTitle}>Fotografía preparada</Text><Text style={styles.helperText}>Lista para asociarse al reporte {selected.code}.</Text></View><Pressable onPress={() => setWorkEvidence(null)}><Ionicons name="close-circle" size={22} color={colors.muted} /></Pressable></View> : null}
        <View style={styles.evidenceActions}><AppButton label={workEvidence ? 'Cambiar fotografía' : 'Seleccionar fotografía'} icon="images-outline" disabled={isUploadingEvidence} onPress={selectWorkEvidence} /><AppButton label={isUploadingEvidence ? 'Subiendo...' : 'Adjuntar evidencia'} icon="cloud-upload-outline" disabled={!workEvidence || isUploadingEvidence} onPress={submitWorkEvidence} /></View>
        {evidenceError ? <View style={styles.inlineError}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.inlineErrorText}>{evidenceError}</Text></View> : null}
        {evidenceMessage ? <View style={styles.inlineSuccess}><Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} /><Text style={styles.inlineSuccessText}>{evidenceMessage}</Text></View> : null}
      </View>}
    </> : <>
      <View style={styles.filterPanel}>
        <View style={styles.searchBox}><Ionicons name="search-outline" size={20} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Buscar por código, título, categoría o ubicación" placeholderTextColor={colors.muted} style={styles.searchInput} /><Pressable disabled={!search} onPress={() => setSearch('')} style={styles.clearSearch}><Ionicons name="close-circle" size={19} color={search ? colors.muted : colors.border} /></Pressable></View>
        <View style={styles.filterGroup}><Text style={styles.filterLabel}>Estado</Text><View style={styles.filters}>{filters.map((item) => <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.filter, filter === item.key && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</View></View>
        <View style={styles.filterGroup}><Text style={styles.filterLabel}>Prioridad</Text><View style={styles.filters}>{(['TODAS', ...priorities] as PriorityFilter[]).map((item) => <Pressable key={item} onPress={() => setPriorityFilter(item)} style={[styles.filter, priorityFilter === item && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.filterText, priorityFilter === item && styles.filterTextActive]}>{item === 'TODAS' ? 'Todas' : item.charAt(0) + item.slice(1).toLowerCase()}</Text></Pressable>)}</View></View>
        {canManageAssignment && departmentOptions.length > 1 && <View style={styles.filterGroup}><Text style={styles.filterLabel}>Departamento</Text><View style={styles.filters}><Pressable onPress={() => setDepartmentFilter('TODOS')} style={[styles.filter, departmentFilter === 'TODOS' && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.filterText, departmentFilter === 'TODOS' && styles.filterTextActive]}>Todos</Text></Pressable>{departmentOptions.map((item) => <Pressable key={item} onPress={() => setDepartmentFilter(item)} style={[styles.filter, departmentFilter === item && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.filterText, departmentFilter === item && styles.filterTextActive]}>{item}</Text></Pressable>)}</View></View>}
      </View>
      {!isLoading && !error && <Text style={styles.resultCount}>{incidents.length} {incidents.length === 1 ? 'reporte encontrado' : 'reportes encontrados'}</Text>}
      {isLoading ? <LoadingState /> : error ? <ErrorState description={error} onRetry={reload} /> : incidents.length ? <View style={styles.list}>{incidents.map((item) => <IncidentCard key={item.id} incident={item} compact onPress={() => selectReport(item)} />)}</View> : <View style={styles.list}><EmptyState title="Sin coincidencias" description="Cambia la búsqueda o alguno de los filtros para consultar otros casos." /><AppButton label="Limpiar filtros" variant="secondary" onPress={() => { setSearch(''); setFilter('TODOS'); setPriorityFilter('TODAS'); setDepartmentFilter('TODOS'); }} /></View>}
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
  filterPanel: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: spacing.sm },
  clearSearch: { padding: spacing.xs },
  filterGroup: { gap: spacing.xs },
  filterLabel: { color: colors.secondary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  filters: { alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
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
  noTransitionsText: { flex: 1, color: colors.muted, lineHeight: 19 },
  helperText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  evidenceReady: { borderRadius: radius.md, backgroundColor: colors.softGreen, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  evidenceReadyTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  evidenceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }
});
