import type { UserRole as DatabaseRole } from '@/types/domain';

export type VisualRole = 'citizen' | 'admin' | 'superadmin' | 'maintenance' | 'employee';

export function visualRoleFor(databaseRole: unknown): VisualRole {
  if (databaseRole === 'administrador') return 'superadmin';
  if (databaseRole === 'supervisor') return 'admin';
  if (databaseRole === 'mantenimiento') return 'maintenance';
  if (['operador', 'coordinador', 'comunicacion'].includes(String(databaseRole))) return 'employee';
  return 'citizen';
}

export function isDatabaseRole(value: unknown): value is DatabaseRole {
  return typeof value === 'string' && ['visitante', 'ciudadano', 'operador', 'coordinador', 'mantenimiento', 'supervisor', 'administrador', 'comunicacion'].includes(value);
}
