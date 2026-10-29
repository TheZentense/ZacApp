const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const screen = fs.readFileSync(path.join(root, 'app', 'admin', 'analytics.tsx'), 'utf8');
const analytics = fs.readFileSync(path.join(root, 'src', 'lib', 'reportAnalytics.ts'), 'utf8');
const menu = fs.readFileSync(path.join(root, 'app', '(tabs)', 'admin-menu.tsx'), 'utf8');

test('analytics dashboard is exclusive to the verified administrator role', () => {
  assert.match(screen, /databaseRole !== 'administrador'/);
  assert.match(screen, /<Redirect href="\/\(tabs\)"/);
  assert.match(menu, /Analítica municipal/);
});

test('analytics combines period, department, category and status filters', () => {
  assert.match(analytics, /period: AnalyticsPeriod/);
  assert.match(analytics, /department: string/);
  assert.match(analytics, /category: string/);
  assert.match(analytics, /status: AnalyticsStatus/);
  assert.match(screen, /filterAnalyticsIncidents\(incidents, filters\)/);
  assert.match(screen, /Hoy/);
  assert.match(screen, /Este mes/);
  assert.match(screen, /3 meses/);
  assert.match(screen, /1 año/);
});

test('analytics can export a filtered detail and print the summary or only the map', () => {
  assert.match(screen, /Imprimir resumen/);
  assert.match(screen, /Exportar detalle/);
  assert.match(screen, /Imprimir mapa/);
  assert.match(screen, /exportAnalyticsDetail\(filtered, exportTitle\)/);
  assert.match(screen, /nativeID="analytics-map-section"/);
});

test('analytics exposes summaries, rankings, trends and the authorized heatmap', () => {
  assert.match(screen, /analyticsSummary\(filtered\)/);
  assert.match(screen, /countBy\(filtered, \(item\) => item\.category\)/);
  assert.match(screen, /countBy\(filtered, \(item\) => item\.department\)/);
  assert.match(screen, /monthlyTrend\(filtered\)/);
  assert.match(screen, /<IncidentHeatmap incidents=\{filtered\}/);
  assert.doesNotMatch(screen, /reporterContact|citizenEmail|citizenName/);
});
