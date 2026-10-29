import type { Incident } from '@/types/domain';

export type AnalyticsPeriod = '30D' | '90D' | 'YEAR' | 'ALL';
export type AnalyticsStatus = 'ALL' | 'ACTIVE' | 'CLOSED';

export type AnalyticsFilters = {
  period: AnalyticsPeriod;
  department: string;
  category: string;
  status: AnalyticsStatus;
};

export type CountItem = { label: string; value: number };

const closedStatuses = new Set(['CERRADO', 'RECHAZADO']);

function periodStart(period: AnalyticsPeriod, now: Date) {
  if (period === 'ALL') return null;
  const days = period === '30D' ? 30 : period === '90D' ? 90 : 365;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return start;
}

export function filterAnalyticsIncidents(incidents: Incident[], filters: AnalyticsFilters, now = new Date()) {
  const start = periodStart(filters.period, now);
  return incidents.filter((incident) => {
    const createdAt = new Date(incident.createdAt);
    if (start && (!Number.isFinite(createdAt.getTime()) || createdAt < start)) return false;
    if (filters.department !== 'ALL' && incident.department !== filters.department) return false;
    if (filters.category !== 'ALL' && incident.category !== filters.category) return false;
    if (filters.status === 'ACTIVE' && closedStatuses.has(incident.status)) return false;
    if (filters.status === 'CLOSED' && !closedStatuses.has(incident.status)) return false;
    return true;
  });
}

export function countBy(incidents: Incident[], value: (incident: Incident) => string): CountItem[] {
  const counts = new Map<string, number>();
  incidents.forEach((incident) => {
    const label = value(incident).trim() || 'Sin clasificar';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return Array.from(counts, ([label, count]) => ({ label, value: count }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
}

export function analyticsSummary(incidents: Incident[]) {
  const closed = incidents.filter((incident) => incident.status === 'CERRADO').length;
  const active = incidents.filter((incident) => !closedStatuses.has(incident.status)).length;
  const urgent = incidents.filter((incident) => incident.priority === 'URGENTE' || incident.priority === 'ALTA').length;
  const located = incidents.filter((incident) => incident.latitude != null && incident.longitude != null).length;
  return {
    total: incidents.length,
    active,
    closed,
    urgent,
    located,
    resolutionRate: incidents.length ? Math.round((closed / incidents.length) * 100) : 0
  };
}

export function monthlyTrend(incidents: Incident[], monthCount = 6, now = new Date()): CountItem[] {
  const formatter = new Intl.DateTimeFormat('es-GT', { month: 'short', timeZone: 'America/Guatemala' });
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1 - index), 1);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, label: formatter.format(date).replace('.', '') };
  });
  const counts = new Map(months.map((month) => [month.key, 0]));
  incidents.forEach((incident) => {
    const date = new Date(incident.createdAt);
    if (!Number.isFinite(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return months.map((month) => ({ label: month.label, value: counts.get(month.key) ?? 0 }));
}

