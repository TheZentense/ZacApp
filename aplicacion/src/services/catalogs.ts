import { requireBackendCapability } from '@/lib/backendCapabilities';
import { requireAdministrator } from '@/services/administration';

export type CatalogItem = { id: number; name: string; active: boolean };

export async function listCatalogs(): Promise<{ categories: CatalogItem[]; departments: CatalogItem[] }> {
  const client = await requireAdministrator();
  const [categories, departments] = await Promise.all([
    client.from('categories').select('id, name, active').order('name'),
    client.from('departments').select('id, name, active').order('name')
  ]);
  if (categories.error || departments.error) throw new Error('No fue posible consultar los catálogos disponibles para esta sesión.');
  return { categories: categories.data ?? [], departments: departments.data ?? [] };
}

export async function updateCatalogItem(table: 'categories' | 'departments', id: number, active: boolean) {
  requireBackendCapability('catalogAdministration');
  const client = await requireAdministrator();
  if (!Number.isInteger(id) || id <= 0) throw new Error('Selecciona una opción válida.');
  const { error } = await client.from(table).update({ active }).eq('id', id);
  if (error) throw error;
}
