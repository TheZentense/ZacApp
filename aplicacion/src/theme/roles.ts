import type { UserRole } from '@/context/SessionContext';

export const roleVisuals: Record<UserRole, { label: string; eyebrow: string; primary: string; accent: string; background: string; muted: string }> = {
  citizen: { label: 'Portal ciudadano', eyebrow: 'CIUDADANO', primary: '#183B21', accent: '#8FAA38', background: '#F4F7F2', muted: '#66736A' },
  admin: { label: 'Administración general', eyebrow: 'ADMINISTRACIÓN', primary: '#183B21', accent: '#D9A441', background: '#F1F4F1', muted: '#66736A' },
  superadmin: { label: 'Administración general', eyebrow: 'ADMINISTRACIÓN', primary: '#0C1B1F', accent: '#8FAA38', background: '#EEF2F3', muted: '#657178' },
  maintenance: { label: 'Encargado departamental', eyebrow: 'MANTENIMIENTO', primary: '#62351A', accent: '#D79A58', background: '#F8F3EF', muted: '#77685F' },
  employee: { label: 'Empleado operativo', eyebrow: 'OPERACIÓN', primary: '#5E7C36', accent: '#B4C96A', background: '#F3F6EC', muted: '#68705D' }
};
