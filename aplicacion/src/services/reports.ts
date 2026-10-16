import { supabase } from '@/lib/supabase';
import { isIncidentPriority, type Incident, type IncidentStatus } from '@/types/domain';
import { requireBackendCapability } from '@/lib/backendCapabilities';

type CreateReportInput = {
  categoryName: string;
  description: string;
  location: string;
};

export type ReportEvidenceInput = { uri: string; mimeType: 'image/jpeg' };
export type ReportEvidence = { id: string; url: string; mimeType: string; createdAt: string };
export type ReportDepartment = { id: number; name: string };
export class EvidenceLinkError extends Error {}

export type ReportCategory = {
  id: number;
  name: string;
};

export type ReportHistoryEntry = {
  id: number;
  previousStatus: IncidentStatus | null;
  newStatus: IncidentStatus;
  note: string | null;
  createdAt: string;
  changedBy: string;
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

type IncidentRow = {
  id: string;
  code: string;
  title: string;
  description: string;
  address_reference: string;
  status: IncidentStatus;
  priority?: unknown;
  assigned_department_id?: number | null;
  assigned_to?: string | null;
  department: { name?: string } | { name?: string }[] | null;
  created_at: string;
  updated_at: string;
  category: { name?: string } | { name?: string }[] | null;
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

export async function listReports(): Promise<Incident[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { data, error } = await supabase
    .from('incidents')
    .select('id, code, title, description, address_reference, status, priority, assigned_to, created_at, updated_at, category:categories(name)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // An optional relation must not break the existing real-report query on an older schema.
  const { data: assignments, error: assignmentsError } = await supabase.from('incidents').select('id, assigned_department_id, department:departments!assigned_department_id(name)');
  const assignmentById = new Map<string, Partial<IncidentRow>>();
  if (!assignmentsError) for (const assignment of assignments ?? []) assignmentById.set(assignment.id, assignment as unknown as Partial<IncidentRow>);

  return ((data ?? []) as unknown as IncidentRow[]).map((row) => {
    const incident = { ...row, ...assignmentById.get(row.id) };
    return {
      id: incident.id,
      code: incident.code,
      title: incident.title,
      description: incident.description,
      category: categoryName(incident.category),
      location: incident.address_reference,
      status: incident.status,
      priority: incident.priority === undefined ? undefined : isIncidentPriority(incident.priority) ? incident.priority : null,
      departmentId: incident.assigned_department_id,
      department: Array.isArray(incident.department) ? incident.department[0]?.name ?? null : incident.department?.name ?? null,
      assignedToId: incident.assigned_to,
      createdAt: formatDate(incident.created_at),
      updatedAt: formatDate(incident.updated_at)
    };
  });
}

export async function listDepartments(): Promise<ReportDepartment[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.from('departments').select('id, name').eq('active', true).order('name');
  if (error) throw error;
  return data ?? [];
}

export async function uploadReportEvidence(incidentId: string, evidence: ReportEvidenceInput) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Inicia sesión para adjuntar una fotografía.');
  const { data: incident, error: incidentError } = await supabase.from('incidents').select('id, citizen_id').eq('id', incidentId).single();
  if (incidentError || !incident) throw new Error('El reporte no está disponible para esta sesión.');
  if (incident.citizen_id !== auth.user.id) requireBackendCapability('staffEvidence');
  if (evidence.mimeType !== 'image/jpeg') throw new Error('Selecciona una fotografía JPEG.');
  const response = await fetch(evidence.uri);
  if (!response.ok) throw new Error('No fue posible preparar la fotografía.');
  const file = await response.arrayBuffer();
  if (!file.byteLength || file.byteLength > 5 * 1024 * 1024) throw new Error('La fotografía debe pesar como máximo 5 MB.');
  const path = `${auth.user.id}/${incidentId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error: uploadError } = await supabase.storage.from('incidente-evidencia').upload(path, file, { contentType: evidence.mimeType, cacheControl: '3600', upsert: false });
  if (uploadError) throw uploadError;
  // Use the existing schema only. Do not assume file_url/file_type have been migrated.
  const { error: evidenceError } = await supabase.from('incident_evidence').insert({ incident_id: incidentId, uploaded_by: auth.user.id, storage_path: path, mime_type: evidence.mimeType });
  if (evidenceError) {
    // DELETE policy is not verified; do not try to compensate with a privileged operation.
    throw new EvidenceLinkError('La fotografía se subió pero no pudo vincularse al reporte. Conserva el reporte y contacta al administrador antes de reintentar.');
  }
  return path;
}

export async function listReportEvidence(incidentId: string): Promise<ReportEvidence[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const client = supabase;
  const { data: visible, error: visibilityError } = await client.from('incidents').select('id').eq('id', incidentId).single();
  if (visibilityError || !visible) throw new Error('El reporte no está disponible para esta sesión.');
  const { data, error } = await client.from('incident_evidence').select('id, storage_path, mime_type, uploaded_by, created_at').eq('incident_id', incidentId).order('created_at');
  if (error) throw error;
  return Promise.all((data ?? []).map(async (item) => {
    const parts = typeof item.storage_path === 'string' ? item.storage_path.split('/') : [];
    if (parts.length !== 3 || parts[0] !== item.uploaded_by || parts[1] !== incidentId || !parts[2] || parts.some((part: string) => part === '.' || part === '..')) throw new Error('La ruta de evidencia necesita revisión.');
    const { data: signed, error: signedError } = await client.storage.from('incidente-evidencia').createSignedUrl(item.storage_path, 15 * 60);
    if (signedError || !signed?.signedUrl) throw new Error('No fue posible abrir la fotografía.');
    return { id: String(item.id), url: signed.signedUrl, mimeType: item.mime_type ?? 'image/jpeg', createdAt: formatDateTime(item.created_at) };
  }));
}

export async function listReportHistory(incidentId: string): Promise<ReportHistoryEntry[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { data, error } = await supabase
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

type UpdateReportStatusResult = {
  updatedAt: string;
  historyRecorded: boolean;
};

export async function updateReportStatus(
  incidentId: string,
  previousStatus: IncidentStatus,
  newStatus: IncidentStatus,
  note: string,
  departmentName?: string
): Promise<UpdateReportStatusResult> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  if (previousStatus === newStatus) throw new Error('Selecciona un estado diferente al actual.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('La sesión ya no está disponible. Inicia sesión nuevamente.');

  let assignedDepartmentId: number | null = null;
  if (newStatus === 'ASIGNADO') {
    if (!departmentName) throw new Error('No fue posible determinar el departamento responsable.');
    const { data: department, error: departmentError } = await supabase
      .from('departments')
      .select('id')
      .eq('name', departmentName)
      .eq('active', true)
      .single();
    if (departmentError || !department) throw new Error('No existe un departamento activo para esta categoría.');
    assignedDepartmentId = department.id;
  }

  const updateValues: { status: IncidentStatus; assigned_department_id?: number } = { status: newStatus };
  if (assignedDepartmentId) updateValues.assigned_department_id = assignedDepartmentId;

  const { data: updatedIncident, error: updateError } = await supabase
    .from('incidents')
    .update(updateValues)
    .eq('id', incidentId)
    .eq('status', previousStatus)
    .select('updated_at')
    .single();

  if (updateError || !updatedIncident) {
    throw new Error(updateError?.message ?? 'El reporte cambió desde otra sesión. Actualiza la lista e intenta nuevamente.');
  }

  const { error: historyError } = await supabase.from('incident_history').insert({
    incident_id: incidentId,
    changed_by: authData.user.id,
    previous_status: previousStatus,
    new_status: newStatus,
    note: note.trim() || null
  });

  return {
    updatedAt: formatDate(updatedIncident.updated_at),
    historyRecorded: !historyError
  };
}
