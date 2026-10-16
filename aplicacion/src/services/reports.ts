import { supabase } from '@/lib/supabase';
import { isIncidentPriority, type Incident, type IncidentPriority, type IncidentStatus, type MaintenanceDepartment } from '@/types/domain';
import { readEvidenceBytes } from '@/services/evidenceImages';
import { requireBackendCapability } from '@/lib/backendCapabilities';
import { personalTasksPendingMessage, reportReadScopeFor } from '@/services/sessionPolicy';

type CreateReportInput = {
  categoryName: string;
  description: string;
  location: string;
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
};

export type ReportEvidence = {
  id: string;
  url: string;
  mimeType: string;
  createdAt: string;
};

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

export async function createReport({ categoryName, description, location }: CreateReportInput) {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Inicia sesión para registrar un reporte.');

  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('name', categoryName.trim())
    .eq('active', true)
    .single();

  if (categoryError || !category) throw new Error('La categoría seleccionada no está disponible.');

  const cleanDescription = description.trim();
  const { data: incident, error: incidentError } = await supabase
    .from('incidents')
    .insert({
      citizen_id: authData.user.id,
      category_id: category.id,
      title: cleanDescription.slice(0, 80),
      description: cleanDescription,
      address_reference: location.trim()
    })
    .select('id, code')
    .single();

  if (incidentError) throw incidentError;
  return incident;
}

export async function uploadReportEvidence(incidentId: string, evidence: ReportEvidenceInput) {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Inicia sesión para adjuntar una fotografía.');

  const { data: incident, error: incidentError } = await supabase
    .from('incidents')
    .select('id, citizen_id')
    .eq('id', incidentId)
    .single();
  if (incidentError || !incident) throw new Error('El reporte no está disponible para esta sesión.');
  if (incident.citizen_id !== authData.user.id) requireBackendCapability('staffEvidence');

  if (evidence.mimeType !== 'image/jpeg') throw new Error('Selecciona una fotografía JPEG.');
  const fileData = await readEvidenceBytes(evidence.uri);
  const storagePath = `${authData.user.id}/${incidentId}/${Date.now()}.jpg`;

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
    mime_type: evidence.mimeType
  });

  if (evidenceError) {
    throw new EvidenceLinkError('La fotografía se subió, pero no pudo vincularse al reporte. Conserva el reporte y solicita una revisión antes de reintentar.');
  }

  return storagePath;
}

type IncidentRow = {
  id: string;
  code: string;
  title: string;
  description: string;
  address_reference: string;
  status: IncidentStatus;
  created_at: string;
  updated_at: string;
  priority: unknown;
  assigned_department_id: number | null;
  assigned_to: string | null;
  category: { name?: string } | { name?: string }[] | null;
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
  if (scope === 'pending') throw new Error(personalTasksPendingMessage);
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
  const { data, error } = await query.single();
  if (error || !data) throw new Error('El reporte no está disponible para esta sesión.');
  return client;
}

export async function listReports(): Promise<Incident[]> {
  const { client, scope, userId, departmentId } = await requireReportReadAccess();
  let query = client
    .from('incidents')
    .select('id, code, title, description, address_reference, status, priority, assigned_department_id, assigned_to, created_at, updated_at, category:categories(name), evidence:incident_evidence(id)');
  if (scope === 'citizen') query = query.eq('citizen_id', userId);
  if (scope === 'department') query = query.eq('assigned_department_id', departmentId);
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
      citizenName: 'Ciudadanía',
      citizenEmail: '',
      department: departmentForCategory(category),
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
    .in('role', ['coordinador', 'operador', 'mantenimiento'])
    .order('full_name');
  if (error) throw error;
  return (data ?? []).map((item) => ({ id: item.id, fullName: item.full_name || 'Personal sin nombre', role: item.role }));
}

export async function updateReportManagement(input: {
  incidentId: string;
  priority: IncidentPriority;
  departmentId: number;
  assignedToId?: string | null;
}) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase
    .from('incidents')
    .update({
      priority: input.priority,
      assigned_department_id: input.departmentId,
      assigned_to: input.assignedToId || null
    })
    .eq('id', input.incidentId)
    .select('updated_at')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'No fue posible guardar la asignación.');
  return { updatedAt: formatDate(data.updated_at) };
}

export async function listReportHistory(incidentId: string): Promise<ReportHistoryEntry[]> {
  const client = await requireVisibleReport(incidentId);

  const { data, error } = await client
    .from('incident_history')
    .select('id, previous_status, new_status, note, created_at, actor:profiles!incident_history_changed_by_fkey(full_name)')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((entry) => {
    const actor = entry.actor as unknown as { full_name?: string } | { full_name?: string }[] | null;
    const fullName = Array.isArray(actor) ? actor[0]?.full_name : actor?.full_name;
    return {
      id: entry.id,
      previousStatus: entry.previous_status as IncidentStatus | null,
      newStatus: entry.new_status as IncidentStatus,
      note: entry.note,
      createdAt: formatDateTime(entry.created_at),
      changedBy: fullName ?? 'Personal de ZacApp'
    };
  });
}

export async function listReportEvidence(incidentId: string): Promise<ReportEvidence[]> {
  const client = await requireVisibleReport(incidentId);

  const { data, error } = await client
    .from('incident_evidence')
    .select('id, storage_path, mime_type, uploaded_by, created_at')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return Promise.all((data ?? []).map(async (item) => {
    const storedValue = item.storage_path as string;
    const parts = typeof storedValue === 'string' ? storedValue.split('/') : [];
    if (parts.length !== 3 || parts[0] !== item.uploaded_by || parts[1] !== incidentId || !parts[2] || parts.some((part) => part === '.' || part === '..')) {
      throw new Error('La ruta de evidencia necesita revisión.');
    }
    const { data: signedData, error: signedError } = await client.storage
      .from('incidente-evidencia')
      .createSignedUrl(storedValue, 15 * 60);
    if (signedError || !signedData?.signedUrl) throw signedError ?? new Error('No fue posible abrir la evidencia.');

    return {
      id: String(item.id),
      url: signedData.signedUrl,
      mimeType: item.mime_type ?? 'image/jpeg',
      createdAt: formatDateTime(item.created_at)
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
  note: string,
  departmentName?: string,
  selectedDepartmentId?: number | null
): Promise<UpdateReportStatusResult> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  if (previousStatus === newStatus) throw new Error('Selecciona un estado diferente al actual.');

  let assignedDepartmentId: number | null = null;
  if (newStatus === 'ASIGNADO') {
    assignedDepartmentId = selectedDepartmentId ?? null;
    if (!assignedDepartmentId) {
      if (!departmentName) throw new Error('Selecciona el departamento responsable antes de asignar el reporte.');
      const compatibleDepartmentNames = [departmentForCategory(departmentName), departmentName];
      const { data: departments, error: departmentError } = await supabase
        .from('departments')
        .select('id')
        .in('name', compatibleDepartmentNames)
        .eq('active', true)
        .limit(1);
      const department = departments?.[0];
      if (departmentError || !department) throw new Error('Selecciona el departamento responsable antes de asignar el reporte.');
      assignedDepartmentId = department.id;
    }
  }

  const { data: updatedAt, error } = await supabase.rpc('transition_incident', {
    p_incident_id: incidentId,
    p_previous_status: previousStatus,
    p_new_status: newStatus,
    p_note: note.trim() || null,
    p_department_id: assignedDepartmentId
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
