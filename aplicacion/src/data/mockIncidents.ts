import type { DemoUser, Incident, IncidentStatus, MaintenanceDepartment } from '@/types/domain';

export const mockIncidents: Incident[] = [
  {
    id: '1',
    code: 'ZAC-2026-001',
    title: 'Lámpara dañada frente al parque',
    description: 'La luminaria no enciende por las noches y deja oscuro el paso peatonal.',
    category: 'Alumbrado público',
    location: 'Parque central, Zacapa',
    status: 'EN_ATENCION',
    createdAt: '2026-09-07',
    updatedAt: '2026-09-09',
    citizenName: 'Daniela Cruz',
    citizenEmail: 'ciudadano@zacapp.gt',
    department: 'EEMZA',
    priority: 'ALTA',
    progress: 70
  },
  {
    id: '2',
    code: 'ZAC-2026-002',
    title: 'Fuga de agua en la vía',
    description: 'Fuga constante junto a la banqueta, el agua llega hasta la calle principal.',
    category: 'Agua potable',
    location: 'Barrio La Laguna',
    status: 'ASIGNADO',
    createdAt: '2026-09-08',
    updatedAt: '2026-09-10',
    citizenName: 'Daniela Cruz',
    citizenEmail: 'ciudadano@zacapp.gt',
    department: 'Agua',
    priority: 'URGENTE',
    progress: 45
  },
  {
    id: '3',
    code: 'ZAC-2026-003',
    title: 'Basura acumulada',
    description: 'Basura acumulada durante varios días cerca de viviendas y comercios.',
    category: 'Desechos sólidos',
    location: 'Colonia El Maestro',
    status: 'CERRADO',
    createdAt: '2026-09-01',
    updatedAt: '2026-09-06',
    citizenName: 'Daniela Cruz',
    citizenEmail: 'ciudadano@zacapp.gt',
    department: 'Desechos',
    priority: 'MEDIA',
    progress: 100
  },
  {
    id: '4',
    code: 'ZAC-2026-004',
    title: 'Drenaje obstruido por sedimentos',
    description: 'El drenaje rebalsa durante la lluvia y afecta el paso vehicular.',
    category: 'Drenajes',
    location: 'Calzada Miguel Garcia Granados',
    status: 'EN_REVISION',
    createdAt: '2026-09-11',
    updatedAt: '2026-09-12',
    citizenName: 'Mario Lemus',
    citizenEmail: 'mario.lemus@zacapp.gt',
    department: 'Drenajes',
    priority: 'ALTA',
    progress: 25
  },
  {
    id: '5',
    code: 'ZAC-2026-005',
    title: 'Poste con cable expuesto',
    description: 'Cableado visible en poste cercano a parada de buses.',
    category: 'Energía eléctrica',
    location: 'Avenida Huite',
    status: 'REGISTRADO',
    createdAt: '2026-09-13',
    updatedAt: '2026-09-13',
    citizenName: 'Ana Morales',
    citizenEmail: 'ana.morales@zacapp.gt',
    department: 'EEMZA',
    priority: 'URGENTE',
    progress: 10
  },
  {
    id: '6',
    code: 'ZAC-2026-006',
    title: 'Baja presión de agua',
    description: 'Varias viviendas reportan baja presión desde la mañana.',
    category: 'Agua potable',
    location: 'Colonia Santa Maria',
    status: 'POR_VERIFICAR',
    createdAt: '2026-09-09',
    updatedAt: '2026-09-14',
    citizenName: 'Luis Herrera',
    citizenEmail: 'luis.herrera@zacapp.gt',
    department: 'Agua',
    priority: 'MEDIA',
    progress: 85
  }
];

export const departmentLabels = ['Agua', 'EEMZA', 'Drenajes', 'Desechos', 'Infraestructura'] as const;

export const statusFilterLabels: { key: 'TODOS' | IncidentStatus; label: string }[] = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'REGISTRADO', label: 'Recibido' },
  { key: 'EN_REVISION', label: 'Validacion' },
  { key: 'ASIGNADO', label: 'Asignado' },
  { key: 'EN_ATENCION', label: 'En proceso' },
  { key: 'CERRADO', label: 'Resuelto' }
];

export const demoUsers: DemoUser[] = [
  { id: 'u1', name: 'Daniela Cruz', email: 'ciudadano@zacapp.gt', role: 'Ciudadano', status: 'Activo' },
  { id: 'u2', name: 'Mario Lemus', email: 'mario.lemus@zacapp.gt', role: 'Ciudadano', status: 'Activo' },
  { id: 'u3', name: 'Administracion ZacApp', email: 'admin@zacapp.gt', role: 'Administrador', status: 'Activo' },
  { id: 'u4', name: 'Equipo Agua', email: 'mantenimiento.agua@zacapp.gt', role: 'Mantenimiento Agua', status: 'Activo' },
  { id: 'u5', name: 'Equipo EEMZA', email: 'mantenimiento.eemza@zacapp.gt', role: 'Mantenimiento EEMZA', status: 'Activo' }
];

export const demoProfileByEmail = {
  'ciudadano@zacapp.gt': {
    name: 'Daniela Cruz',
    phone: '+502 5555-1020',
    address: 'Barrio La Laguna, Zacapa'
  },
  'admin@zacapp.gt': {
    name: 'Administracion ZacApp',
    phone: '+502 5555-2000',
    address: 'Municipalidad de Zacapa'
  },
  'mantenimiento.agua@zacapp.gt': {
    name: 'Equipo Agua',
    phone: '+502 5555-3100',
    address: 'Departamento de Agua'
  },
  'mantenimiento.eemza@zacapp.gt': {
    name: 'Equipo EEMZA',
    phone: '+502 5555-3200',
    address: 'Departamento EEMZA'
  }
} as const;

export function getDepartmentSummary(department: MaintenanceDepartment) {
  const incidents = mockIncidents.filter((incident) => incident.department === department);
  return {
    department,
    pending: incidents.filter((incident) => ['REGISTRADO', 'EN_REVISION', 'VALIDADO', 'ASIGNADO'].includes(incident.status)).length,
    inProgress: incidents.filter((incident) => incident.status === 'EN_ATENCION' || incident.status === 'POR_VERIFICAR').length,
    resolved: incidents.filter((incident) => incident.status === 'CERRADO').length
  };
}
