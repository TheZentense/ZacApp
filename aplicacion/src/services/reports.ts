import { supabase } from '@/lib/supabase';
import type { Incident, IncidentStatus } from '@/types/domain';

type CreateReportInput = {
  categoryName: string;
  description: string;
  location: string;
};

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
    .select('id, code, title, description, address_reference, status, created_at, updated_at, category:categories(name)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as IncidentRow[]).map((incident) => ({
    id: incident.id,
    code: incident.code,
    title: incident.title,
    description: incident.description,
    category: categoryName(incident.category),
    location: incident.address_reference,
    status: incident.status,
    createdAt: formatDate(incident.created_at),
    updatedAt: formatDate(incident.updated_at)
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
