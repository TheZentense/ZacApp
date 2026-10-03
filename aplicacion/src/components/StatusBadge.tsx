import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';
import type { IncidentPriority, IncidentStatus } from '@/types/domain';

const statusStyles: Record<IncidentStatus, { label: string; backgroundColor: string; color: string }> = {
  REGISTRADO: { label: 'Recibido', backgroundColor: colors.infoSoft, color: colors.info },
  EN_REVISION: { label: 'Validacion', backgroundColor: colors.warningSoft, color: colors.warning },
  VALIDADO: { label: 'Validado', backgroundColor: colors.softGreen, color: colors.secondary },
  ASIGNADO: { label: 'Asignado', backgroundColor: colors.infoSoft, color: colors.info },
  EN_ATENCION: { label: 'En proceso', backgroundColor: colors.warningSoft, color: colors.warning },
  POR_VERIFICAR: { label: 'Por verificar', backgroundColor: colors.infoSoft, color: colors.info },
  CERRADO: { label: 'Resuelto', backgroundColor: colors.softGreen, color: colors.primary },
  RECHAZADO: { label: 'Rechazado', backgroundColor: colors.dangerSoft, color: colors.danger }
};

const priorityStyles: Record<IncidentPriority, { label: string; backgroundColor: string; color: string }> = {
  BAJA: { label: 'Baja', backgroundColor: colors.softGreen, color: colors.secondary },
  MEDIA: { label: 'Media', backgroundColor: colors.infoSoft, color: colors.info },
  ALTA: { label: 'Alta', backgroundColor: colors.warningSoft, color: colors.warning },
  URGENTE: { label: 'Urgente', backgroundColor: colors.dangerSoft, color: colors.danger }
};

export function getStatusLabel(status: IncidentStatus) {
  return statusStyles[status].label;
}

export function getPriorityLabel(priority: IncidentPriority) {
  return priorityStyles[priority].label;
}

export function StatusBadge({ status, priority }: { status?: IncidentStatus; priority?: IncidentPriority }) {
  const style = status ? statusStyles[status] : priority ? priorityStyles[priority] : null;
  if (!style) return null;

  return (
    <View style={[styles.badge, { backgroundColor: style.backgroundColor }]}>
      <Text style={[styles.text, { color: style.color }]}>{style.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  text: {
    fontSize: 12,
    fontWeight: '800'
  }
});
