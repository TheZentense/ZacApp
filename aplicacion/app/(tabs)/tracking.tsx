import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IncidentCard } from '@/components/IncidentCard';
import { SectionHeader } from '@/components/SectionHeader';
import { getStatusLabel, StatusBadge } from '@/components/StatusBadge';
import { useReports } from '@/context/ReportsContext';
import { mockIncidents } from '@/data/mockIncidents';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Incident, IncidentStatus } from '@/types/domain';
import { useSession } from '@/context/SessionContext';

const steps = ['Recibido', 'Validacion', 'Asignado', 'En proceso', 'Resuelto'] as const;

function getStepIndex(status: IncidentStatus) {
  if (status === 'CERRADO') return 4;
  if (status === 'EN_ATENCION' || status === 'POR_VERIFICAR') return 3;
  if (status === 'ASIGNADO') return 2;
  if (status === 'EN_REVISION' || status === 'VALIDADO') return 1;
  return 0;
}

export default function TrackingScreen() {
  const { role, department, email } = useSession();
  const { demoReports } = useReports();
  const [selected, setSelected] = useState<Incident | null>(null);
  const allIncidents = useMemo(() => [...demoReports, ...mockIncidents], [demoReports]);

  const incidents = useMemo(() => {
    if (role === 'admin') return allIncidents;
    if (role === 'maintenance') return allIncidents.filter((item) => item.department === department);
    return allIncidents.filter((item) => item.citizenEmail === email);
  }, [allIncidents, department, email, role]);

  const title = role === 'maintenance' ? `Seguimiento · ${department}` : role === 'admin' ? 'Seguimiento general' : 'Seguimiento';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.copy}>{selected ? 'Estado actual y avance de la incidencia.' : 'Selecciona un reporte para consultar su avance.'}</Text>
      </View>

      {selected ? (
        <>
          <Pressable style={styles.backButton} onPress={() => setSelected(null)}>
            <Ionicons name="arrow-back" size={19} color={colors.primary} />
            <Text style={styles.backText}>Elegir otro reporte</Text>
          </Pressable>

          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.code}>{selected.code}</Text>
                <Text style={styles.caseTitle}>{selected.title}</Text>
              </View>
              <StatusBadge status={selected.status} />
            </View>
            <InfoRow label="Estado actual" value={getStatusLabel(selected.status)} />
            <InfoRow label="Avance" value={`${selected.progress}%`} />
            <InfoRow label="Departamento responsable" value={selected.department} />
            <InfoRow label="Ultima actualizacion" value={selected.updatedAt} />
          </View>

          <View style={styles.timeline}>
            <SectionHeader title="Linea de estados" meta="Demo" />
            {steps.map((step, index) => {
              const done = index <= getStepIndex(selected.status);
              return (
                <View key={step} style={styles.step}>
                  <View style={[styles.stepIcon, !done && styles.stepIconPending]}>
                    <Ionicons name={done ? 'checkmark' : 'ellipse-outline'} size={17} color={done ? colors.white : colors.secondary} />
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>{step}</Text>
                    {index < steps.length - 1 ? <View style={styles.stepLine} /> : null}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <>
          <SectionHeader title="Reportes disponibles" meta={`${incidents.length} visibles`} />
          <View style={styles.list}>
            {incidents.map((item) => (
              <IncidentCard key={item.id} incident={item} compact showCitizen={role === 'admin'} actions={[{ label: 'Ver seguimiento', onPress: () => setSelected(item) }]} />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 880, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  header: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 26, fontWeight: '800', color: colors.primary },
  copy: { color: colors.muted, marginTop: spacing.xs, lineHeight: 21 },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  backText: { color: colors.primary, fontWeight: '800' },
  summaryCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  code: { color: colors.secondary, fontWeight: '800' },
  caseTitle: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: spacing.xs },
  infoRow: { paddingTop: spacing.sm },
  infoLabel: { color: colors.secondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  infoValue: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 2 },
  timeline: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md },
  stepIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepIconPending: { backgroundColor: colors.softGreen },
  stepContent: { flex: 1, minHeight: 42 },
  stepTitle: { color: colors.text, fontSize: 15, fontWeight: '800', paddingTop: 6 },
  stepLine: { position: 'absolute', left: -29, top: 34, bottom: -8, width: 2, backgroundColor: colors.border },
  list: { gap: spacing.md }
});
