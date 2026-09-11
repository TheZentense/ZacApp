import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { IncidentCard } from '@/components/IncidentCard';
import { mockIncidents } from '@/data/mockIncidents';
import { colors, radius, spacing } from '@/theme/tokens';

const summary = [
  { label: 'Reportes registrados', value: '24', icon: 'file-tray-full-outline' },
  { label: 'En proceso', value: '8', icon: 'construct-outline' },
  { label: 'Resueltos', value: '13', icon: 'checkmark-circle-outline' },
  { label: 'Pendientes', value: '3', icon: 'time-outline' }
] as const;

const actions = [
  { title: 'Nuevo reporte', copy: 'Registrar una incidencia comunitaria', icon: 'add-circle-outline', route: '/report/new' },
  { title: 'Reportes', copy: 'Consultar reportes registrados', icon: 'document-text-outline', route: '/reports' },
  { title: 'Seguimiento', copy: 'Ver trazabilidad y responsables', icon: 'trail-sign-outline', route: '/tracking' },
  { title: 'Perfil', copy: 'Revisar datos del ciudadano', icon: 'person-outline', route: '/profile' }
] as const;

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, isWide && styles.pageWide]}>
      <View style={[styles.shell, isWide && styles.shellWide]}>
        {isWide && (
          <View style={styles.sidebar}>
            <View style={styles.sidebarBrand}>
              <View style={styles.sidebarLogo}><Ionicons name="leaf-outline" size={24} color={colors.white} /></View>
              <View>
                <Text style={styles.sidebarTitle}>ZacApp</Text>
                <Text style={styles.sidebarSubtitle}>Panel ciudadano</Text>
              </View>
            </View>
            {actions.map((item) => (
              <Pressable key={item.title} style={styles.navItem} onPress={() => router.push(item.route)}>
                <Ionicons name={item.icon} size={19} color={colors.primary} />
                <Text style={styles.navLabel}>{item.title}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.main}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>BIENVENIDO</Text>
              <Text style={styles.heading}>Dashboard ZacApp</Text>
              <Text style={styles.copy}>Resumen visual de reportes comunitarios y accesos principales.</Text>
            </View>
            <AppButton label="Nuevo reporte" icon="add-circle-outline" onPress={() => router.push('/report/new')} style={isWide ? styles.headerButton : undefined} />
          </View>

          <View style={styles.statsGrid}>
            {summary.map((item) => (
              <View key={item.label} style={[styles.stat, isWide && styles.statWide]}>
                <View style={styles.statIcon}><Ionicons name={item.icon} size={22} color={colors.primary} /></View>
                <Text style={styles.statNumber}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Accesos rápidos</Text>
            <Text style={styles.sectionMeta}>Datos simulados</Text>
          </View>
          <View style={styles.actionsGrid}>
            {actions.map((item) => (
              <Pressable key={item.title} style={[styles.actionCard, isWide && styles.actionCardWide]} onPress={() => router.push(item.route)}>
                <View style={styles.actionIcon}><Ionicons name={item.icon} size={23} color={colors.primary} /></View>
                <View style={styles.actionText}>
                  <Text style={styles.actionTitle}>{item.title}</Text>
                  <Text style={styles.actionCopy}>{item.copy}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </Pressable>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Actividad reciente</Text>
            <Text style={styles.sectionMeta}>Últimos movimientos</Text>
          </View>
          <View style={styles.incidentList}>
            {mockIncidents.slice(0, 3).map((incident) => <IncidentCard key={incident.id} incident={incident} />)}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { padding: spacing.lg, backgroundColor: colors.background },
  pageWide: { padding: spacing.xl },
  shell: { width: '100%', maxWidth: 1180, alignSelf: 'center' },
  shellWide: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  sidebar: { width: 250, backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  sidebarBrand: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', paddingBottom: spacing.lg, marginBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  sidebarLogo: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sidebarTitle: { color: colors.primary, fontSize: 19, fontWeight: '800' },
  sidebarSubtitle: { color: colors.muted, fontSize: 12 },
  navItem: { minHeight: 46, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface },
  navLabel: { color: colors.primary, fontWeight: '700' },
  main: { flex: 1, gap: spacing.lg },
  header: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.lg },
  headerText: { gap: spacing.xs },
  headerButton: { alignSelf: 'flex-start', minWidth: 190 },
  eyebrow: { color: colors.secondary, fontWeight: '800', letterSpacing: 1.5 },
  heading: { color: colors.white, fontSize: 30, fontWeight: '800', marginTop: spacing.xs },
  copy: { color: '#DDE8D7', fontSize: 16, lineHeight: 23, marginTop: spacing.sm, maxWidth: 620 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { flexGrow: 1, flexBasis: 145, backgroundColor: colors.white, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
  statWide: { flexBasis: 180 },
  statIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  statNumber: { color: colors.primary, fontSize: 26, fontWeight: '800' },
  statLabel: { color: colors.muted },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
  sectionMeta: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  actionCard: { flexBasis: '100%', backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actionCardWide: { flexBasis: 260, flexGrow: 1 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1 },
  actionTitle: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  actionCopy: { color: colors.muted, marginTop: spacing.xs },
  incidentList: { gap: spacing.md }
});
