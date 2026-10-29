import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IncidentHeatmap } from '@/components/IncidentLocation';
import { ErrorState, LoadingState } from '@/components/DataState';
import { useReports } from '@/hooks/useReports';
import { useSession } from '@/context/SessionContext';
import { colors, radius, spacing } from '@/theme/tokens';
import { analyticsSummary, countBy, filterAnalyticsIncidents, monthlyTrend, type AnalyticsFilters, type AnalyticsPeriod, type AnalyticsStatus, type CountItem } from '@/lib/reportAnalytics';

const periods: { value: AnalyticsPeriod; label: string }[] = [
  { value: '30D', label: '30 días' },
  { value: '90D', label: '3 meses' },
  { value: 'YEAR', label: '1 año' },
  { value: 'ALL', label: 'Histórico' }
];

const statusOptions: { value: AnalyticsStatus; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'ACTIVE', label: 'Activos' },
  { value: 'CLOSED', label: 'Cerrados' }
];

function FilterChips<T extends string>({ values, selected, onSelect }: { values: { value: T; label: string }[]; selected: T; onSelect: (value: T) => void }) {
  return <View style={styles.chips}>{values.map((item) => <Pressable key={item.value} onPress={() => onSelect(item.value)} style={[styles.chip, selected === item.value && styles.chipActive]}><Text style={[styles.chipText, selected === item.value && styles.chipTextActive]}>{item.label}</Text></Pressable>)}</View>;
}

