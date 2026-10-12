import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { IncidentCard } from '@/components/IncidentCard';
import { useSession, UserRole } from '@/context/SessionContext';
import { mockIncidents } from '@/data/mockIncidents';
import { colors, radius, spacing } from '@/theme/tokens';
import { roleVisuals } from '@/theme/roles';

type Route = '/reports' | '/tracking' | '/admin-menu' | '/profile';
type Dashboard = {
  title: string;
  copy: string;
  stats: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }[];
  actions: { title: string; copy: string; icon: keyof typeof Ionicons.glyphMap; route: Route }[];
  activity: string;
};

const dashboards: Record<UserRole, Dashboard> = {
  citizen: {
    title: 'Tus reportes, en un solo lugar',
    copy: 'Registra una incidencia y consulta únicamente el avance de los casos que has enviado.',
    stats: [['En proceso', '2', 'construct-outline'], ['Resueltos', '3', 'checkmark-circle-outline'], ['Total enviados', '5', 'document-text-outline']].map(([label, value, icon]) => ({ label, value, icon: icon as keyof typeof Ionicons.glyphMap })),
    actions: [
      { title: 'Mis reportes', copy: 'Consulta tus solicitudes', icon: 'document-text-outline', route: '/reports' },
      { title: 'Seguimiento', copy: 'Revisa avances y estados', icon: 'trail-sign-outline', route: '/tracking' },
      { title: 'Mi perfil', copy: 'Datos y preferencias', icon: 'person-outline', route: '/profile' }
    ],
    activity: 'Tus reportes recientes'
  },
  admin: {
    title: 'Control general de incidencias', copy: 'Supervisa todos los departamentos, prioridades y responsables.',
    stats: [['Sin asignar', '3', 'alert-circle-outline'], ['En atención', '8', 'construct-outline'], ['Cerrados hoy', '5', 'checkmark-circle-outline']].map(([label, value, icon]) => ({ label, value, icon: icon as keyof typeof Ionicons.glyphMap })),
    actions: [
      { title: 'Gestionar reportes', copy: 'Todos los departamentos', icon: 'file-tray-full-outline', route: '/reports' },
      { title: 'Seguimiento general', copy: 'Procesos y responsables', icon: 'git-branch-outline', route: '/tracking' },
      { title: 'Administración', copy: 'Usuarios, áreas y métricas', icon: 'options-outline', route: '/admin-menu' }
    ], activity: 'Actividad de todos los departamentos'
  },
  superadmin: {
    title: 'Administración de la plataforma', copy: 'Consulta la operación completa y administra permisos y departamentos.',
    stats: [['Departamentos', '5', 'business-outline'], ['Usuarios activos', '18', 'people-outline'], ['Casos abiertos', '11', 'file-tray-full-outline']].map(([label, value, icon]) => ({ label, value, icon: icon as keyof typeof Ionicons.glyphMap })),
    actions: [
      { title: 'Reportes generales', copy: 'Vista completa del municipio', icon: 'document-text-outline', route: '/reports' },
      { title: 'Seguimiento', copy: 'Audita todos los procesos', icon: 'trail-sign-outline', route: '/tracking' },
      { title: 'Configuración', copy: 'Roles, áreas y accesos', icon: 'shield-checkmark-outline', route: '/admin-menu' }
    ], activity: 'Actividad general'
  },
  maintenance: {
    title: 'Trabajo asignado para hoy', copy: 'Atiende únicamente las órdenes de Agua potable asignadas a tu equipo.',
    stats: [['Pendientes', '3', 'time-outline'], ['En atención', '2', 'construct-outline'], ['Completadas', '4', 'checkmark-circle-outline']].map(([label, value, icon]) => ({ label, value, icon: icon as keyof typeof Ionicons.glyphMap })),
    actions: [
      { title: 'Mis asignaciones', copy: 'Órdenes del departamento', icon: 'clipboard-outline', route: '/reports' },
      { title: 'Actualizar avances', copy: 'Estados y evidencias', icon: 'camera-outline', route: '/tracking' },
      { title: 'Herramientas', copy: 'Funciones de campo', icon: 'build-outline', route: '/admin-menu' }
    ], activity: 'Asignaciones recientes'
  },
  employee: {
    title: 'Bandeja del departamento', copy: 'Revisa y canaliza únicamente los reportes correspondientes a Agua potable.',
    stats: [['Por revisar', '4', 'eye-outline'], ['Validados', '6', 'checkmark-done-outline'], ['Canalizados', '3', 'git-branch-outline']].map(([label, value, icon]) => ({ label, value, icon: icon as keyof typeof Ionicons.glyphMap })),
    actions: [
      { title: 'Bandeja de reportes', copy: 'Casos de Agua potable', icon: 'file-tray-full-outline', route: '/reports' },
      { title: 'Procesos', copy: 'Validación y canalización', icon: 'git-branch-outline', route: '/tracking' },
      { title: 'Herramientas', copy: 'Funciones departamentales', icon: 'apps-outline', route: '/admin-menu' }
    ], activity: 'Movimientos del departamento'
  }
};

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { role, department } = useSession();
  const content = dashboards[role];
  const visual = roleVisuals[role];
  const isWide = width >= 900;
  const visibleIncidents = mockIncidents.filter((incident) => department ? incident.category === department : role === 'citizen' ? incident.id !== '1' : true).slice(0, 2);

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: visual.background }]} contentContainerStyle={[styles.page, isWide && styles.pageWide]}>
      <View style={styles.shell}>
        <View style={[styles.hero, { backgroundColor: visual.primary }]}>
          <View style={styles.heroText}>
            <Text style={[styles.eyebrow, { color: visual.accent }]}>{visual.eyebrow}{department ? ` · ${department.toUpperCase()}` : ''}</Text>
            <Text style={styles.heading}>{content.title}</Text>
            <Text style={styles.copy}>{content.copy}</Text>
          </View>
          {role === 'citizen' && <AppButton label="Nuevo reporte" icon="add-circle-outline" onPress={() => router.push('/report/new')} style={styles.primaryAction} />}
        </View>

        <View style={styles.statsGrid}>{content.stats.map((item) => (
          <View key={item.label} style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: `${visual.accent}22` }]}><Ionicons name={item.icon} size={20} color={visual.primary} /></View>
            <View><Text style={[styles.statNumber, { color: visual.primary }]}>{item.value}</Text><Text style={styles.statLabel}>{item.label}</Text></View>
          </View>
        ))}</View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Accesos principales</Text><Text style={[styles.sectionMeta, { color: visual.primary }]}>{visual.label}</Text></View>
        <View style={styles.actionsGrid}>{content.actions.map((item) => (
          <Pressable key={item.title} style={[styles.actionCard, isWide && styles.actionCardWide]} onPress={() => router.push(item.route)}>
            <View style={[styles.actionIcon, { backgroundColor: `${visual.accent}22` }]}><Ionicons name={item.icon} size={22} color={visual.primary} /></View>
            <View style={styles.actionText}><Text style={styles.actionTitle}>{item.title}</Text><Text style={styles.actionCopy}>{item.copy}</Text></View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}</View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{content.activity}</Text><Pressable onPress={() => router.push('/reports')}><Text style={[styles.sectionLink, { color: visual.primary }]}>Ver todos</Text></Pressable></View>
        <View style={styles.incidentList}>{visibleIncidents.map((incident) => <IncidentCard key={incident.id} incident={incident} compact />)}</View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 }, page: { padding: spacing.md, paddingBottom: spacing.xxl }, pageWide: { padding: spacing.xl }, shell: { width: '100%', maxWidth: 1120, alignSelf: 'center', gap: spacing.lg },
  hero: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }, heroText: { flex: 1, minWidth: 250, gap: spacing.xs },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.3 }, heading: { color: colors.white, fontSize: 26, fontWeight: '800', marginTop: spacing.xs }, copy: { color: '#E5EAE4', fontSize: 15, lineHeight: 21, marginTop: spacing.xs, maxWidth: 650 }, primaryAction: { minWidth: 180 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, stat: { flexGrow: 1, flexBasis: 180, minHeight: 82, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border }, statIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, statNumber: { fontSize: 22, fontWeight: '800' }, statLabel: { color: colors.muted, fontSize: 13, marginTop: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }, sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' }, sectionMeta: { fontSize: 12, fontWeight: '700' }, sectionLink: { fontSize: 13, fontWeight: '800' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, actionCard: { flexBasis: '100%', minHeight: 74, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, actionCardWide: { flexBasis: 260, flexGrow: 1 }, actionIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, actionText: { flex: 1 }, actionTitle: { color: colors.text, fontSize: 15, fontWeight: '800' }, actionCopy: { color: colors.muted, fontSize: 13, marginTop: 2 }, incidentList: { gap: spacing.sm }
});
