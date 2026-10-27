import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isIncidentPriority, type Incident } from '@/types/domain';
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

export function IncidentCard({ incident, onPress, compact = false }: { incident: Incident; onPress?: () => void; compact?: boolean }) {
  const status = statusStyles[incident.status] ?? { label: 'Estado no disponible', backgroundColor: colors.surface, color: colors.muted };
  const department = incident.department ?? (incident.departmentId === null ? 'Sin canalizar' : incident.departmentId === undefined ? 'No disponible' : 'Área ' + incident.departmentId);
  const categoryIcon = incident.category === 'Agua potable' ? 'water-outline' : incident.category === 'Alumbrado público' ? 'bulb-outline' : incident.category === 'Limpieza' ? 'trash-outline' : 'location-outline';
  const priorityColor = incident.priority === 'URGENTE' ? colors.danger : incident.priority === 'ALTA' ? colors.warning : incident.priority === 'MEDIA' ? colors.info : colors.secondary;
  const priorityBackground = incident.priority === 'URGENTE' ? colors.dangerSoft : incident.priority === 'ALTA' ? colors.warningSoft : incident.priority === 'MEDIA' ? colors.infoSoft : colors.softGreen;

  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.card, compact && styles.compactCard, pressed && styles.pressed]}>
      <View style={styles.row}>
        <Text selectable style={styles.code}>{incident.code}</Text>
        <View style={[styles.badge, { backgroundColor: status.backgroundColor }]}>
          <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      <View style={styles.titleRow}>
        <View style={styles.categoryIcon}><Ionicons name={categoryIcon} size={18} color={colors.primary} /></View>
        <Text style={styles.title}>{incident.title}</Text>
      </View>
      <View style={[styles.priorityBadge, { backgroundColor: priorityBackground }]}><Ionicons name={incident.priority === 'URGENTE' || incident.priority === 'ALTA' ? 'alert-circle-outline' : 'flag-outline'} size={14} color={priorityColor} /><Text style={[styles.priorityText, { color: priorityColor }]}>Prioridad: {incident.priority === undefined ? 'no consultada' : isIncidentPriority(incident.priority) ? String(incident.priority) : 'no disponible'}</Text></View>
      {!compact && <Text style={styles.description} numberOfLines={2}>{incident.description}</Text>}
      <View style={styles.metaRow}><Ionicons name="location-outline" size={15} color={colors.secondary} /><Text style={styles.meta} numberOfLines={compact ? 1 : 2}>{incident.location}</Text></View>
      <Text style={styles.meta}>Departamento: {department}</Text>
      <View style={styles.metaGrid}><View style={styles.metaPill}><Ionicons name={incident.assignedToId ? 'person-circle-outline' : 'person-add-outline'} size={14} color={colors.secondary} /><Text style={styles.metaPillText}>{incident.assignedToId ? 'Responsable asignado' : 'Sin responsable'}</Text></View>{incident.evidenceAttached ? <View style={styles.metaPill}><Ionicons name="images-outline" size={14} color={colors.secondary} /><Text style={styles.metaPillText}>Con evidencia</Text></View> : null}</View>
      {!compact && <Text style={styles.date}>Actualizado: {incident.updatedAt}</Text>}
      {onPress && <View style={styles.openRow}><Text style={styles.openLabel}>Abrir reporte</Text><Ionicons name="arrow-forward" size={15} color={colors.primary} /></View>}
    </Pressable>
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
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  code: { flexShrink: 1, color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  badge: { flexShrink: 1, maxWidth: '100%', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  badgeText: { fontSize: 12, fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  categoryIcon: { flexShrink: 0, width: 34, height: 34, borderRadius: 12, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, minWidth: 0, color: colors.text, fontSize: 16, lineHeight: 23, fontWeight: '800' },
  priorityBadge: { alignSelf: 'flex-start', maxWidth: '100%', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  priorityText: { color: colors.primary, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  description: { color: colors.muted, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  category: { color: colors.secondary, fontSize: 12, fontWeight: '800' },
  metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.border },
  meta: { flexShrink: 1, color: colors.muted, fontSize: 12, lineHeight: 18 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  metaPillText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  date: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  compactCard: { padding: spacing.md },
  pressed: { opacity: 0.8 },
  openRow: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  openLabel: { color: colors.primary, fontSize: 13, fontWeight: '800' }
});
