import { StyleSheet, Text, View } from 'react-native';
import { Incident } from '@/types/domain';
import { colors, radius, spacing } from '@/theme/tokens';

export function IncidentCard({ incident }: { incident: Incident }) {
  return <View style={styles.card}><View style={styles.row}><Text style={styles.code}>{incident.code}</Text><View style={styles.badge}><Text style={styles.badgeText}>{incident.status}</Text></View></View><Text style={styles.title}>{incident.title}</Text><Text style={styles.meta}>{incident.category} · {incident.location}</Text><Text style={styles.date}>Actualizado: {incident.updatedAt}</Text></View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderLeftWidth: 4, borderLeftColor: colors.accent }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, code: { color: colors.muted, fontWeight: '700' }, badge: { backgroundColor: '#EAF2E6', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }, badgeText: { color: colors.primary, fontSize: 12, fontWeight: '800' }, title: { color: colors.text, fontSize: 17, fontWeight: '700' }, meta: { color: colors.muted }, date: { color: colors.secondary, fontSize: 12 } });
