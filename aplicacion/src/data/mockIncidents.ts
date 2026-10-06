import { Incident } from '@/types/domain';
export const mockIncidents: Incident[] = [
  { id: '1', code: 'ZAC-2026-001', title: 'Lámpara dañada frente al parque', description: 'La luminaria no enciende por las noches.', category: 'Alumbrado público', location: 'Parque central, Zacapa', status: 'EN_ATENCION', createdAt: '2026-09-07', updatedAt: '2026-09-09' },
  { id: '2', code: 'ZAC-2026-002', title: 'Fuga de agua en la vía', description: 'Fuga constante junto a la banqueta.', category: 'Agua potable', location: 'Barrio La Laguna', status: 'VALIDADO', createdAt: '2026-09-08', updatedAt: '2026-09-09' },
  { id: '3', code: 'ZAC-2026-003', title: 'Acumulación de desechos', description: 'Basura acumulada durante varios días.', category: 'Limpieza', location: 'Colonia El Maestro', status: 'CERRADO', createdAt: '2026-09-01', updatedAt: '2026-09-06' },
  { id: '4', code: 'ZAC-2026-004', title: 'Poste con cable expuesto', description: 'El cableado quedó expuesto después de la lluvia.', category: 'Alumbrado público', location: 'Calzada Miguel García Granados', status: 'ASIGNADO', createdAt: '2026-09-10', updatedAt: '2026-09-11' },
  { id: '5', code: 'ZAC-2026-005', title: 'Solicitud de revisión legal', description: 'Vecinos solicitan revisión de permiso comunitario.', category: 'Secretaría', location: 'Zona 2, Zacapa', status: 'EN_REVISION', createdAt: '2026-09-12', updatedAt: '2026-09-12' },
  { id: '6', code: 'ZAC-2026-006', title: 'Baja presión de agua', description: 'El servicio llega con presión baja desde temprano.', category: 'Agua potable', location: 'Barrio San Marcos', status: 'ASIGNADO', createdAt: '2026-09-13', updatedAt: '2026-09-14' }
];
