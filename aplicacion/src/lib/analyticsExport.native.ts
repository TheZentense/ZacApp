import { Share } from 'react-native';
import type { Incident } from '@/types/domain';

function summaryText(incidents: Incident[], title: string) {
  const header = `${title}\n${incidents.length} incidentes`;
  const rows = incidents.slice(0, 100).map((incident) => `${incident.code} · ${incident.category} · ${incident.department} · ${incident.status} · ${incident.location}`);
  const remaining = incidents.length > 100 ? `\n…y ${incidents.length - 100} incidentes adicionales.` : '';
  return `${header}\n\n${rows.join('\n')}${remaining}`;
}

export async function exportAnalyticsDetail(incidents: Incident[], title: string) {
  await Share.share({ title, message: summaryText(incidents, title) });
}

export async function printAnalyticsSummary() {
  await Share.share({ title: 'Analítica municipal ZacApp', message: 'Consulta e imprime el resumen completo desde la versión web de ZacApp.' });
}

export async function printAnalyticsMap() {
  await Share.share({ title: 'Mapa de incidentes ZacApp', message: 'Consulta e imprime el mapa filtrado desde la versión web de ZacApp.' });
}

