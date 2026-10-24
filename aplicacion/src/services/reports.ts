import { supabase } from '@/lib/supabase';
import { isIncidentPriority, type Incident, type IncidentPriority, type IncidentStatus, type MaintenanceDepartment } from '@/types/domain';
import { readEvidenceBytes } from '@/services/evidenceImages';
import { requireBackendCapability } from '@/lib/backendCapabilities';
import { reportReadScopeFor } from '@/services/sessionPolicy';
import * as Crypto from 'expo-crypto';

type CreateReportInput = {
  categoryId: number;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  evidence: ReportEvidenceInput[];
};

export type ReportEvidenceInput = {
  uri: string;
  mimeType: string;
};

export class EvidenceLinkError extends Error {}

export type ReportCategory = {
  id: number;
  name: string;
};

export type ReportDepartment = { id: number; name: string };
export type ReportAssignee = { id: string; fullName: string; role: string };

export type ReportHistoryEntry = {
  id: number;
  previousStatus: IncidentStatus | null;
  newStatus: IncidentStatus;
  note: string | null;
  createdAt: string;
  changedBy: string;
  assignedTo: string | null;
};

export type ReportEvidence = {
  id: string;
  url: string;
  mimeType: string;
  createdAt: string;
  kind: 'INICIAL' | 'ADICIONAL' | 'AVANCE' | 'FINAL' | 'OTRA';
};

export type StaffEvidenceKind = 'AVANCE' | 'FINAL';

type CategoryStorageRow = {
  id: number;
  department: { code?: string } | { code?: string }[] | null;
};

function relationValue<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function storageSegment(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
  if (!normalized) throw new Error('El sector del reporte no tiene un código válido.');
  return normalized;
}

function guatemalaYearMonth() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  if (!year || !month) throw new Error('No fue posible determinar la fecha de la evidencia.');
  return { year, month };
}

async function categoryStorageCode(categoryId: number) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase
    .from('categories')
    .select('id, department:departments(code)')
    .eq('id', categoryId)
    .eq('active', true)
    .single();
  if (error || !data) throw new Error('La categoría seleccionada no está disponible.');
  const row = data as CategoryStorageRow;
  const department = relationValue(row.department);
  return storageSegment(department?.code ?? '');
}

function evidenceStoragePath(input: {
  departmentCode: string;
  categoryId: number;
  incidentId: string;
  userId: string;
  actor: 'ciudadano' | 'personal';
  filename: string;
}) {
  const { year, month } = guatemalaYearMonth();
  return `reportes/${input.departmentCode}/categoria-${input.categoryId}/${year}/${month}/${input.incidentId}/${input.actor}-${input.userId}/${input.filename}`;
}

