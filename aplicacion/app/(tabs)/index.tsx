import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { IncidentCard } from '@/components/IncidentCard';
import { mockIncidents } from '@/data/mockIncidents';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';

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
  { title: 'Servicios', copy: 'Explorar recursos y atención municipal', icon: 'apps-outline', route: '/services' },
  { title: 'Perfil', copy: 'Revisar datos del ciudadano', icon: 'person-outline', route: '/profile' }
] as const;

const adminActions = [
  { title: 'Gestionar reportes', copy: 'Revisar incidencias ciudadanas', icon: 'document-text-outline', route: '/reports' },
  { title: 'Seguimiento', copy: 'Controlar procesos y responsables', icon: 'trail-sign-outline', route: '/tracking' },
  { title: 'Funciones', copy: 'Abrir herramientas administrativas', icon: 'menu-outline', route: '/admin-menu' },
  { title: 'Perfil', copy: 'Revisar la sesión administrativa', icon: 'person-outline', route: '/profile' }
] as const;

const maintenanceActions = [
  { title: 'Asignar tareas', copy: 'Enviar cada incidente al grupo o empleado correcto', icon: 'git-branch-outline', route: '/reports' },
  { title: 'Filtros', copy: 'Buscar pendientes, en proceso y resueltos', icon: 'funnel-outline', route: '/tracking' },
  { title: 'Perfil', copy: 'Revisar cuenta y departamento asignado', icon: 'person-outline', route: '/profile' }
] as const;

const maintenanceEmployeeActions = [
  { title: 'Tareas recibidas', copy: 'Consultar incidentes asignados a tu usuario', icon: 'clipboard-outline', route: '/reports' },
  { title: 'Actualizar avance', copy: 'Revisar etapas y estado de atención', icon: 'trail-sign-outline', route: '/tracking' },
  { title: 'Perfil', copy: 'Revisar cuenta y departamento asignado', icon: 'person-outline', route: '/profile' }
] as const;

