import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IncidentCard } from '@/components/IncidentCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState, LoadingState } from '@/components/DataState';
import { useReports } from '@/hooks/useReports';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Incident } from '@/types/domain';
import { useSession } from '@/context/SessionContext';
import { roleVisuals } from '@/theme/roles';
import { listReportEvidence, listReportHistory, type ReportEvidence, type ReportHistoryEntry } from '@/services/reports';
import { reportReadScopeFor, workflowPermissionsFor } from '@/services/sessionPolicy';

const historyStatusLabels: Record<Incident['status'], string> = {
  REGISTRADO: 'Registrado', EN_REVISION: 'En revisión', VALIDADO: 'Validado', ASIGNADO: 'Asignado',
  EN_ATENCION: 'En atención', POR_VERIFICAR: 'Por verificar', CERRADO: 'Resuelto', RECHAZADO: 'Rechazado'
};

const steps = [
  { title: 'Reporte recibido', detail: 'La incidencia fue registrada en ZacApp.' },
  { title: 'Validación municipal', detail: 'Se revisa ubicación, categoría y prioridad.' },
  { title: 'Canalización departamental', detail: 'El área responsable recibe el reporte.' },
  { title: 'Verificación y cierre', detail: 'El encargado verifica la atención y administración confirma el cierre.' }
];

const completedByStatus: Record<Incident['status'], number> = {
  REGISTRADO: 1,
  EN_REVISION: 1,
  VALIDADO: 2,
  ASIGNADO: 3,
  EN_ATENCION: 3,
  POR_VERIFICAR: 3,
  CERRADO: 4,
  RECHAZADO: 1
};

