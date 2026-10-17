import type { UserRole as DatabaseRole } from '@/types/domain';

export type VisualRole = 'citizen' | 'admin' | 'superadmin' | 'maintenance' | 'employee';

// Proposed responsibilities, pending team confirmation. Never derive permissions from a visual role.
export function workflowPermissionsFor(databaseRole: unknown) {
  return {
    generalReports: databaseRole === 'administrador',
    departmentReports: databaseRole === 'mantenimiento',
    citizenReports: databaseRole === 'ciudadano',
    operator: databaseRole === 'operador'
  };
}

export function reportReadScopeFor(databaseRole: unknown): 'general' | 'department' | 'personal' | 'citizen' | 'pending' {
  const permissions = workflowPermissionsFor(databaseRole);
  if (permissions.generalReports) return 'general';
  if (permissions.departmentReports) return 'department';
  if (permissions.operator) return 'personal';
  if (permissions.citizenReports) return 'citizen';
  return 'pending';
}

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
