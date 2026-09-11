export type UserRole = 'visitante' | 'ciudadano' | 'operador' | 'coordinador' | 'mantenimiento' | 'supervisor' | 'administrador' | 'comunicacion';
export type IncidentStatus = 'REGISTRADO' | 'EN_REVISION' | 'VALIDADO' | 'ASIGNADO' | 'EN_ATENCION' | 'POR_VERIFICAR' | 'CERRADO' | 'RECHAZADO';
export type Incident = { id: string; code: string; title: string; description: string; category: string; location: string; status: IncidentStatus; createdAt: string; updatedAt: string };
