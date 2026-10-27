import { supabase } from '@/lib/supabase';
import { requireBackendCapability } from '@/lib/backendCapabilities';
import { requireAdministrator } from '@/services/administration';

export type CatalogDepartment = { id: number; name: string; code: string; active: boolean };
export type CatalogCategory = { id: number; name: string; active: boolean; departmentId: number; departmentName: string };

export async function listCatalogDepartments(): Promise<CatalogDepartment[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.from('departments').select('id, name, code, active').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listCatalogCategories(): Promise<CatalogCategory[]> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.from('categories').select('id, name, active, department_id, department:departments(name)').order('name');
  if (error) throw error;
  return (data ?? []).map((item) => {
    const department = item.department as unknown as { name?: string } | { name?: string }[] | null;
    return { id: item.id, name: item.name, active: item.active, departmentId: item.department_id, departmentName: (Array.isArray(department) ? department[0]?.name : department?.name) ?? 'Sin departamento' };
  });
}

export async function updateCatalogCategory(id: number, departmentId: number, active: boolean) {
  requireBackendCapability('catalogAdministration');
  const client = await requireAdministrator();
  const { error } = await client.from('categories').update({ department_id: departmentId, active }).eq('id', id);
  if (error) throw error;
}

export async function updateCatalogDepartment(id: number, active: boolean) {
  requireBackendCapability('catalogAdministration');
  const client = await requireAdministrator();
  const { error } = await client.from('departments').update({ active }).eq('id', id);
  if (error) throw error;
}