function MetricCard({ icon, label, value, accent }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | number; accent: string }) {
  return <View style={styles.metric}><View style={[styles.metricIcon, { backgroundColor: `${accent}18` }]}><Ionicons name={icon} size={21} color={accent} /></View><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function BarList({ title, subtitle, items, color = colors.secondary }: { title: string; subtitle: string; items: CountItem[]; color?: string }) {
  const maximum = Math.max(...items.map((item) => item.value), 1);
  return <View style={styles.panel}><Text style={styles.panelTitle}>{title}</Text><Text style={styles.panelCopy}>{subtitle}</Text><View style={styles.bars}>{items.length ? items.slice(0, 7).map((item) => <View key={item.label} style={styles.barRow}><View style={styles.barHeading}><Text numberOfLines={1} style={styles.barLabel}>{item.label}</Text><Text style={styles.barValue}>{item.value}</Text></View><View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max((item.value / maximum) * 100, 4)}%`, backgroundColor: color }]} /></View></View>) : <Text style={styles.emptyText}>No hay información para los filtros seleccionados.</Text>}</View></View>;
}

export default function AdminAnalyticsScreen() {
  const { width } = useWindowDimensions();
  const { databaseRole } = useSession();
  const { incidents, isLoading, error, reload } = useReports();
  const [filters, setFilters] = useState<AnalyticsFilters>({ period: '90D', department: 'ALL', category: 'ALL', status: 'ALL' });
  const departments = useMemo(() => Array.from(new Set(incidents.map((item) => item.department).filter(Boolean))).sort(), [incidents]);
  const categories = useMemo(() => Array.from(new Set(incidents.map((item) => item.category).filter(Boolean))).sort(), [incidents]);
  const filtered = useMemo(() => filterAnalyticsIncidents(incidents, filters), [filters, incidents]);
  const summary = useMemo(() => analyticsSummary(filtered), [filtered]);
  const categoryCounts = useMemo(() => countBy(filtered, (item) => item.category), [filtered]);
  const departmentCounts = useMemo(() => countBy(filtered, (item) => item.department), [filtered]);
  const trend = useMemo(() => monthlyTrend(filtered), [filtered]);
  const isWide = width >= 900;

  if (databaseRole !== 'administrador') return <Redirect href="/(tabs)" />;

  const updateFilter = <K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) => setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => setFilters({ period: '90D', department: 'ALL', category: 'ALL', status: 'ALL' });

  return <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
    <View style={styles.hero}>
      <View style={styles.heroMain}><View style={styles.heroIcon}><Ionicons name="analytics" size={25} color={colors.primary} /></View><View style={styles.heroText}><Text style={styles.eyebrow}>ADMINISTRACIÓN · ANALÍTICA MUNICIPAL</Text><Text style={styles.title}>Panorama de incidentes</Text><Text style={styles.heroCopy}>Identifica tendencias, departamentos con mayor carga y zonas con concentración de reportes.</Text></View></View>
      <View style={styles.pulse}><Text style={styles.pulseLabel}>PULSO DEL PERIODO</Text><Text style={styles.pulseValue}>{summary.resolutionRate}%</Text><Text style={styles.pulseCopy}>de reportes cerrados</Text></View>
    </View>

    <View style={styles.filtersPanel}>
      <View style={styles.filterHeader}><View><Text style={styles.sectionKicker}>FILTROS</Text><Text style={styles.sectionTitle}>Explorar información</Text></View><Pressable style={styles.resetButton} onPress={resetFilters}><Ionicons name="refresh" size={16} color={colors.primary} /><Text style={styles.resetText}>Restablecer</Text></Pressable></View>
      <Text style={styles.filterLabel}>Periodo</Text><FilterChips values={periods} selected={filters.period} onSelect={(value) => updateFilter('period', value)} />
      <Text style={styles.filterLabel}>Estado</Text><FilterChips values={statusOptions} selected={filters.status} onSelect={(value) => updateFilter('status', value)} />
      <Text style={styles.filterLabel}>Departamento</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}><FilterChips values={[{ value: 'ALL', label: 'Todos' }, ...departments.map((value) => ({ value, label: value }))]} selected={filters.department} onSelect={(value) => updateFilter('department', value)} /></ScrollView>
      <Text style={styles.filterLabel}>Tipo de incidente</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}><FilterChips values={[{ value: 'ALL', label: 'Todos' }, ...categories.map((value) => ({ value, label: value }))]} selected={filters.category} onSelect={(value) => updateFilter('category', value)} /></ScrollView>
    </View>

    {isLoading ? <LoadingState label="Preparando indicadores..." /> : error ? <ErrorState description={error} onRetry={() => void reload()} /> : <>
      <View style={[styles.metrics, isWide && styles.metricsWide]}>
        <MetricCard icon="documents-outline" label="Reportes del periodo" value={summary.total} accent={colors.info} />
        <MetricCard icon="pulse-outline" label="Casos activos" value={summary.active} accent={colors.warning} />
        <MetricCard icon="checkmark-done-outline" label="Casos cerrados" value={summary.closed} accent={colors.secondary} />
        <MetricCard icon="alert-circle-outline" label="Prioridad alta" value={summary.urgent} accent={colors.danger} />
        <MetricCard icon="location-outline" label="Con ubicación" value={summary.located} accent={colors.primary} />
      </View>

      <View style={[styles.analyticsGrid, isWide && styles.analyticsGridWide]}>
        <View style={styles.analyticsColumn}><BarList title="Incidentes por categoría" subtitle="Problemas más frecuentes según los filtros." items={categoryCounts} color={colors.info} /></View>
        <View style={styles.analyticsColumn}><BarList title="Carga por departamento" subtitle="Cantidad de reportes canalizados por área." items={departmentCounts} color={colors.secondary} /></View>
      </View>
      <BarList title="Tendencia de los últimos seis meses" subtitle="Evolución mensual de los incidentes visibles." items={trend} color={colors.warning} />
      {summary.located ? <IncidentHeatmap incidents={filtered} /> : <View style={styles.panel}><Text style={styles.panelTitle}>Concentración geográfica</Text><Text style={styles.emptyText}>Los reportes filtrados no contienen coordenadas disponibles.</Text></View>}
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 1180, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg },
  hero: { backgroundColor: '#14243A', borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.lg, overflow: 'hidden' },
  heroMain: { flex: 1, minWidth: 260, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#E7B04B', alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#E7B04B', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: colors.white, fontSize: 25, fontWeight: '900', marginTop: 3 },
  heroCopy: { color: '#DCE5EF', lineHeight: 20, marginTop: spacing.xs, maxWidth: 620 },
  pulse: { minWidth: 180, borderRadius: radius.lg, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.09)' },
  pulseLabel: { color: '#DCE5EF', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  pulseValue: { color: '#E7B04B', fontSize: 34, fontWeight: '900', marginTop: spacing.xs },
  pulseCopy: { color: colors.white, fontSize: 12, fontWeight: '700' },
  filtersPanel: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  filterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.xs },
  sectionKicker: { color: colors.secondary, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900', marginTop: 2 },
  resetButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.softGreen },
  resetText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  filterLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7, marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  horizontalChips: { paddingRight: spacing.lg },
  chip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: colors.white },
  metrics: { gap: spacing.sm },
  metricsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  metric: { flex: 1, minWidth: 175, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.xs },
  metricIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  metricValue: { color: colors.text, fontSize: 26, fontWeight: '900' },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  analyticsGrid: { gap: spacing.lg },
  analyticsGridWide: { flexDirection: 'row' },
  analyticsColumn: { flex: 1, minWidth: 0 },
  panel: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.xs },
  panelTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  panelCopy: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  bars: { gap: spacing.md, marginTop: spacing.md },
  barRow: { gap: spacing.xs },
  barHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  barLabel: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '700' },
  barValue: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  barTrack: { height: 9, borderRadius: radius.pill, backgroundColor: colors.softGreen, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
  emptyText: { color: colors.muted, lineHeight: 20, marginTop: spacing.md }
});