export async function listReportCategories(): Promise<ReportCategory[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createReport({ categoryId, description, location, latitude, longitude, evidence }: CreateReportInput) {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Inicia sesión para registrar un reporte.');
  if (evidence.length < 1 || evidence.length > 5 || evidence.some((item) => item.mimeType !== 'image/jpeg')) {
    throw new Error('Adjunta entre una y cinco fotografías JPEG.');
  }

  const incidentId = Crypto.randomUUID();
  const departmentCode = await categoryStorageCode(categoryId);
  const uploadedPaths: string[] = [];
  try {
    for (const [index, item] of evidence.entries()) {
      const storagePath = evidenceStoragePath({
        departmentCode,
        categoryId,
        incidentId,
        userId: authData.user.id,
        actor: 'ciudadano',
        filename: index === 0 ? 'evidencia-inicial.jpg' : `evidencia-adicional-${String(index + 1).padStart(2, '0')}.jpg`
      });
      const fileData = await readEvidenceBytes(item.uri);
      const { error: uploadError } = await supabase.storage
        .from('incidente-evidencia')
        .upload(storagePath, fileData, {
          contentType: item.mimeType,
          cacheControl: '3600',
          upsert: false
        });
      if (uploadError) throw uploadError;
      uploadedPaths.push(storagePath);
    }
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from('incidente-evidencia').remove(uploadedPaths);
    throw error;
  }

  const { data, error } = await supabase.rpc('create_incident_with_evidence', {
    p_incident_id: incidentId,
    p_category_id: categoryId,
    p_description: description.trim(),
    p_address_reference: location.trim(),
    p_latitude: latitude,
    p_longitude: longitude,
    p_storage_paths: uploadedPaths,
    p_mime_type: 'image/jpeg'
  });

  if (error || !data?.[0]) {
    await supabase.storage.from('incidente-evidencia').remove(uploadedPaths);
    throw new Error(error?.message ?? 'No fue posible registrar el reporte con su evidencia.');
  }

  return data[0] as { id: string; code: string };
}

export async function uploadReportEvidence(incidentId: string, evidence: ReportEvidenceInput, staffKind: StaffEvidenceKind = 'AVANCE') {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Inicia sesión para adjuntar una fotografía.');

  const { data: incident, error: incidentError } = await supabase
    .from('incidents')
    .select('id, citizen_id, category_id, category:categories(department:departments(code))')
    .eq('id', incidentId)
    .single();
  if (incidentError || !incident) throw new Error('El reporte no está disponible para esta sesión.');
  if (incident.citizen_id !== authData.user.id) requireBackendCapability('staffEvidence');

  if (evidence.mimeType !== 'image/jpeg') throw new Error('Selecciona una fotografía JPEG.');
  const fileData = await readEvidenceBytes(evidence.uri);
  const category = relationValue(incident.category as { department: { code?: string } | { code?: string }[] | null } | { department: { code?: string } | { code?: string }[] | null }[] | null);
  const department = relationValue(category?.department ?? null);
  const storagePath = evidenceStoragePath({
    departmentCode: storageSegment(department?.code ?? ''),
    categoryId: incident.category_id,
    incidentId,
    userId: authData.user.id,
    actor: incident.citizen_id === authData.user.id ? 'ciudadano' : 'personal',
    filename: `evidencia-${Date.now()}-${Crypto.randomUUID()}.jpg`
  });

  const { error: uploadError } = await supabase.storage
    .from('incidente-evidencia')
    .upload(storagePath, fileData, {
      contentType: evidence.mimeType,
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { error: evidenceError } = await supabase.from('incident_evidence').insert({
    incident_id: incidentId,
    uploaded_by: authData.user.id,
    storage_path: storagePath,
    mime_type: evidence.mimeType,
    file_url: storagePath,
    file_type: evidence.mimeType,
    evidence_kind: incident.citizen_id === authData.user.id ? 'OTRA' : staffKind
  });

  if (evidenceError) {
    await supabase.storage.from('incidente-evidencia').remove([storagePath]);
    throw new EvidenceLinkError('La fotografía no pudo vincularse al reporte y se retiró del almacenamiento para evitar archivos huérfanos.');
  }

  return storagePath;
}

type IncidentRow = {
  id: string;
  code: string;
  title: string;
  description: string;
  address_reference: string;
  latitude: number | null;
  longitude: number | null;
  reporter_name: string | null;
  reporter_email: string | null;
  status: IncidentStatus;
  created_at: string;
  updated_at: string;
  priority: unknown;
  assigned_department_id: number | null;
  assigned_to: string | null;
  category: { name?: string } | { name?: string }[] | null;
  assignedDepartment: { name?: string } | { name?: string }[] | null;
  evidence: { id: string | number }[] | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-GT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-GT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function categoryName(category: IncidentRow['category']) {
  if (Array.isArray(category)) return category[0]?.name ?? 'Sin categoría';
  return category?.name ?? 'Sin categoría';
}

function departmentForCategory(category: string): MaintenanceDepartment {
  if (category === 'Agua potable') return 'Agua';
  if (category === 'Alumbrado público') return 'EEMZA';
  if (category === 'Drenajes') return 'Drenajes';
  if (category === 'Limpieza' || category === 'Desechos sólidos') return 'Desechos';
  return 'Infraestructura';
}

function progressForStatus(status: IncidentStatus) {
  const progress: Record<IncidentStatus, number> = {
    REGISTRADO: 10,
    EN_REVISION: 25,
    VALIDADO: 40,
    ASIGNADO: 55,
    EN_ATENCION: 75,
    POR_VERIFICAR: 90,
    CERRADO: 100,
    RECHAZADO: 100
  };
  return progress[status];
}

async function requireReportReadAccess() {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Inicia sesión para consultar reportes.');
  const { data: profile, error } = await supabase.from('profiles').select('role, department_id').eq('id', auth.user.id).single();
  if (error || !profile) throw new Error('No fue posible verificar tu perfil.');
  const scope = reportReadScopeFor(profile.role);
  if (scope === 'pending') throw new Error('Esta cuenta todavía no tiene una consulta de reportes habilitada.');
  const departmentId = profile.department_id;
  if (scope === 'department' && (typeof departmentId !== 'number' || !Number.isSafeInteger(departmentId) || departmentId <= 0)) {
    throw new Error('Tu perfil no tiene un departamento verificado.');
  }
  return { client: supabase, scope, userId: auth.user.id, departmentId: departmentId as number | null };
}

async function requireVisibleReport(incidentId: string) {
  const { client, scope, userId, departmentId } = await requireReportReadAccess();
  let query = client.from('incidents').select('id').eq('id', incidentId);
  if (scope === 'citizen') query = query.eq('citizen_id', userId);
  if (scope === 'department') query = query.eq('assigned_department_id', departmentId);
  if (scope === 'personal') query = query.eq('assigned_to', userId);
  const { data, error } = await query.single();
  if (error || !data) throw new Error('El reporte no está disponible para esta sesión.');
  return client;
}

export async function listReports(): Promise<Incident[]> {
  const { client, scope, userId, departmentId } = await requireReportReadAccess();
  let query = client
    .from('incidents')
    .select('id, code, title, description, address_reference, latitude, longitude, reporter_name, reporter_email, status, priority, assigned_department_id, assigned_to, created_at, updated_at, category:categories(name), assignedDepartment:departments!incidents_assigned_department_id_fkey(name), evidence:incident_evidence(id)');
  if (scope === 'citizen') query = query.eq('citizen_id', userId);
  if (scope === 'department') query = query.eq('assigned_department_id', departmentId);
  if (scope === 'personal') query = query.eq('assigned_to', userId);
  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as IncidentRow[]).map((incident) => {
    const category = categoryName(incident.category);
    return {
      id: incident.id,
      code: incident.code,
      title: incident.title,
      description: incident.description,
      category,
      location: incident.address_reference,
      status: incident.status,
      createdAt: formatDate(incident.created_at),
      updatedAt: formatDate(incident.updated_at),
      citizenName: incident.reporter_name ?? 'Ciudadanía',
      citizenEmail: incident.reporter_email ?? '',
      latitude: incident.latitude,
      longitude: incident.longitude,
      department: relationValue(incident.assignedDepartment)?.name ?? departmentForCategory(category),
      departmentId: incident.assigned_department_id,
      assignedToId: incident.assigned_to,
      priority: isIncidentPriority(incident.priority) ? incident.priority : 'MEDIA',
      progress: progressForStatus(incident.status),
      evidenceAttached: Boolean(incident.evidence?.length)
    };
  });
}

export async function listDepartments(): Promise<ReportDepartment[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.from('departments').select('id, name').eq('active', true).order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listDepartmentStaff(departmentId: number): Promise<ReportAssignee[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('department_id', departmentId)
    .eq('status', 'ACTIVO')
    .in('role', ['operador', 'mantenimiento'])
    .order('full_name');
  if (error) throw error;
  return (data ?? []).map((item) => ({ id: item.id, fullName: item.full_name || 'Personal sin nombre', role: item.role }));
}

export async function updateReportManagement(input: {
  incidentId: string;
  previousStatus: IncidentStatus;
  priority: IncidentPriority;
  departmentId: number;
  assignedToId: string;
  note: string;
}) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  if (input.previousStatus !== 'VALIDADO') throw new Error('Primero valida el reporte antes de asignarlo.');
  if (!input.assignedToId) throw new Error('Selecciona un responsable activo del departamento.');
  if (!input.note.trim()) throw new Error('Agrega una observación para la asignación.');
  const { data, error } = await supabase.rpc('assign_incident', {
    p_incident_id: input.incidentId,
    p_previous_status: input.previousStatus,
    p_department_id: input.departmentId,
    p_assigned_to: input.assignedToId,
    p_priority: input.priority,
    p_note: input.note.trim()
  });
  if (error || !data) {
    const message = error?.message.toLowerCase() ?? '';
    if (message.includes('status changed') || message.includes('not available for assignment')) {
      throw new Error('El reporte cambió desde otra sesión o ya fue asignado. Actualiza la lista.');
    }
    if (message.includes('assignee') || message.includes('department')) {
      throw new Error('El responsable debe estar activo y pertenecer al departamento seleccionado.');
    }
    throw new Error(error?.message ?? 'No fue posible guardar la asignación.');
  }
  return { updatedAt: formatDate(String(data)) };
}

export async function listReportHistory(incidentId: string): Promise<ReportHistoryEntry[]> {
  const client = await requireVisibleReport(incidentId);

  const { data, error } = await client
    .from('incident_history')
    .select('id, previous_status, new_status, note, created_at, actor:profiles!incident_history_changed_by_fkey(full_name), assignee:profiles!incident_history_assigned_to_fkey(full_name)')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((entry) => {
    const actor = entry.actor as unknown as { full_name?: string } | { full_name?: string }[] | null;
    const fullName = Array.isArray(actor) ? actor[0]?.full_name : actor?.full_name;
    const assignee = entry.assignee as unknown as { full_name?: string } | { full_name?: string }[] | null;
    const assigneeName = Array.isArray(assignee) ? assignee[0]?.full_name : assignee?.full_name;
    return {
      id: entry.id,
      previousStatus: entry.previous_status as IncidentStatus | null,
      newStatus: entry.new_status as IncidentStatus,
      note: entry.note,
      createdAt: formatDateTime(entry.created_at),
      changedBy: fullName ?? 'Personal de ZacApp',
      assignedTo: assigneeName ?? null
    };
  });
}

function isEvidenceStoragePath(value: unknown, incidentId: string, uploadedBy: unknown): value is string {
  if (typeof value !== 'string' || typeof uploadedBy !== 'string' || !uploadedBy) return false;
  const parts = value.split('/');
  // Storage keys are literal: never decode or normalize potentially unsafe segments.
  if (parts.some((part) => !/^[A-Za-z0-9._-]+$/.test(part) || part === '.' || part === '..')) return false;

  if (parts.length === 3) return parts[0] === uploadedBy && parts[1] === incidentId;

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  return parts.length === 8
    && parts[0] === 'reportes'
    && /^[A-Z0-9_-]+$/.test(parts[1])
    && /^categoria-[1-9][0-9]*$/.test(parts[2])
    && /^[0-9]{4}$/.test(parts[3]) && parts[3] !== '0000'
    && /^(0[1-9]|1[0-2])$/.test(parts[4])
    && uuid.test(parts[5]) && parts[5] === incidentId
    && uuid.test(uploadedBy)
    && (parts[6] === `ciudadano-${uploadedBy}` || parts[6] === `personal-${uploadedBy}`)
    && /^[A-Za-z0-9._-]+\.jpg$/.test(parts[7]);
}

export async function listReportEvidence(incidentId: string): Promise<ReportEvidence[]> {
  const client = await requireVisibleReport(incidentId);

  const { data, error } = await client
    .from('incident_evidence')
    .select('id, storage_path, mime_type, uploaded_by, evidence_kind, created_at')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const evidence = data ?? [];
  for (const item of evidence) {
    if (!isEvidenceStoragePath(item.storage_path, incidentId, item.uploaded_by)) {
      throw new Error('La ruta de evidencia necesita revisión.');
    }
  }

  return Promise.all(evidence.map(async (item) => {
    const storedValue = item.storage_path as string;
    const { data: signedData, error: signedError } = await client.storage
      .from('incidente-evidencia')
      .createSignedUrl(storedValue, 15 * 60);
    if (signedError || !signedData?.signedUrl) throw signedError ?? new Error('No fue posible abrir la evidencia.');

    return {
      id: String(item.id),
      url: signedData.signedUrl,
      mimeType: item.mime_type ?? 'image/jpeg',
      createdAt: formatDateTime(item.created_at),
      kind: ['INICIAL', 'ADICIONAL', 'AVANCE', 'FINAL', 'OTRA'].includes(item.evidence_kind) ? item.evidence_kind : 'OTRA'
    };
  }));
}

type UpdateReportStatusResult = {
  updatedAt: string;
  historyRecorded: boolean;
};

export async function updateReportStatus(
  incidentId: string,
  previousStatus: IncidentStatus,
  newStatus: IncidentStatus,
  note: string
): Promise<UpdateReportStatusResult> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  if (previousStatus === newStatus) throw new Error('Selecciona un estado diferente al actual.');
  if (newStatus === 'ASIGNADO') throw new Error('Usa la asignación operativa para seleccionar departamento y responsable.');

  const { data: updatedAt, error } = await supabase.rpc('transition_incident', {
    p_incident_id: incidentId,
    p_previous_status: previousStatus,
    p_new_status: newStatus,
    p_note: note.trim() || null,
    p_department_id: null
  });

  if (error || !updatedAt) {
    const message = error?.message.toLowerCase() ?? '';
    if (message.includes('status changed')) throw new Error('El reporte cambió desde otra sesión. Actualiza la lista e intenta nuevamente.');
    if (message.includes('note required')) throw new Error('Agrega una nota para justificar este cambio de estado.');
    if (message.includes('transition not allowed')) throw new Error('Este cambio de estado no está permitido para tu rol.');
    if (message.includes('access denied')) throw new Error('Este reporte no pertenece a tu departamento.');
    throw new Error(error?.message ?? 'No fue posible actualizar el reporte.');
  }

  return {
    updatedAt: formatDate(String(updatedAt)),
    historyRecorded: true
  };
}
