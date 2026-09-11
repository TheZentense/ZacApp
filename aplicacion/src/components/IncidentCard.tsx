import { StyleSheet, Text, View } from 'react-native';
import { Incident } from '@/types/domain';
import { colors, radius, spacing } from '@/theme/tokens';

const statusStyles = {
  REGISTRADO: { label: 'Registrado', backgroundColor: colors.infoSoft, color: colors.info },
  EN_REVISION: { label: 'En revisión', backgroundColor: colors.warningSoft, color: colors.warning },
  VALIDADO: { label: 'Validado', backgroundColor: colors.softGreen, color: colors.secondary },
  ASIGNADO: { label: 'Asignado', backgroundColor: colors.infoSoft, color: colors.info },
  EN_ATENCION: { label: 'En atención', backgroundColor: colors.warningSoft, color: colors.warning },
  POR_VERIFICAR: { label: 'Por verificar', backgroundColor: colors.infoSoft, color: colors.info },
  CERRADO: { label: 'Resuelto', backgroundColor: colors.softGreen, color: colors.primary },
  RECHAZADO: { label: 'Rechazado', backgroundColor: colors.dangerSoft, color: colors.danger }
} as const;

export function IncidentCard({ incident }: { incident: Incident }) {
  const status = statusStyles[incident.status];

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.code}>{incident.code}</Text>
        <View style={[styles.badge, { backgroundColor: status.backgroundColor }]}>
          <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      <Text style={styles.title}>{incident.title}</Text>
      <Text style={styles.description} numberOfLines={2}>{incident.description}</Text>
      <Text style={styles.meta}>{incident.category} · {incident.location}</Text>
      <Text style={styles.date}>Actualizado: {incident.updatedAt}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  code: { color: colors.muted, fontWeight: '700' },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  badgeText: { fontSize: 12, fontWeight: '800' },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  description: { color: colors.muted, lineHeight: 20 },
  meta: { color: colors.muted },
  date: { color: colors.secondary, fontSize: 12, fontWeight: '700' }
});
