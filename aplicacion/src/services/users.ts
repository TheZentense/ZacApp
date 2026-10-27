import { supabase } from '@/lib/supabase';
import { requireBackendCapability } from '@/lib/backendCapabilities';
import { requireAdministrator } from '@/services/administration';
import type { UserRole } from '@/types/domain';

export type ManagedUser = {
  id: string;
  fullName: string;
  role: UserRole;
  status: 'ACTIVO' | 'INACTIVO';
  departmentId: number | null;
  departmentName: string | null;
  createdAt: string;
};

type ProfileRow = {
  id: string;
  full_name: string;
  role: UserRole;
  status: 'ACTIVO' | 'INACTIVO';
  department_id: number | null;
  created_at: string;
  department: { name?: string } | { name?: string }[] | null;
};

export async function listManagedUsers(): Promise<ManagedUser[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.from('profiles').select('id, full_name, role, status, department_id, created_at, department:departments(name)').order('full_name');
  if (error) throw error;
  return ((data ?? []) as unknown as ProfileRow[]).map((item) => ({
    id: item.id,
    fullName: item.full_name,
    role: item.role,
    status: item.status,
    departmentId: item.department_id,
    departmentName: Array.isArray(item.department) ? item.department[0]?.name ?? null : item.department?.name ?? null,
    createdAt: new Intl.DateTimeFormat('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(item.created_at))
  }));
}

export async function updateManagedUser(input: { id: string; role: UserRole; status: 'ACTIVO' | 'INACTIVO'; departmentId: number | null }) {
  requireBackendCapability('userAdministration');
  const client = await requireAdministrator();
  if (input.role === 'administrador') throw new Error('Las cuentas administrativas requieren el flujo de Superadministración.');
  const requiresDepartment = ['operador', 'coordinador', 'mantenimiento', 'comunicacion'].includes(input.role);
  if (requiresDepartment && !input.departmentId) throw new Error('Selecciona un departamento para este rol.');
  const { error } = await client.from('profiles').update({ role: input.role, status: input.status, department_id: requiresDepartment ? input.departmentId : null }).eq('id', input.id);
  if (error) throw error;
}
