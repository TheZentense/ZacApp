import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mockIncidents } from '@/data/mockIncidents';
import { colors, radius, spacing } from '@/theme/tokens';

const steps = [
  { title: 'Reporte recibido', detail: 'La incidencia fue registrada en ZacApp.', done: true },
  { title: 'Validación municipal', detail: 'Se revisa ubicación, categoría y prioridad.', done: true },
  { title: 'Asignación de equipo', detail: 'Área responsable coordina la atención.', done: true },
  { title: 'Verificación ciudadana', detail: 'Pendiente confirmar cierre del caso.', done: false }
];

export default function TrackingScreen() {
  const selectedIncident = mockIncidents[0];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Seguimiento</Text>
        <Text style={styles.copy}>Vista demostrativa del avance de un reporte ciudadano.</Text>
      </View>

      <View style={styles.caseCard}>
        <Text style={styles.code}>{selectedIncident.code}</Text>
        <Text style={styles.caseTitle}>{selectedIncident.title}</Text>
        <Text style={styles.meta}>{selectedIncident.category} · {selectedIncident.location}</Text>
      </View>

      <View style={styles.timeline}>
        {steps.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <View style={[styles.stepIcon, !step.done && styles.stepIconPending]}>
              <Ionicons name={step.done ? 'checkmark' : 'ellipse-outline'} size={18} color={step.done ? colors.white : colors.secondary} />
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDetail}>{step.detail}</Text>
              {index < steps.length - 1 && <View style={styles.stepLine} />}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  header: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 28, fontWeight: '800', color: colors.primary },
  copy: { color: colors.muted, marginTop: spacing.xs, lineHeight: 21 },
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