const maintenanceSummary = [
  { label: 'Asignaciones recibidas', value: '6', icon: 'clipboard-outline' },
  { label: 'En atención', value: '2', icon: 'construct-outline' },
  { label: 'Completadas', value: '3', icon: 'checkmark-circle-outline' },
  { label: 'Pendientes', value: '1', icon: 'time-outline' }
] as const;

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const { role, department, departmentLabel } = useSession();
  const isAdmin = role === 'admin';
  const isMaintenance = role === 'maintenance_manager' || role === 'maintenance_employee';
  const isMaintenanceManager = role === 'maintenance_manager';
  const isMaintenanceEmployee = role === 'maintenance_employee';
  const isStaff = isAdmin || isMaintenance;
  const visibleActions = isAdmin ? adminActions : isMaintenanceManager ? maintenanceActions : isMaintenanceEmployee ? maintenanceEmployeeActions : actions;
  const visibleSummary = isMaintenance ? maintenanceSummary : summary;
  const visibleIncidents = isMaintenance ? mockIncidents.filter((incident) => incident.category === department) : mockIncidents;
  const areaName = departmentLabel ?? department ?? 'departamento asignado';

  return (
    <ScrollView style={[styles.scroll, isStaff && styles.adminScroll]} contentContainerStyle={[styles.page, isWide && styles.pageWide]}>
      <View style={styles.shell}>
        <View style={styles.main}>
          <View style={[styles.header, isAdmin && styles.adminHeader, isMaintenance && styles.maintenanceHeader]}>
            <View style={styles.headerText}>
              <Text style={[styles.eyebrow, isStaff && styles.adminEyebrow, isMaintenance && styles.maintenanceEyebrow]}>{isAdmin ? 'ADMINISTRACIÓN' : isMaintenanceManager ? 'MANTENIMIENTO · ENCARGADO' : isMaintenanceEmployee ? 'MANTENIMIENTO · EMPLEADO' : 'BIENVENIDO'}</Text>
              <Text style={styles.heading}>{isAdmin ? 'Panel administrativo' : isMaintenance ? `Panel de ${areaName}` : 'Dashboard ZacApp'}</Text>
              <Text style={styles.copy}>{isAdmin ? 'Gestión general de reportes, mantenimiento, usuarios, áreas y funciones del sistema.' : isMaintenanceManager ? 'Incidencias recibidas por tu departamento, listas para asignar a grupos o empleados y dar seguimiento.' : isMaintenanceEmployee ? 'Tareas asignadas a tu usuario para revisar y actualizar avances, sin funciones de asignación.' : 'Resumen visual de reportes comunitarios y accesos principales.'}</Text>
            </View>
            {!isStaff && <AppButton label="Nuevo reporte" icon="add-circle-outline" onPress={() => router.push('/report/new')} style={isWide ? styles.headerButton : undefined} />}
          </View>

          <View style={styles.statsGrid}>
            {visibleSummary.map((item) => (
              <View key={item.label} style={[styles.stat, isWide && styles.statWide]}>
                <View style={[styles.statIcon, isStaff && styles.adminIcon, isMaintenance && styles.maintenanceIcon]}><Ionicons name={item.icon} size={22} color={isMaintenance ? '#0F4C5C' : isAdmin ? '#A66A00' : colors.primary} /></View>
                <Text style={styles.statNumber}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Accesos rápidos</Text>
            <Text style={styles.sectionMeta}>{isMaintenance ? areaName : 'Resumen general'}</Text>
          </View>
          <View style={styles.actionsGrid}>
            {visibleActions.map((item) => (
              <Pressable key={item.title} style={[styles.actionCard, isWide && styles.actionCardWide]} onPress={() => router.push(item.route)}>
                <View style={[styles.actionIcon, isStaff && styles.adminIcon, isMaintenance && styles.maintenanceIcon]}><Ionicons name={item.icon} size={23} color={isMaintenance ? '#0F4C5C' : isAdmin ? '#A66A00' : colors.primary} /></View>
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
            {visibleIncidents.slice(0, 3).map((incident) => <IncidentCard key={incident.id} incident={incident} />)}
            {visibleIncidents.length === 0 && (
              <View style={styles.emptyCard}>
                <Ionicons name="checkmark-circle-outline" size={24} color={colors.secondary} />
                <Text style={styles.emptyTitle}>Sin incidentes asignados</Text>
                <Text style={styles.emptyCopy}>Cuando administración derive un caso a {areaName}, aparecerá en este panel.</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  adminScroll: { backgroundColor: '#EEF2F7' },
  page: { padding: spacing.lg, backgroundColor: colors.background },
  pageWide: { padding: spacing.xl },
  shell: { width: '100%', maxWidth: 1080, alignSelf: 'center' },
  main: { flex: 1, gap: spacing.lg },
  header: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.lg },
  adminHeader: { backgroundColor: '#14243A' },
  maintenanceHeader: { backgroundColor: '#0F4C5C' },
  headerText: { gap: spacing.xs },
  headerButton: { alignSelf: 'flex-start', minWidth: 190 },
  eyebrow: { color: colors.secondary, fontWeight: '800', letterSpacing: 1.5 },
  adminEyebrow: { color: '#E7B04B' },
  maintenanceEyebrow: { color: '#7DD3CF' },
  heading: { color: colors.white, fontSize: 30, fontWeight: '800', marginTop: spacing.xs },
  copy: { color: '#DDE8D7', fontSize: 16, lineHeight: 23, marginTop: spacing.sm, maxWidth: 620 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { flexGrow: 1, flexBasis: 145, backgroundColor: colors.white, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
  statWide: { flexBasis: 180 },
  statIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  adminIcon: { backgroundColor: '#FFF0CF' },
  maintenanceIcon: { backgroundColor: '#DDF6F4' },
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
  incidentList: { gap: spacing.md },
  emptyCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.xs, alignItems: 'flex-start' },
  emptyTitle: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  emptyCopy: { color: colors.muted, lineHeight: 20 }
});
