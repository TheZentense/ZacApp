import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { getReporterContact, listDepartments, listDepartmentStaff, listReportEvidence, updateReportManagement, updateReportStatus, uploadReportEvidence, type ReporterContact, type ReportAssignee, type ReportDepartment, type ReportEvidence, type ReportEvidenceInput, type StaffEvidenceKind } from '@/services/reports';
import { AppButton } from '@/components/AppButton';
import { IncidentHeatmap, ReportLocationMap } from '@/components/IncidentLocation';
import { supabase } from '@/lib/supabase';
import { PaginationControls } from '@/components/PaginationControls';

type Filter = 'TODOS' | 'ACTIVOS' | 'CERRADOS';
type PriorityFilter = 'TODAS' | IncidentPriority;
type WorkStage = 'TODAS' | 'PENDIENTES' | 'EN_CURSO' | 'FINALIZADAS';
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
  VALIDADO: ['RECHAZADO'],
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
  const { role, databaseRole, department, userId, isAuthenticated } = useSession();
  const visual = roleVisuals[role];
  const { incidents: availableIncidents, isLoading, error, reload } = useReports();
  const [filter, setFilter] = useState<Filter>('ACTIVOS');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('TODAS');
  const [departmentFilter, setDepartmentFilter] = useState('TODOS');
  const [workStage, setWorkStage] = useState<WorkStage>('TODAS');
  const [selectedItem, setSelected] = useState<Incident | null>(null);
  const selected = availableIncidents.find((item) => item.id === selectedItem?.id) ?? null;
  const [reporterContact, setReporterContact] = useState<{ incidentId: string; userId: string | null; value: ReporterContact | null } | null>(null);
  const [contactError, setContactError] = useState<{ incidentId: string; userId: string | null; message: string } | null>(null);
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
  const [managementNote, setManagementNote] = useState('');
  const [managementMessage, setManagementMessage] = useState('');
  const [managementError, setManagementError] = useState('');
  const [isSavingManagement, setIsSavingManagement] = useState(false);
  const [workEvidence, setWorkEvidence] = useState<ReportEvidenceInput | null>(null);
  const [evidenceMessage, setEvidenceMessage] = useState('');
  const [evidenceError, setEvidenceError] = useState('');
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [existingEvidence, setExistingEvidence] = useState<ReportEvidence[]>([]);
  const [evidenceOwner, setEvidenceOwner] = useState('');
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);
  const [evidenceRevision, setEvidenceRevision] = useState(0);
  const [staffEvidenceKind, setStaffEvidenceKind] = useState<StaffEvidenceKind>('AVANCE');
  const canManageAssignment = databaseRole === 'administrador';
  const isFieldRole = databaseRole === 'mantenimiento' || databaseRole === 'operador';
  const canAssignSelected = canManageAssignment && selected?.status === 'VALIDADO' && !selected.assignedToId && !selected.departmentId;
  const readableIncidents = availableIncidents;
  const departmentOptions = useMemo(() => Array.from(new Set(readableIncidents.map((item) => item.department))).sort(), [readableIncidents]);
  const incidents = useMemo(() => readableIncidents.filter((item) => {
    const matchesStatus = filter === 'TODOS' || (filter === 'CERRADOS' ? item.status === 'CERRADO' : item.status !== 'CERRADO');
    const normalizedSearch = search.trim().toLocaleLowerCase('es');
    const matchesSearch = !normalizedSearch || [item.code, item.title, item.category, item.location].some((value) => value.toLocaleLowerCase('es').includes(normalizedSearch));
    const matchesPriority = priorityFilter === 'TODAS' || item.priority === priorityFilter;
    const matchesDepartment = departmentFilter === 'TODOS' || item.department === departmentFilter;
    const matchesWorkStage = !isFieldRole || workStage === 'TODAS'
      || (workStage === 'PENDIENTES' && item.status === 'ASIGNADO')
      || (workStage === 'EN_CURSO' && (item.status === 'EN_ATENCION' || item.status === 'POR_VERIFICAR'))
      || (workStage === 'FINALIZADAS' && item.status === 'CERRADO');
    return matchesStatus && matchesSearch && matchesPriority && matchesDepartment && matchesWorkStage;
  }).sort((left, right) => {
    const rank = (status: IncidentStatus) => status === 'REGISTRADO' ? 0 : status === 'EN_REVISION' ? 1 : status === 'VALIDADO' ? 2 : status === 'ASIGNADO' ? 3 : status === 'EN_ATENCION' ? 4 : status === 'POR_VERIFICAR' ? 5 : 6;
    return rank(left.status) - rank(right.status);
  }), [readableIncidents, departmentFilter, filter, isFieldRole, priorityFilter, search, workStage]);
  const workSummary = useMemo(() => ({
    pending: readableIncidents.filter((item) => item.status === 'ASIGNADO').length,
    active: readableIncidents.filter((item) => item.status === 'EN_ATENCION' || item.status === 'POR_VERIFICAR').length,
    closed: readableIncidents.filter((item) => item.status === 'CERRADO').length
  }), [readableIncidents]);
  const pageCount = Math.max(1, Math.ceil(incidents.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedIncidents = incidents.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const heading = databaseRole === 'administrador' || databaseRole === 'supervisor' ? 'Reportes generales' : databaseRole === 'mantenimiento' ? `Asignaciones · ${department}` : databaseRole === 'operador' ? `Tareas asignadas · ${department}` : databaseRole === 'coordinador' || databaseRole === 'comunicacion' ? `Reportes · ${department}` : 'Mis reportes';
  const description = role === 'citizen' ? 'Consulta únicamente los reportes enviados desde tu cuenta.' : databaseRole === 'administrador' || databaseRole === 'supervisor' ? 'Consulta reportes de todos los departamentos.' : `Consulta únicamente los casos de ${department}.`;
  const availableTransitions = selected
    ? (databaseRole === 'mantenimiento' || databaseRole === 'operador' ? maintenanceTransitions[selected.status] : databaseRole === 'administrador' ? administrativeTransitions[selected.status] : []) ?? []
    : [];
  const selectedIncidentId = selected?.id;
  const evidenceIdentityKey = JSON.stringify([userId, databaseRole, selectedIncidentId]);
  const visibleEvidence = evidenceOwner === evidenceIdentityKey ? existingEvidence : [];
  const visibleContact = reporterContact && reporterContact.incidentId === selectedIncidentId && reporterContact.userId === userId ? reporterContact.value : null;
  const visibleContactError = contactError && contactError.incidentId === selectedIncidentId && contactError.userId === userId ? contactError.message : '';

  useEffect(() => {
    if (!canManageAssignment) return;
    listDepartments().then(setDepartments).catch(() => setManagementError('No fue posible cargar los departamentos.'));
  }, [canManageAssignment]);

  useEffect(() => {
    if (!canManageAssignment || !managementDepartmentId) return;
    let active = true;
    listDepartmentStaff(managementDepartmentId)
      .then((people) => { if (active) setStaff(people); })
      .catch(() => { if (active) setManagementError('No fue posible cargar el personal del departamento.'); });
    return () => { active = false; };
  }, [canManageAssignment, managementDepartmentId]);

  useEffect(() => {
    if (!selectedIncidentId || !userId || !isAuthenticated) return;
    let active = true;
    listReportEvidence(selectedIncidentId)
      .then((items) => { if (active) { setExistingEvidence(items); setEvidenceOwner(evidenceIdentityKey); setEvidenceError(''); } })
      .catch(() => { if (active) { setExistingEvidence([]); setEvidenceOwner(evidenceIdentityKey); setEvidenceError('No fue posible abrir las fotografías del reporte.'); } })
      .finally(() => { if (active) setIsLoadingEvidence(false); });
    return () => { active = false; };
  }, [evidenceIdentityKey, evidenceRevision, isAuthenticated, selectedIncidentId, userId]);

  useEffect(() => {
    const client = supabase;
    if (!client || !selectedIncidentId || !userId || !isAuthenticated) return;
    let active = true;
    const refresh = () => { if (active) setEvidenceRevision((value) => value + 1); };
    const channel = client.channel(`report-evidence-${selectedIncidentId}-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incident_evidence', filter: `incident_id=eq.${selectedIncidentId}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incident_evidence', filter: `incident_id=eq.${selectedIncidentId}` }, refresh)
      .subscribe((status) => { if (active && status === 'SUBSCRIBED') refresh(); });
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    // Reconcile missed changes and renew private URLs before their 15-minute expiry.
    const fallback = setInterval(refresh, 2 * 60_000);
    return () => {
      active = false;
      clearInterval(fallback);
      appState.remove();
      void client.removeChannel(channel);
    };
  }, [isAuthenticated, selectedIncidentId, userId]);

  useEffect(() => {
    if (databaseRole !== 'administrador' || !selectedIncidentId) return;
    let active = true;
    getReporterContact(selectedIncidentId)
      .then((contact) => { if (active) setReporterContact({ incidentId: selectedIncidentId, userId, value: contact }); })
      .catch(() => { if (active) setContactError({ incidentId: selectedIncidentId, userId, message: 'No fue posible consultar el contacto del ciudadano.' }); });
    return () => { active = false; };
  }, [databaseRole, selectedIncidentId, userId]);

  const selectReport = (incident: Incident) => {
    setReporterContact(null);
    setContactError(null);
    setIsLoadingEvidence(true);
    setEvidenceError('');
    setExistingEvidence([]);
    setEvidenceOwner('');
    setSelected(incident);
    setNextStatus(null);
    setStatusNote('');
    setStatusMessage('');
    setStatusError('');
    setManagementPriority(incident.priority);
    setManagementDepartmentId(incident.departmentId ?? null);
    setManagementAssigneeId(incident.assignedToId ?? null);
    setManagementNote('');
    if (!incident.departmentId) setStaff([]);
    setManagementMessage('');
    setManagementError('');
    setWorkEvidence(null);
    setEvidenceMessage('');
    setEvidenceError('');
    setExistingEvidence([]);
    setStaffEvidenceKind(incident.status === 'POR_VERIFICAR' || incident.status === 'CERRADO' ? 'FINAL' : 'AVANCE');
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
      await uploadReportEvidence(selected.id, workEvidence, staffEvidenceKind);
      setWorkEvidence(null);
      setEvidenceMessage('La evidencia quedó asociada al historial del reporte.');
      setEvidenceRevision((value) => value + 1);
    } catch (uploadError) {
      setEvidenceError(uploadError instanceof Error ? uploadError.message : 'No fue posible adjuntar la evidencia.');
    } finally { setIsUploadingEvidence(false); }
  };

  const saveManagement = async () => {
    if (!selected || !canAssignSelected || !managementDepartmentId || !managementAssigneeId || !managementNote.trim() || isSavingManagement) return;
    setIsSavingManagement(true); setManagementError(''); setManagementMessage('');
    try {
      await updateReportManagement({ incidentId: selected.id, previousStatus: selected.status, priority: managementPriority, departmentId: managementDepartmentId, assignedToId: managementAssigneeId, note: managementNote });
      setManagementNote('');
      setManagementMessage('El reporte quedó asignado y el cambio se registró en el historial.');
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
      await updateReportStatus(selected.id, selected.status, nextStatus, statusNote);
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
        {databaseRole === 'administrador' ? <DetailRow label="Ciudadano" value={visibleContact?.name || 'Anónimo'} /> : null}
        {databaseRole === 'administrador' && visibleContact?.email ? <DetailRow label="Correo" value={visibleContact.email} /> : null}
        {databaseRole === 'administrador' && visibleContactError && visibleContact ? <Text style={styles.inlineErrorText}>{visibleContactError}</Text> : null}
      </View>
      {databaseRole !== 'ciudadano' && selected.latitude != null && selected.longitude != null ? <ReportLocationMap latitude={selected.latitude} longitude={selected.longitude} label={selected.location} /> : null}
      <View style={styles.managementCard}>
        <View style={styles.managementHeader}><View style={[styles.managementIcon, { backgroundColor: `${visual.accent}22` }]}><Ionicons name="images-outline" size={22} color={visual.primary} /></View><View style={styles.managementTitleBlock}><Text style={styles.managementTitle}>Evidencias del reporte</Text><Text style={styles.managementCopy}>Fotografías iniciales y evidencias agregadas durante la atención.</Text></View></View>
        {databaseRole === 'ciudadano' && selected.status === 'CERRADO' ? <View style={styles.resolutionNotice}><Ionicons name="checkmark-done-circle-outline" size={22} color={colors.primary} /><Text style={styles.resolutionNoticeText}>{visibleEvidence.some((item) => item.kind === 'FINAL') ? 'El departamento adjuntó evidencia del trabajo finalizado.' : 'El reporte fue resuelto. La fotografía del resultado es opcional y el departamento no adjuntó una.'}</Text></View> : null}
        {isLoadingEvidence ? <View style={styles.evidenceLoading}><ActivityIndicator color={visual.primary} /><Text style={styles.helperText}>Abriendo fotografías protegidas...</Text></View> : visibleEvidence.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.evidenceGallery}>{visibleEvidence.map((item, index) => <View key={item.id} style={styles.evidenceItem}><Image accessibilityLabel={`Evidencia ${index + 1} del reporte`} source={{ uri: item.url }} style={styles.evidenceImage} /><Text style={styles.evidenceCaption}>{item.kind === 'INICIAL' ? 'Evidencia inicial' : item.kind === 'ADICIONAL' ? 'Evidencia ciudadana' : item.kind === 'FINAL' ? 'Resultado del departamento' : item.kind === 'AVANCE' ? 'Avance del departamento' : `Evidencia ${index + 1}`} · {item.createdAt}</Text></View>)}</ScrollView> : <View style={styles.noTransitions}><Ionicons name="image-outline" size={20} color={colors.muted} /><Text style={styles.noTransitionsText}>{evidenceError || 'Este reporte todavía no tiene fotografías disponibles.'}</Text></View>}
      </View>
      {canAssignSelected && <View style={styles.managementCard}>
        <View style={styles.managementHeader}><View style={[styles.managementIcon, { backgroundColor: `${visual.accent}22` }]}><Ionicons name="people-outline" size={22} color={visual.primary} /></View><View style={styles.managementTitleBlock}><Text style={styles.managementTitle}>Asignación operativa</Text><Text style={styles.managementCopy}>Elige prioridad, departamento y responsable. Al confirmar, el reporte pasará a Asignado.</Text></View></View>
        <Text style={styles.fieldLabel}>Prioridad</Text>
        <View style={styles.statusOptions}>{priorities.map((priority) => <Pressable key={priority} onPress={() => setManagementPriority(priority)} style={[styles.statusOption, managementPriority === priority && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.statusOptionText, managementPriority === priority && styles.statusOptionTextSelected]}>{priority.charAt(0) + priority.slice(1).toLowerCase()}</Text></Pressable>)}</View>
        <Text style={styles.fieldLabel}>Departamento responsable</Text>
        <View style={styles.statusOptions}>{departments.map((item) => <Pressable key={item.id} onPress={() => { setManagementDepartmentId(item.id); setManagementAssigneeId(null); setStaff([]); }} style={[styles.statusOption, managementDepartmentId === item.id && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.statusOptionText, managementDepartmentId === item.id && styles.statusOptionTextSelected]}>{item.name}</Text></Pressable>)}</View>
        {managementDepartmentId && <><Text style={styles.fieldLabel}>Responsable</Text><View style={styles.statusOptions}>{staff.map((item) => <Pressable key={item.id} onPress={() => setManagementAssigneeId(item.id)} style={[styles.statusOption, managementAssigneeId === item.id && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.statusOptionText, managementAssigneeId === item.id && styles.statusOptionTextSelected]}>{item.fullName} · {item.role}</Text></Pressable>)}</View>{!staff.length && <Text style={styles.helperText}>No hay operadores ni personal de mantenimiento activo en esta área.</Text>}</>}
        <Text style={styles.fieldLabel}>Observaciones de asignación</Text>
        <TextInput value={managementNote} onChangeText={setManagementNote} multiline maxLength={300} placeholder="Indica el trabajo solicitado..." placeholderTextColor={colors.muted} style={styles.noteInput} />
        {managementError ? <View style={styles.inlineError}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.inlineErrorText}>{managementError}</Text></View> : null}
        {managementMessage ? <View style={styles.inlineSuccess}><Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} /><Text style={styles.inlineSuccessText}>{managementMessage}</Text></View> : null}
        <AppButton disabled={!managementDepartmentId || !managementAssigneeId || !managementNote.trim() || isSavingManagement} label={isSavingManagement ? 'Asignando...' : 'Asignar reporte'} icon="save-outline" onPress={saveManagement} />
      </View>}
      {(databaseRole === 'administrador' || databaseRole === 'mantenimiento' || databaseRole === 'operador') && <View style={styles.managementCard}>
        <View style={styles.managementHeader}><View style={[styles.managementIcon, { backgroundColor: `${visual.accent}22` }]}><Ionicons name="git-branch-outline" size={22} color={visual.primary} /></View><View style={styles.managementTitleBlock}><Text style={styles.managementTitle}>Actualizar proceso</Text><Text style={styles.managementCopy}>Registra el siguiente avance permitido para este reporte.</Text></View></View>
        {availableTransitions.length ? <>
          <Text style={styles.fieldLabel}>Siguiente estado</Text>
          <View style={styles.statusOptions}>{availableTransitions.map((status) => <Pressable key={status} onPress={() => { setNextStatus(status); setStatusError(''); setStatusMessage(''); }} style={[styles.statusOption, nextStatus === status && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.statusOptionText, nextStatus === status && styles.statusOptionTextSelected]}>{statusLabels[status]}</Text></Pressable>)}</View>
          <Text style={styles.fieldLabel}>Nota del cambio</Text>
          <TextInput value={statusNote} onChangeText={setStatusNote} multiline maxLength={300} placeholder="Agrega una observación para la trazabilidad..." placeholderTextColor={colors.muted} style={styles.noteInput} />
          {statusError ? <View style={styles.inlineError}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.inlineErrorText}>{statusError}</Text></View> : null}
          {statusMessage ? <View style={styles.inlineSuccess}><Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} /><Text style={styles.inlineSuccessText}>{statusMessage}</Text></View> : null}
          <AppButton disabled={!nextStatus || isUpdatingStatus} label={isUpdatingStatus ? 'Actualizando...' : 'Confirmar cambio'} icon="checkmark-circle-outline" onPress={changeStatus} />
        </> : <View style={styles.noTransitions}><Ionicons name="lock-closed-outline" size={20} color={colors.muted} /><Text style={styles.noTransitionsText}>{selected.status === 'CERRADO' ? 'Este reporte ya está cerrado.' : 'No hay cambios disponibles para tu rol en el estado actual.'}</Text></View>}
      </View>}
      {(databaseRole === 'administrador' || databaseRole === 'mantenimiento' || databaseRole === 'operador') && <View style={styles.managementCard}>
        <View style={styles.managementHeader}><View style={[styles.managementIcon, { backgroundColor: `${visual.accent}22` }]}><Ionicons name="camera-outline" size={22} color={visual.primary} /></View><View style={styles.managementTitleBlock}><Text style={styles.managementTitle}>Evidencia de atención</Text><Text style={styles.managementCopy}>Adjunta una fotografía del avance o del trabajo realizado. Se optimizará antes de subirla.</Text></View></View>
        <Text style={styles.fieldLabel}>Tipo de evidencia</Text>
        <View style={styles.statusOptions}><Pressable onPress={() => setStaffEvidenceKind('AVANCE')} style={[styles.statusOption, staffEvidenceKind === 'AVANCE' && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.statusOptionText, staffEvidenceKind === 'AVANCE' && styles.statusOptionTextSelected]}>Avance</Text></Pressable><Pressable onPress={() => setStaffEvidenceKind('FINAL')} style={[styles.statusOption, staffEvidenceKind === 'FINAL' && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.statusOptionText, staffEvidenceKind === 'FINAL' && styles.statusOptionTextSelected]}>Solución final</Text></Pressable></View>
        <Text style={styles.helperText}>{staffEvidenceKind === 'FINAL' ? 'La fotografía se mostrará al ciudadano como resultado del departamento. Es opcional.' : 'La fotografía quedará registrada como parte del avance interno.'}</Text>
        {workEvidence ? <View style={styles.evidenceReady}><Ionicons name="image-outline" size={23} color={visual.primary} /><View style={styles.managementTitleBlock}><Text style={styles.evidenceReadyTitle}>Fotografía preparada</Text><Text style={styles.helperText}>Lista para asociarse al reporte {selected.code}.</Text></View><Pressable onPress={() => setWorkEvidence(null)}><Ionicons name="close-circle" size={22} color={colors.muted} /></Pressable></View> : null}
        <View style={styles.evidenceActions}><AppButton label={workEvidence ? 'Cambiar fotografía' : 'Seleccionar fotografía'} icon="images-outline" disabled={isUploadingEvidence} onPress={selectWorkEvidence} /><AppButton label={isUploadingEvidence ? 'Subiendo...' : 'Adjuntar evidencia'} icon="cloud-upload-outline" disabled={!workEvidence || isUploadingEvidence} onPress={submitWorkEvidence} /></View>
        {evidenceError ? <View style={styles.inlineError}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.inlineErrorText}>{evidenceError}</Text></View> : null}
        {evidenceMessage ? <View style={styles.inlineSuccess}><Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} /><Text style={styles.inlineSuccessText}>{evidenceMessage}</Text></View> : null}
      </View>}
    </> : <>
      {isFieldRole && !isLoading && !error ? <View style={styles.workBoard}>
        <View style={styles.workBoardHeader}><View><Text style={styles.workBoardKicker}>BANDEJA OPERATIVA</Text><Text style={styles.workBoardTitle}>Organiza tu jornada</Text></View><Text style={styles.workBoardDepartment}>{department}</Text></View>
        <View style={styles.workStats}>
          <Pressable onPress={() => { setWorkStage('PENDIENTES'); setFilter('TODOS'); setPage(1); }} style={[styles.workStat, workStage === 'PENDIENTES' && { borderColor: visual.primary }]}><Ionicons name="time-outline" size={21} color={visual.primary} /><Text style={styles.workStatValue}>{workSummary.pending}</Text><Text style={styles.workStatLabel}>Pendientes</Text></Pressable>
          <Pressable onPress={() => { setWorkStage('EN_CURSO'); setFilter('TODOS'); setPage(1); }} style={[styles.workStat, workStage === 'EN_CURSO' && { borderColor: visual.primary }]}><Ionicons name="construct-outline" size={21} color={colors.warning} /><Text style={styles.workStatValue}>{workSummary.active}</Text><Text style={styles.workStatLabel}>En atención</Text></Pressable>
          <Pressable onPress={() => { setWorkStage('FINALIZADAS'); setFilter('TODOS'); setPage(1); }} style={[styles.workStat, workStage === 'FINALIZADAS' && { borderColor: visual.primary }]}><Ionicons name="checkmark-circle-outline" size={21} color={colors.primary} /><Text style={styles.workStatValue}>{workSummary.closed}</Text><Text style={styles.workStatLabel}>Finalizadas</Text></Pressable>
        </View>
        <Pressable onPress={() => { setWorkStage('TODAS'); setFilter('TODOS'); setPage(1); }} style={styles.showAllWork}><Text style={[styles.showAllWorkText, { color: visual.primary }]}>Ver todas las tareas autorizadas</Text><Ionicons name="list-outline" size={18} color={visual.primary} /></Pressable>
      </View> : null}
      {databaseRole !== 'ciudadano' && !isLoading && !error ? <IncidentHeatmap incidents={incidents} /> : null}
      <View style={styles.filterPanel}>
        <View style={styles.searchBox}><Ionicons name="search-outline" size={20} color={colors.muted} /><TextInput value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} placeholder="Buscar por código, título, categoría o ubicación" placeholderTextColor={colors.muted} style={styles.searchInput} /><Pressable disabled={!search} onPress={() => { setSearch(''); setPage(1); }} style={styles.clearSearch}><Ionicons name="close-circle" size={19} color={search ? colors.muted : colors.border} /></Pressable></View>
        <View style={styles.filterGroup}><Text style={styles.filterLabel}>Estado</Text><View style={styles.filters}>{filters.map((item) => <Pressable key={item.key} onPress={() => { setFilter(item.key); setPage(1); }} style={[styles.filter, filter === item.key && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</View></View>
        <View style={styles.filterGroup}><Text style={styles.filterLabel}>Prioridad</Text><View style={styles.filters}>{(['TODAS', ...priorities] as PriorityFilter[]).map((item) => <Pressable key={item} onPress={() => setPriorityFilter(item)} style={[styles.filter, priorityFilter === item && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.filterText, priorityFilter === item && styles.filterTextActive]}>{item === 'TODAS' ? 'Todas' : item.charAt(0) + item.slice(1).toLowerCase()}</Text></Pressable>)}</View></View>
        {canManageAssignment && departmentOptions.length > 1 && <View style={styles.filterGroup}><Text style={styles.filterLabel}>Departamento</Text><View style={styles.filters}><Pressable onPress={() => setDepartmentFilter('TODOS')} style={[styles.filter, departmentFilter === 'TODOS' && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.filterText, departmentFilter === 'TODOS' && styles.filterTextActive]}>Todos</Text></Pressable>{departmentOptions.map((item) => <Pressable key={item} onPress={() => setDepartmentFilter(item)} style={[styles.filter, departmentFilter === item && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.filterText, departmentFilter === item && styles.filterTextActive]}>{item}</Text></Pressable>)}</View></View>}
      </View>
      {!isLoading && !error && <Text style={styles.resultCount}>{incidents.length} {incidents.length === 1 ? 'reporte encontrado' : 'reportes encontrados'}</Text>}
      {isLoading ? <LoadingState /> : error ? <ErrorState description={error} onRetry={reload} /> : incidents.length ? <><View style={styles.list}>{pagedIncidents.map((item) => <IncidentCard key={item.id} incident={item} compact onPress={() => selectReport(item)} />)}</View><PaginationControls page={currentPage} pageCount={pageCount} pageSize={pageSize} total={incidents.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></> : <View style={styles.list}><EmptyState title="Sin coincidencias" description="Cambia la búsqueda o alguno de los filtros para consultar otros casos." /><AppButton label="Limpiar filtros" variant="secondary" onPress={() => { setSearch(''); setFilter('ACTIVOS'); setPriorityFilter('TODAS'); setDepartmentFilter('TODOS'); setPage(1); }} /></View>}
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
  workBoard: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  workBoardHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm },
  workBoardKicker: { color: colors.secondary, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  workBoardTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 2 },
  workBoardDepartment: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  workStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  workStat: { flex: 1, minWidth: 130, minHeight: 104, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.xs },
  workStatValue: { color: colors.text, fontSize: 25, fontWeight: '900' },
  workStatLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  showAllWork: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  showAllWorkText: { fontSize: 13, fontWeight: '900' },
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
  evidenceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  evidenceLoading: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  evidenceGallery: { gap: spacing.md, paddingVertical: spacing.xs },
  evidenceItem: { width: 280, gap: spacing.xs },
  evidenceImage: { width: 280, height: 190, borderRadius: radius.md, backgroundColor: colors.surface },
  evidenceCaption: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  resolutionNotice: { borderRadius: radius.md, backgroundColor: colors.softGreen, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  resolutionNoticeText: { flex: 1, color: colors.primary, lineHeight: 19, fontWeight: '700' }
});
