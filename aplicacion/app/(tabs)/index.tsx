import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { IncidentCard } from '@/components/IncidentCard';
import { mockIncidents } from '@/data/mockIncidents';
import { colors, spacing } from '@/theme/tokens';

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View>
        <Text style={styles.eyebrow}>BIENVENIDO</Text>
        <Text style={styles.heading}>Ayudemos a mejorar Zacapa</Text>
        <Text style={styles.copy}>Reporta un incidente y consulta su atención desde un solo lugar.</Text>
      </View>
      <AppButton label="Crear nuevo reporte" icon="add-circle-outline" onPress={() => router.push('/report/new')} />
      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.statNumber}>2</Text><Text style={styles.statLabel}>En seguimiento</Text></View>
        <View style={styles.stat}><Text style={styles.statNumber}>1</Text><Text style={styles.statLabel}>Resuelto</Text></View>
      </View>
      <Text style={styles.sectionTitle}>Actividad reciente</Text>
      {mockIncidents.slice(0, 2).map((incident) => <IncidentCard key={incident.id} incident={incident} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.background },
  eyebrow: { color: colors.secondary, fontWeight: '800', letterSpacing: 1.5 },
  heading: { color: colors.primary, fontSize: 28, fontWeight: '800', marginTop: spacing.xs },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, backgroundColor: colors.white, padding: spacing.lg, borderRadius: 16 },
  statNumber: { color: colors.primary, fontSize: 26, fontWeight: '800' },
  statLabel: { color: colors.muted },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '700' }
});
