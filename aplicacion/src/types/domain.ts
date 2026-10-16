export type UserRole = 'visitante' | 'ciudadano' | 'operador' | 'coordinador' | 'mantenimiento' | 'supervisor' | 'administrador' | 'comunicacion';
export type IncidentStatus = 'REGISTRADO' | 'EN_REVISION' | 'VALIDADO' | 'ASIGNADO' | 'EN_ATENCION' | 'POR_VERIFICAR' | 'CERRADO' | 'RECHAZADO';
export type IncidentPriority = 1 | 2 | 3 | 4;

export function isIncidentPriority(value: unknown): value is IncidentPriority {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4;
}

export type Incident = {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  location: string;
  status: IncidentStatus;
  priority?: IncidentPriority | null;
  departmentId?: number | null;
  department?: string | null;
  assignedToId?: string | null;
  createdAt: string;
  updatedAt: string;
};
