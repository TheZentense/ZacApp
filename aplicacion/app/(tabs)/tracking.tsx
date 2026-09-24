import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IncidentCard } from '@/components/IncidentCard';
import { mockIncidents } from '@/data/mockIncidents';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Incident } from '@/types/domain';
import { useSession } from '@/context/SessionContext';

const steps = [
  { title: 'Reporte recibido', detail: 'La incidencia fue registrada en ZacApp.' },
  { title: 'Validación municipal', detail: 'Se revisa ubicación, categoría y prioridad.' },
  { title: 'Asignación de equipo', detail: 'El área responsable coordina la atención.' },
  { title: 'Verificación ciudadana', detail: 'Se confirma el cierre y resultado del caso.' }
];

export default function TrackingScreen() {
  const { department } = useSession();
  const [category, setCategory] = useState('Todas');
  const [selected, setSelected] = useState<Incident | null>(null);
  const availableIncidents = useMemo(() => mockIncidents.filter((item) => !department || item.category === department), [department]);
  const categories = useMemo(() => ['Todas', ...new Set(availableIncidents.map((item) => item.category))], [availableIncidents]);
  const incidents = useMemo(() => availableIncidents.filter((item) => category === 'Todas' || item.category === category), [availableIncidents, category]);

  return <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
    <View style={styles.header}><Text style={styles.title}>Seguimiento</Text><Text style={styles.copy}>{selected ? 'Consulta las etapas del reporte seleccionado.' : 'Selecciona una categoría y abre el reporte que deseas consultar.'}</Text></View>
    {selected ? <>
      <Pressable style={styles.backButton} onPress={() => setSelected(null)}><Ionicons name="arrow-back" size={19} color={colors.primary} /><Text style={styles.backText}>Elegir otro reporte</Text></Pressable>
      <View style={styles.caseCard}><Text style={styles.code}>{selected.code}</Text><Text style={styles.caseTitle}>{selected.title}</Text><Text style={styles.meta}>{selected.category} · {selected.location}</Text></View>
      <View style={styles.timeline}>{steps.map((step, index) => {
        const completedSteps = selected.status === 'CERRADO' ? steps.length : selected.status === 'EN_ATENCION' ? 3 : 2;
        const done = index < completedSteps;
        return <View key={step.title} style={styles.step}><View style={[styles.stepIcon, !done && styles.stepIconPending]}><Ionicons name={done ? 'checkmark' : 'ellipse-outline'} size={18} color={done ? colors.white : colors.secondary} /></View><View style={styles.stepContent}><Text style={styles.stepTitle}>{step.title}</Text><Text style={styles.stepDetail}>{step.detail}</Text>{index < steps.length - 1 && <View style={styles.stepLine} />}</View></View>;
      })}</View>
    </> : <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.filter, category === item && styles.filterActive]}><Text style={[styles.filterText, category === item && styles.filterTextActive]}>{item}</Text></Pressable>)}</ScrollView>
      <View style={styles.list}>{incidents.map((item) => <IncidentCard key={item.id} incident={item} compact onPress={() => setSelected(item)} />)}</View>
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  header: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 28, fontWeight: '800', color: colors.primary },
  copy: { color: colors.muted, marginTop: spacing.xs, lineHeight: 21 },
  filters: { gap: spacing.sm, paddingVertical: spacing.xs },
  filter: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.muted, fontWeight: '700' },
  filterTextActive: { color: colors.white },
  list: { gap: spacing.md },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  backText: { color: colors.primary, fontWeight: '800' },
  caseCard: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.xs },
  code: { color: colors.accent, fontWeight: '800' },
  caseTitle: { color: colors.white, fontSize: 20, fontWeight: '800' },
  meta: { color: '#DDE8D7' },
  timeline: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md },
  stepIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepIconPending: { backgroundColor: colors.softGreen },
  stepContent: { flex: 1, paddingBottom: spacing.md },
  stepTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  stepDetail: { color: colors.muted, marginTop: spacing.xs, lineHeight: 20 },
  stepLine: { position: 'absolute', left: -31, top: 40, bottom: -10, width: 2, backgroundColor: colors.border }
});