export default function TrackingScreen() {
  const { role, databaseRole } = useSession();
  const permissions = workflowPermissionsFor(databaseRole);
  const visual = roleVisuals[role];
  const { incidents: availableIncidents, isLoading, error, reload, isPreview } = useReports();
  const pending = reportReadScopeFor(databaseRole) === 'pending' && !isPreview;
  const [category, setCategory] = useState('Todas');
  const [selectedItem, setSelected] = useState<Incident | null>(null);
  const selected = pending || isPreview ? null : availableIncidents.find((item) => item.id === selectedItem?.id) ?? null;
  const [history, setHistory] = useState<ReportHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [evidence, setEvidence] = useState<ReportEvidence[]>([]);
  const [evidenceError, setEvidenceError] = useState('');
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const categories = useMemo(() => ['Todas', ...new Set((isPreview ? [] : availableIncidents).map((item) => item.category))], [availableIncidents, isPreview]);
  const incidents = useMemo(() => availableIncidents.filter((item) => !isPreview && (category === 'Todas' || item.category === category)), [availableIncidents, category, isPreview]);

  const heading = permissions.operator ? 'Seguimiento de mis tareas' : permissions.departmentReports ? 'Seguimiento del departamento' : role === 'citizen' ? 'Seguimiento de mis reportes' : 'Seguimiento general';
  const completedSteps = selected ? completedByStatus[selected.status] ?? 0 : 0;
  const progress = Math.round((completedSteps / steps.length) * 100);

  useEffect(() => {
    if (!selected) return;

    let active = true;
    Promise.allSettled([listReportHistory(selected.id), listReportEvidence(selected.id)]).then(([historyResult, evidenceResult]) => {
      if (!active) return;
      if (historyResult.status === 'fulfilled') setHistory(historyResult.value);
      else { setHistory([]); setHistoryError('No fue posible consultar el historial.'); }
      if (evidenceResult.status === 'fulfilled') setEvidence(evidenceResult.value);
      else { setEvidence([]); setEvidenceError('No fue posible abrir las fotografías. Intenta actualizar la consulta.'); }
      setHistoryLoading(false);
      setEvidenceLoading(false);
    });
    return () => { active = false; };
  }, [selected, revision]);

  const selectIncident = (incident: Incident) => {
    setHistory([]);
    setHistoryError('');
    setHistoryLoading(true);
    setEvidence([]);
    setEvidenceError('');
    setEvidenceLoading(true);
    setSelected(incident);
  };

  const clearSelectedIncident = () => {
    setSelected(null);
    setHistory([]);
    setHistoryError('');
    setHistoryLoading(false);
    setEvidence([]);
    setEvidenceError('');
    setEvidenceLoading(false);
  };

  if (pending) return <ScrollView contentContainerStyle={styles.page}><Text style={styles.historyTitle}>Seguimiento no disponible</Text><Text style={styles.historyMuted}>Esta cuenta todavía no tiene una consulta de reportes habilitada.</Text></ScrollView>;

  return <ScrollView style={[styles.scroll, { backgroundColor: visual.background }]} contentContainerStyle={styles.page}>
    <View style={[styles.header, { backgroundColor: visual.primary }]}>
      <View style={styles.headerMark}><View style={[styles.headerIcon, { backgroundColor: visual.accent }]}><Ionicons name="pulse-outline" size={25} color={visual.primary} /></View><Text style={[styles.eyebrow, { color: visual.accent }]}>{visual.eyebrow} · SEGUIMIENTO</Text></View>
      <Text style={styles.title}>{heading}</Text><Text style={styles.copy}>{selected ? 'Consulta las etapas del reporte seleccionado.' : 'Elige un reporte para consultar su historial.'}</Text>
    </View>
    {selected ? <>
      <Pressable style={styles.backButton} onPress={clearSelectedIncident}><Ionicons name="arrow-back" size={19} color={visual.primary} /><Text style={[styles.backText, { color: visual.primary }]}>Elegir otro reporte</Text></Pressable>
      <View style={[styles.caseCard, { backgroundColor: visual.primary }]}>
        <View style={styles.caseMain}><Text style={[styles.code, { color: visual.accent }]}>{selected.code}</Text><Text style={styles.caseTitle}>{selected.title}</Text><Text style={styles.meta}>{selected.category} · {selected.location}</Text></View>
        <View style={styles.progressBadge}><Text style={[styles.progressValue, { color: visual.accent }]}>{progress}%</Text><Text style={styles.progressLabel}>del proceso</Text></View>
      </View>
      {selected.status === 'RECHAZADO' && <View style={styles.rejectedNotice}><Ionicons name="alert-circle-outline" size={21} color={colors.danger} /><View style={styles.rejectedText}><Text style={styles.rejectedTitle}>Reporte no procedente</Text><Text style={styles.rejectedCopy}>El caso requiere revisión adicional o nueva información antes de continuar.</Text></View></View>}
      <View style={styles.timeline}>{steps.map((step, index) => {
        const done = index < completedSteps;
        return <View key={step.title} style={styles.step}><View style={[styles.stepIcon, { backgroundColor: done ? visual.primary : `${visual.accent}22` }]}>{done ? <Ionicons name="checkmark" size={18} color={colors.white} /> : <Text style={[styles.stepNumber, { color: visual.primary }]}>{index + 1}</Text>}</View><View style={styles.stepContent}><Text style={styles.stepTitle}>{step.title}</Text><Text style={styles.stepDetail}>{step.detail}</Text>{index < steps.length - 1 && <View style={[styles.stepLine, { backgroundColor: done ? `${visual.primary}55` : colors.border }]} />}</View></View>;
      })}</View>
      <View style={styles.historyCard}>
        <Text style={styles.historyTitle}>Evidencia fotográfica</Text>
        {evidenceLoading ? <ActivityIndicator color={visual.primary} /> : evidenceError ? <Text style={styles.historyErrorText}>{evidenceError}</Text> : evidence.length ? <ScrollView horizontal contentContainerStyle={styles.filters}>{evidence.map((item) => <View key={item.id}><Image accessibilityLabel="Fotografía del reporte seleccionado" source={{ uri: item.url }} style={{ width: 280, height: 190, borderRadius: radius.md }} /><Text style={styles.historyMeta}>{item.createdAt}</Text></View>)}</ScrollView> : <Text style={styles.historyMuted}>Este reporte no tiene fotografías disponibles.</Text>}
        <Pressable accessibilityRole="button" onPress={() => { setHistoryLoading(true); setEvidenceLoading(true); setHistoryError(''); setEvidenceError(''); setRevision((value) => value + 1); }}><Text style={styles.backText}>Actualizar historial y fotografías</Text></Pressable>
      </View>
      <View style={styles.historyCard}>
        <View style={styles.historyHeader}><View><Text style={styles.historyKicker}>TRAZABILIDAD REAL</Text><Text style={styles.historyTitle}>Historial</Text></View><Ionicons name="time-outline" size={23} color={visual.primary} /></View>
        {historyLoading ? <View style={styles.historyLoading}><ActivityIndicator color={visual.primary} /><Text style={styles.historyMuted}>Consultando movimientos...</Text></View> : historyError ? <View style={styles.historyError}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.historyErrorText}>{historyError}</Text></View> : <View style={styles.historyList}>
          <View style={styles.historyItem}><View style={[styles.historyDot, { backgroundColor: visual.primary }]} /><View style={styles.historyBody}><Text style={styles.historyState}>Reporte registrado</Text><Text style={styles.historyMeta}>{selected.createdAt} · Ciudadanía</Text></View></View>
          {history.map((entry) => <View key={entry.id} style={styles.historyItem}><View style={[styles.historyDot, { backgroundColor: entry.newStatus === 'CERRADO' ? colors.accent : visual.primary }]} /><View style={styles.historyBody}><Text style={styles.historyState}>{entry.previousStatus ? `${historyStatusLabels[entry.previousStatus]} → ` : ''}{historyStatusLabels[entry.newStatus]}</Text><Text style={styles.historyMeta}>{entry.createdAt} · {entry.changedBy}</Text>{entry.note ? <Text style={styles.historyNote}>{entry.note}</Text> : null}</View></View>)}
        </View>}
      </View>
    </> : <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.filter, category === item && { backgroundColor: visual.primary, borderColor: visual.primary }]}><Text style={[styles.filterText, category === item && styles.filterTextActive]}>{item}</Text></Pressable>)}</ScrollView>
      {isLoading ? <LoadingState label="Consultando el seguimiento..." /> : error ? <ErrorState description={error} onRetry={reload} /> : isPreview ? <EmptyState title="Consulta real no disponible" description="El seguimiento se mostrará cuando la consulta real esté disponible." /> : incidents.length ? <View style={styles.list}>{incidents.map((item) => <IncidentCard key={item.id} incident={item} compact onPress={() => selectIncident(item)} />)}</View> : <EmptyState title={category === 'Todas' ? 'Aún no hay seguimiento disponible' : 'Sin coincidencias'} description={category !== 'Todas' ? 'Selecciona Todas para consultar las demás categorías.' : permissions.departmentReports ? 'Aquí aparecerá el seguimiento de los reportes canalizados a tu departamento.' : 'Aquí aparecerán el historial y las fotografías de tus reportes visibles.'} />}
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: spacing.md, gap: spacing.md },
  header: { borderRadius: radius.xl, padding: spacing.lg },
  headerMark: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  headerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  title: { fontSize: 25, lineHeight: 32, fontWeight: '800', color: colors.white },
  copy: { color: '#E3E9E1', marginTop: spacing.xs, lineHeight: 21 },
  filters: { gap: spacing.sm, paddingVertical: spacing.xs },
  filter: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.muted, fontWeight: '700' },
  filterTextActive: { color: colors.white },
  list: { gap: spacing.md },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  backText: { color: colors.primary, fontWeight: '800' },
  caseCard: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  caseMain: { flex: 1, minWidth: 0, flexBasis: 220, gap: spacing.xs },
  code: { color: colors.accent, fontWeight: '800' },
  caseTitle: { color: colors.white, fontSize: 19, lineHeight: 26, fontWeight: '800' },
  meta: { color: '#DDE8D7' },
  progressBadge: { minWidth: 105, borderRadius: radius.lg, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center' },
  progressValue: { fontSize: 26, fontWeight: '900' },
  progressLabel: { color: '#DDE8D7', fontSize: 11, fontWeight: '700' },
  rejectedNotice: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.dangerSoft, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rejectedText: { flex: 1 },
  rejectedTitle: { color: colors.danger, fontSize: 15, fontWeight: '800' },
  rejectedCopy: { color: colors.muted, marginTop: spacing.xs, lineHeight: 19 },
  timeline: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md },
  stepIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumber: { fontSize: 13, fontWeight: '900' },
  stepIconPending: { backgroundColor: colors.softGreen },
  stepContent: { flex: 1, paddingBottom: spacing.md },
  stepTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  stepDetail: { color: colors.muted, marginTop: spacing.xs, lineHeight: 20 },
  stepLine: { position: 'absolute', left: -31, top: 40, bottom: -10, width: 2, backgroundColor: colors.border },
  historyCard: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  historyHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  historyKicker: { color: colors.secondary, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  historyTitle: { flexShrink: 1, color: colors.text, fontSize: 18, lineHeight: 25, fontWeight: '800', marginTop: 2 },
  historyLoading: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  historyMuted: { color: colors.muted, fontSize: 13 },
  historyError: { borderRadius: radius.md, backgroundColor: colors.dangerSoft, padding: spacing.md, flexDirection: 'row', gap: spacing.sm },
  historyErrorText: { flex: 1, color: colors.danger, lineHeight: 19 },
  historyList: { gap: 0 },
  historyItem: { minHeight: 70, flexDirection: 'row', gap: spacing.md },
  historyDot: { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  historyBody: { flex: 1, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyState: { color: colors.text, fontSize: 15, fontWeight: '800' },
  historyMeta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  historyNote: { color: colors.text, lineHeight: 19, marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.sm }
});
