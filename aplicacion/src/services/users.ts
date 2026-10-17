import type { UserRole } from '@/types/domain';
import { requireBackendCapability } from '@/lib/backendCapabilities';
import { requireAdministrator } from '@/services/administration';

export type ManagedUser = { id: string; fullName: string; role: string; departmentId: number | null };

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const client = await requireAdministrator();
  const { data, error } = await client.from('profiles').select('id, full_name, role, department_id').order('full_name');
  if (error) throw error;
  return (data ?? []).map((item) => ({ id: item.id, fullName: item.full_name || 'Sin nombre', role: item.role, departmentId: item.department_id }));
}

export async function updateManagedUser(input: { id: string; role: UserRole; status: 'ACTIVO' | 'INACTIVO'; departmentId: number | null }) {
  requireBackendCapability('userAdministration');
  const client = await requireAdministrator();
  if (['administrador', 'supervisor', 'visitante'].includes(input.role)) throw new Error('Este rol no puede asignarse desde esta pantalla.');
  if (input.role !== 'ciudadano' && !input.departmentId) throw new Error('Selecciona un departamento.');
  const { data: previous, error: readError } = await client.from('profiles').select('role').eq('id', input.id).single();
  if (readError || !previous || previous.role === 'administrador') throw new Error('La cuenta no puede modificarse desde esta pantalla.');
  const { error } = await client.from('profiles').update({ role: input.role, status: input.status, department_id: input.departmentId }).eq('id', input.id).neq('role', 'administrador');
  if (error) throw error;
}
