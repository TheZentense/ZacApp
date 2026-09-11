import { ScrollView, StyleSheet, Text } from 'react-native';
import { IncidentCard } from '@/components/IncidentCard';
import { mockIncidents } from '@/data/mockIncidents';
import { colors, spacing } from '@/theme/tokens';

export default function ReportsScreen() {
  return <ScrollView contentContainerStyle={styles.page}><Text style={styles.title}>Mis reportes</Text><Text style={styles.copy}>Consulta el estado y la trazabilidad de tus incidencias.</Text>{mockIncidents.map((item) => <IncidentCard key={item.id} incident={item} />)}</ScrollView>;
}
const styles = StyleSheet.create({ page: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background }, title: { fontSize: 28, fontWeight: '800', color: colors.primary }, copy: { color: colors.muted, marginBottom: spacing.sm } });
