export type UserRole = 'visitante' | 'ciudadano' | 'operador' | 'coordinador' | 'mantenimiento' | 'supervisor' | 'administrador' | 'comunicacion';
export type IncidentStatus = 'REGISTRADO' | 'EN_REVISION' | 'VALIDADO' | 'ASIGNADO' | 'EN_ATENCION' | 'POR_VERIFICAR' | 'CERRADO' | 'RECHAZADO';
export type IncidentPriority = 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE';
export type MaintenanceDepartment = 'Agua' | 'EEMZA' | 'Drenajes' | 'Desechos' | 'Infraestructura';

export type DemoUserStatus = 'Activo' | 'Inactivo';
export type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: DemoUserStatus;
};

export type Incident = {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  location: string;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
  citizenName: string;
  citizenEmail: string;
  department: MaintenanceDepartment;
  priority: IncidentPriority;
  progress: number;
  evidenceAttached?: boolean;
};
