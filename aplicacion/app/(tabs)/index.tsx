import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
  pulse: { value: string; label: string; note: string };
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
    activity: 'Tus reportes recientes',
    pulse: { value: '60%', label: 'de tus reportes resueltos', note: 'Tu participación ayuda a mejorar Zacapa' }
  },
  admin: {
    title: 'Control general de incidencias', copy: 'Supervisa todos los departamentos, prioridades y responsables.',
    stats: [['Sin asignar', '3', 'alert-circle-outline'], ['En atención', '8', 'construct-outline'], ['Cerrados hoy', '5', 'checkmark-circle-outline']].map(([label, value, icon]) => ({ label, value, icon: icon as keyof typeof Ionicons.glyphMap })),
    actions: [
      { title: 'Gestionar reportes', copy: 'Todos los departamentos', icon: 'file-tray-full-outline', route: '/reports' },
      { title: 'Seguimiento general', copy: 'Procesos y responsables', icon: 'git-branch-outline', route: '/tracking' },
      { title: 'Administración', copy: 'Usuarios, áreas y métricas', icon: 'options-outline', route: '/admin-menu' }
    ], activity: 'Actividad de todos los departamentos',
    pulse: { value: '73%', label: 'de atención en curso', note: '5 departamentos operando hoy' }
  },
  superadmin: {
    title: 'Administración de la plataforma', copy: 'Consulta la operación completa y administra permisos y departamentos.',
    stats: [['Departamentos', '5', 'business-outline'], ['Usuarios activos', '18', 'people-outline'], ['Casos abiertos', '11', 'file-tray-full-outline']].map(([label, value, icon]) => ({ label, value, icon: icon as keyof typeof Ionicons.glyphMap })),
    actions: [
      { title: 'Reportes generales', copy: 'Vista completa del municipio', icon: 'document-text-outline', route: '/reports' },
      { title: 'Seguimiento', copy: 'Audita todos los procesos', icon: 'trail-sign-outline', route: '/tracking' },
      { title: 'Configuración', copy: 'Roles, áreas y accesos', icon: 'shield-checkmark-outline', route: '/admin-menu' }
    ], activity: 'Actividad general',
    pulse: { value: '94%', label: 'de servicios disponibles', note: 'Operación municipal estable' }
  },
  maintenance: {
    title: 'Trabajo asignado para hoy', copy: 'Atiende únicamente las órdenes de Agua potable asignadas a tu equipo.',
    stats: [['Pendientes', '3', 'time-outline'], ['En atención', '2', 'construct-outline'], ['Completadas', '4', 'checkmark-circle-outline']].map(([label, value, icon]) => ({ label, value, icon: icon as keyof typeof Ionicons.glyphMap })),
    actions: [
      { title: 'Mis asignaciones', copy: 'Órdenes del departamento', icon: 'clipboard-outline', route: '/reports' },
      { title: 'Actualizar avances', copy: 'Estados y evidencias', icon: 'camera-outline', route: '/tracking' },
      { title: 'Herramientas', copy: 'Funciones de campo', icon: 'build-outline', route: '/admin-menu' }
    ], activity: 'Asignaciones recientes',
    pulse: { value: '44%', label: 'de la jornada completada', note: '2 órdenes requieren seguimiento' }
  },
  employee: {
    title: 'Bandeja del departamento', copy: 'Revisa y canaliza únicamente los reportes correspondientes a Agua potable.',
    stats: [['Por revisar', '4', 'eye-outline'], ['Validados', '6', 'checkmark-done-outline'], ['Canalizados', '3', 'git-branch-outline']].map(([label, value, icon]) => ({ label, value, icon: icon as keyof typeof Ionicons.glyphMap })),
    actions: [
      { title: 'Bandeja de reportes', copy: 'Casos de Agua potable', icon: 'file-tray-full-outline', route: '/reports' },
      { title: 'Procesos', copy: 'Validación y canalización', icon: 'git-branch-outline', route: '/tracking' },
      { title: 'Herramientas', copy: 'Funciones departamentales', icon: 'apps-outline', route: '/admin-menu' }
    ], activity: 'Movimientos del departamento',
    pulse: { value: '76%', label: 'de casos canalizados', note: 'Agua potable opera con normalidad' }
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
          <View style={[styles.heroGlow, { backgroundColor: visual.accent }]} />
          <View style={styles.heroMain}>
            <View style={styles.heroIdentity}>
              <Image source={require('../../assets/images/zacapp-logo-dark.png')} style={styles.heroLogo} />
              <View>
                <Text style={[styles.eyebrow, { color: visual.accent }]}>{visual.eyebrow}{department ? ` · ${department.toUpperCase()}` : ''}</Text>
                <Text style={styles.heroBrand}>ZacApp</Text>
              </View>
            </View>
            <View style={styles.heroText}>
              <Text style={styles.heading}>{content.title}</Text>
              <Text style={styles.copy}>{content.copy}</Text>
            </View>
            {role === 'citizen' && <AppButton label="Nuevo reporte" icon="add-circle-outline" onPress={() => router.push('/report/new')} style={styles.primaryAction} />}
          </View>

          <View style={styles.pulseCard}>
            <View style={styles.pulseHeader}>
              <View style={[styles.liveDot, { backgroundColor: visual.accent }]} />
              <Text style={styles.pulseKicker}>PULSO DE ZACAPA</Text>
            </View>
            <Text style={[styles.pulseValue, { color: visual.accent }]}>{content.pulse.value}</Text>
            <Text style={styles.pulseLabel}>{content.pulse.label}</Text>
            <View style={styles.pulseDivider} />
            <Text style={styles.pulseNote}>{content.pulse.note}</Text>
          </View>
        </View>

        <View style={styles.contextStrip}>
          <View style={styles.contextItem}><Ionicons name="location-outline" size={17} color={visual.primary} /><Text style={styles.contextText}>Municipio de Zacapa</Text></View>
          <View style={styles.contextSeparator} />
          <View style={styles.contextItem}><Ionicons name="radio-outline" size={17} color={visual.primary} /><Text style={styles.contextText}>{department ?? visual.label}</Text></View>
          <View style={styles.contextSeparator} />
          <View style={styles.contextItem}><Ionicons name="shield-checkmark-outline" size={17} color={visual.primary} /><Text style={styles.contextText}>Sesión protegida</Text></View>
        </View>

        <View style={styles.statsGrid}>{content.stats.map((item, index) => (
          <View key={item.label} style={styles.stat}>
            <View style={[styles.statRail, { backgroundColor: index === 0 ? visual.accent : visual.primary }]} />
            <View style={styles.statBody}>
              <View style={[styles.statIcon, { backgroundColor: `${visual.accent}22` }]}><Ionicons name={item.icon} size={20} color={visual.primary} /></View>
              <Text style={[styles.statNumber, { color: visual.primary }]}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          </View>
        ))}</View>

        <View style={styles.sectionHeader}><View><Text style={styles.sectionKicker}>TU ESPACIO</Text><Text style={styles.sectionTitle}>Accesos principales</Text></View><Text style={[styles.sectionMeta, { color: visual.primary }]}>{visual.label}</Text></View>
        <View style={styles.actionsGrid}>{content.actions.map((item) => (
          <Pressable key={item.title} style={[styles.actionCard, isWide && styles.actionCardWide]} onPress={() => router.push(item.route)}>
            <View style={[styles.actionIcon, { backgroundColor: visual.primary }]}><Ionicons name={item.icon} size={22} color={colors.white} /></View>
            <View style={styles.actionText}><Text style={styles.actionTitle}>{item.title}</Text><Text style={styles.actionCopy}>{item.copy}</Text></View>
            <View style={[styles.actionArrow, { backgroundColor: `${visual.accent}22` }]}><Ionicons name="arrow-forward" size={16} color={visual.primary} /></View>
          </Pressable>
        ))}</View>

        <View style={styles.activityPanel}>
          <View style={styles.activityHeader}>
            <View><Text style={styles.sectionKicker}>MOVIMIENTO RECIENTE</Text><Text style={styles.sectionTitle}>{content.activity}</Text></View>
            <Pressable style={[styles.viewAll, { borderColor: visual.primary }]} onPress={() => router.push('/reports')}><Text style={[styles.sectionLink, { color: visual.primary }]}>Ver todos</Text><Ionicons name="arrow-forward" size={15} color={visual.primary} /></Pressable>
          </View>
          <View style={styles.incidentList}>{visibleIncidents.map((incident) => <IncidentCard key={incident.id} incident={incident} compact />)}</View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 }, page: { padding: spacing.md, paddingBottom: spacing.xxl }, pageWide: { padding: spacing.xl }, shell: { width: '100%', maxWidth: 1120, alignSelf: 'center', gap: spacing.lg },
  hero: { minHeight: 285, borderRadius: 30, padding: spacing.lg, gap: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', overflow: 'hidden' }, heroGlow: { position: 'absolute', width: 270, height: 270, borderRadius: 135, right: -105, top: -120, opacity: 0.16 }, heroMain: { flex: 1.7, minWidth: 280, justifyContent: 'space-between', gap: spacing.lg }, heroIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, heroLogo: { width: 46, height: 46, borderRadius: 14 }, heroBrand: { color: colors.white, fontSize: 17, fontWeight: '800', marginTop: 1 }, heroText: { flex: 1, justifyContent: 'center', gap: spacing.xs },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 }, heading: { color: colors.white, fontSize: 30, lineHeight: 35, fontWeight: '800', marginTop: spacing.xs, maxWidth: 590 }, copy: { color: '#E5EAE4', fontSize: 15, lineHeight: 22, marginTop: spacing.xs, maxWidth: 610 }, primaryAction: { minWidth: 180, alignSelf: 'flex-start', backgroundColor: colors.secondary },
  pulseCard: { flex: 0.75, minWidth: 230, borderRadius: radius.xl, padding: spacing.lg, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', justifyContent: 'center' }, pulseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, liveDot: { width: 8, height: 8, borderRadius: 4 }, pulseKicker: { color: '#DDE8D7', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, pulseValue: { fontSize: 42, lineHeight: 48, fontWeight: '900', marginTop: spacing.md }, pulseLabel: { color: colors.white, fontSize: 15, lineHeight: 20, fontWeight: '700' }, pulseDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: spacing.md }, pulseNote: { color: '#DDE8D7', fontSize: 12, lineHeight: 18 },
  contextStrip: { minHeight: 52, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }, contextItem: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, contextText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, contextSeparator: { width: 1, height: 22, backgroundColor: colors.border },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, stat: { flexGrow: 1, flexBasis: 180, minHeight: 105, backgroundColor: colors.white, borderRadius: radius.lg, flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: colors.border }, statRail: { width: 5 }, statBody: { flex: 1, padding: spacing.md, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm }, statIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, statNumber: { fontSize: 25, fontWeight: '900' }, statLabel: { width: '100%', color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: spacing.xs },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.md }, sectionKicker: { color: colors.secondary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 3 }, sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800' }, sectionMeta: { fontSize: 12, fontWeight: '800' }, sectionLink: { fontSize: 13, fontWeight: '800' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, actionCard: { flexBasis: '100%', minHeight: 82, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, actionCardWide: { flexBasis: 260, flexGrow: 1 }, actionIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, actionText: { flex: 1 }, actionTitle: { color: colors.text, fontSize: 15, fontWeight: '800' }, actionCopy: { color: colors.muted, fontSize: 13, marginTop: 3 }, actionArrow: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  activityPanel: { backgroundColor: 'rgba(255,255,255,0.58)', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md }, activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }, viewAll: { minHeight: 36, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, incidentList: { gap: spacing.sm }
});
