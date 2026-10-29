import type { Incident } from '@/types/domain';

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function safeFilename(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'zacapp-analitica';
}

export function exportAnalyticsDetail(incidents: Incident[], title: string) {
  const headers = ['Código', 'Fecha', 'Categoría', 'Departamento', 'Estado', 'Prioridad', 'Ubicación', 'Latitud', 'Longitud'];
  const rows = incidents.map((incident) => [incident.code, incident.createdAt, incident.category, incident.department, incident.status, incident.priority, incident.location, incident.latitude, incident.longitude]);
  const csv = '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFilename(title)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function printAnalyticsSummary() {
  window.print();
}

export function printAnalyticsMap() {
  const style = document.createElement('style');
  style.id = 'zacapp-map-print-style';
  style.textContent = '@media print { body * { visibility: hidden !important; } #analytics-map-section, #analytics-map-section * { visibility: visible !important; } #analytics-map-section { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; padding: 16px !important; background: white !important; } }';
  document.head.appendChild(style);
  const cleanup = () => style.remove();
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 2000);
}

