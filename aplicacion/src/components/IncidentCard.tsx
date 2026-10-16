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
  const status = statusStyles[incident.status];
  const categoryIcon = incident.category === 'Agua potable' ? 'water-outline' : incident.category === 'Alumbrado público' ? 'bulb-outline' : incident.category === 'Limpieza' ? 'trash-outline' : 'location-outline';

  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.card, compact && styles.compactCard, pressed && styles.pressed]}>
      <View style={styles.row}>
        <Text style={styles.code}>{incident.code}</Text>
        <View style={[styles.badge, { backgroundColor: status.backgroundColor }]}>
          <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      <View style={styles.titleRow}>
        <View style={styles.categoryIcon}><Ionicons name={categoryIcon} size={18} color={colors.primary} /></View>
        <Text style={styles.title}>{incident.title}</Text>
      </View>
      <Text style={styles.code}>Prioridad: {incident.priority === undefined ? 'no consultada' : isIncidentPriority(incident.priority) ? String(incident.priority) : 'no disponible'}</Text>
      {!compact && <Text style={styles.description} numberOfLines={2}>{incident.description}</Text>}
      <View style={styles.metaRow}><Text style={styles.category}>{incident.category}</Text><View style={styles.metaDot} /><Text style={styles.meta} numberOfLines={1}>{incident.location}</Text></View>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  code: { color: colors.muted, fontWeight: '700' },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  badgeText: { fontSize: 12, fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  categoryIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '800' },
  description: { color: colors.muted, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  category: { color: colors.secondary, fontSize: 12, fontWeight: '800' },
  metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.border },
  meta: { flexShrink: 1, color: colors.muted, fontSize: 12 },
  date: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  compactCard: { padding: spacing.md },
  pressed: { opacity: 0.8 },
  openRow: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  openLabel: { color: colors.primary, fontSize: 13, fontWeight: '800' }
});
