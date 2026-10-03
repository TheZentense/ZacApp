import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Incident } from '@/types/domain';
import { colors, radius, spacing } from '@/theme/tokens';
import { getPriorityLabel, StatusBadge } from '@/components/StatusBadge';

type CardAction = {
  label: string;
  onPress: () => void;
};

export function IncidentCard({
  incident,
  onPress,
  compact = false,
  showCitizen = false,
  actions = []
}: {
  incident: Incident;
  onPress?: () => void;
  compact?: boolean;
  showCitizen?: boolean;
  actions?: CardAction[];
}) {
  const hasActions = actions.length > 0;

  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.card, compact && styles.compactCard, pressed && styles.pressed]}>
      <View style={styles.row}>
        <Text style={styles.code}>{incident.code}</Text>
        <View style={styles.badgeRow}>
          <StatusBadge priority={incident.priority} />
          <StatusBadge status={incident.status} />
        </View>
      </View>
      <Text style={styles.title}>{incident.title}</Text>
      {!compact && <Text style={styles.description} numberOfLines={2}>{incident.description}</Text>}
      <View style={styles.metaGrid}>
        <MetaItem label="Categoria" value={incident.category} />
        <MetaItem label="Fecha" value={incident.createdAt} />
        <MetaItem label="Prioridad" value={getPriorityLabel(incident.priority)} />
        {showCitizen ? <MetaItem label="Ciudadano" value={incident.citizenName} /> : null}
        <MetaItem label="Departamento" value={incident.department} />
      </View>
      {!compact && <Text style={styles.location}>{incident.location}</Text>}
      {!compact && (
        <>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${incident.progress}%` }]} />
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.date}>Actualizado: {incident.updatedAt}</Text>
            <Text style={styles.department}>{incident.department}</Text>
          </View>
        </>
      )}
      {hasActions ? (
        <View style={styles.actionsRow}>
          {actions.map((action) => (
            <Pressable key={action.label} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]} onPress={action.onPress}>
              <Text style={styles.actionText}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : onPress ? (
        <Text style={styles.openLabel}>Abrir reporte</Text>
      ) : null}
    </Pressable>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  code: { color: colors.muted, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.xs, flex: 1 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  description: { color: colors.muted, lineHeight: 20 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metaItem: { minWidth: 116, flexGrow: 1, flexBasis: 116 },
  metaLabel: { color: colors.secondary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  metaValue: { color: colors.text, fontSize: 13, fontWeight: '600', marginTop: 2 },
  location: { color: colors.muted },
  progressTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.softGreen, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.accent },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  date: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  department: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  compactCard: { padding: spacing.md },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  actionButton: { borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  actionText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  openLabel: { color: colors.primary, fontSize: 13, fontWeight: '800', textAlign: 'right' }
});
