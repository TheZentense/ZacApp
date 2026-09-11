import { Incident } from '@/types/domain';
export const mockIncidents: Incident[] = [
  { id: '1', code: 'ZAC-2026-001', title: 'Lámpara dañada frente al parque', description: 'La luminaria no enciende por las noches.', category: 'Alumbrado público', location: 'Parque central, Zacapa', status: 'EN_ATENCION', createdAt: '2026-09-07', updatedAt: '2026-09-09' },
  { id: '2', code: 'ZAC-2026-002', title: 'Fuga de agua en la vía', description: 'Fuga constante junto a la banqueta.', category: 'Agua potable', location: 'Barrio La Laguna', status: 'VALIDADO', createdAt: '2026-09-08', updatedAt: '2026-09-09' },
  { id: '3', code: 'ZAC-2026-003', title: 'Acumulación de desechos', description: 'Basura acumulada durante varios días.', category: 'Limpieza', location: 'Colonia El Maestro', status: 'CERRADO', createdAt: '2026-09-01', updatedAt: '2026-09-06' }
];
