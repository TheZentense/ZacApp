import { supabase } from '@/lib/supabase';
import type { Incident, IncidentPriority, IncidentStatus, MaintenanceDepartment } from '@/types/domain';

type CreateReportInput = {
  categoryName: string;
  description: string;
  location: string;
};

export type ReportEvidenceInput = {
  uri: string;
  mimeType: string;
};

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

  const response = await fetch(evidence.uri);
  if (!response.ok) throw new Error('No fue posible preparar la fotografía.');
  const fileData = await response.arrayBuffer();
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
    file_url: storagePath,
    mime_type: evidence.mimeType,
    file_type: evidence.mimeType
  });

  if (evidenceError) {
    await supabase.storage.from('incidente-evidencia').remove([storagePath]);
    throw evidenceError;
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
  priority: IncidentPriority | null;
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

export async function listReports(): Promise<Incident[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { data, error } = await supabase
    .from('incidents')
    .select('id, code, title, description, address_reference, status, priority, assigned_department_id, assigned_to, created_at, updated_at, category:categories(name), evidence:incident_evidence(id)')
    .order('created_at', { ascending: false });

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
      priority: incident.priority ?? 'MEDIA',
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

export async function listReportEvidence(incidentId: string): Promise<ReportEvidence[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const client = supabase;

  const { data, error } = await client
    .from('incident_evidence')
    .select('id, file_url, file_type, created_at')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return Promise.all((data ?? []).map(async (item) => {
    const storedValue = item.file_url as string;
    let url = storedValue;

    if (!/^https?:\/\//i.test(storedValue)) {
      const { data: signedData, error: signedError } = await client.storage
        .from('incidente-evidencia')
        .createSignedUrl(storedValue, 15 * 60);
      if (signedError || !signedData?.signedUrl) throw signedError ?? new Error('No fue posible abrir la evidencia.');
      url = signedData.signedUrl;
    }

    return {
      id: String(item.id),
      url,
      mimeType: item.file_type ?? 'image/jpeg',
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

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('La sesión ya no está disponible. Inicia sesión nuevamente.');

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
