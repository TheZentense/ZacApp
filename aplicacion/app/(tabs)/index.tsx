import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { IncidentCard } from '@/components/IncidentCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState, LoadingState } from '@/components/DataState';
import { useSession, UserRole } from '@/context/SessionContext';
import { useReports } from '@/hooks/useReports';
import { colors, radius, spacing } from '@/theme/tokens';
import { roleVisuals } from '@/theme/roles';
import type { Incident } from '@/types/domain';
import { reportReadScopeFor, workflowPermissionsFor } from '@/services/sessionPolicy';

type Route = '/reports' | '/tracking' | '/admin-menu' | '/profile';
type Dashboard = {
  title: string;
  copy: string;

  actions: { title: string; copy: string; icon: keyof typeof Ionicons.glyphMap; route: Route }[];
  activity: string;

};

const dashboards: Record<UserRole, Dashboard> = {
  citizen: {
    title: 'Tu espacio ciudadano',
    copy: 'Reporta una incidencia y consulta su avance.',
    actions: [
      { title: 'Mis reportes', copy: 'Consulta tus solicitudes', icon: 'document-text-outline', route: '/reports' },
      { title: 'Seguimiento', copy: 'Revisa avances y estados', icon: 'trail-sign-outline', route: '/tracking' },
      { title: 'Mi perfil', copy: 'Datos y preferencias', icon: 'person-outline', route: '/profile' }
    ],
    activity: 'Tus reportes recientes',
  },
  admin: {
    title: 'Control general de incidencias', copy: 'Supervisa todos los departamentos, prioridades y responsables.',
    actions: [
      { title: 'Gestionar reportes', copy: 'Todos los departamentos', icon: 'file-tray-full-outline', route: '/reports' },
      { title: 'Seguimiento general', copy: 'Procesos y responsables', icon: 'git-branch-outline', route: '/tracking' },
      { title: 'Administración', copy: 'Usuarios, áreas y métricas', icon: 'options-outline', route: '/admin-menu' }
    ], activity: 'Actividad de todos los departamentos',
  },
  superadmin: {
    title: 'Panel general', copy: 'Reportes, departamentos y seguimiento en un solo lugar.',
    actions: [
      { title: 'Reportes generales', copy: 'Vista completa del municipio', icon: 'document-text-outline', route: '/reports' },
      { title: 'Seguimiento', copy: 'Consulta el historial de los reportes', icon: 'trail-sign-outline', route: '/tracking' },
      { title: 'Configuración', copy: 'Roles, áreas y accesos', icon: 'shield-checkmark-outline', route: '/admin-menu' }
    ], activity: 'Actividad general',
  },
  maintenance: {
    title: 'Mi departamento', copy: 'Consulta los reportes canalizados a tu departamento.',
    actions: [
      { title: 'Reportes del departamento', copy: 'Pendientes y responsables registrados', icon: 'clipboard-outline', route: '/reports' },
      { title: 'Seguimiento de trabajos', copy: 'Observaciones y evidencias disponibles', icon: 'camera-outline', route: '/tracking' },
      { title: 'Herramientas', copy: 'Funciones de campo', icon: 'build-outline', route: '/admin-menu' }
    ], activity: 'Reportes recientes del departamento',
  },
  employee: {
    title: 'Mis tareas', copy: 'La consulta personal está pendiente de habilitación segura.',
    actions: [
      { title: 'Mis tareas', copy: 'Consulta personal pendiente', icon: 'file-tray-full-outline', route: '/reports' },
      { title: 'Seguimiento personal', copy: 'Observaciones e historial autorizado', icon: 'git-branch-outline', route: '/tracking' },
      { title: 'Herramientas', copy: 'Funciones del empleado operativo', icon: 'apps-outline', route: '/admin-menu' }
    ], activity: 'Movimientos del departamento',
  }
};

function buildReportStats(role: UserRole, incidents: Incident[]): { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }[] {
  const count = (...statuses: Incident['status'][]) => incidents.filter((incident) => statuses.includes(incident.status)).length.toString();
  const closed = count('CERRADO');
  const active = count('REGISTRADO', 'EN_REVISION', 'VALIDADO', 'ASIGNADO', 'EN_ATENCION', 'POR_VERIFICAR');

  if (role === 'citizen') return [
    { label: 'En proceso', value: active, icon: 'construct-outline' },
    { label: 'Resueltos', value: closed, icon: 'checkmark-circle-outline' },
    { label: 'Total enviados', value: incidents.length.toString(), icon: 'document-text-outline' }
  ];
  if (role === 'maintenance') return [
    { label: 'Pendientes', value: count('ASIGNADO'), icon: 'time-outline' },
    { label: 'En atención', value: count('EN_ATENCION', 'POR_VERIFICAR'), icon: 'construct-outline' },
    { label: 'Completadas', value: closed, icon: 'checkmark-circle-outline' }
  ];
  if (role === 'employee') return [
    { label: 'Por revisar', value: count('REGISTRADO', 'EN_REVISION'), icon: 'eye-outline' },
    { label: 'Validados', value: count('VALIDADO'), icon: 'checkmark-done-outline' },
    { label: 'Canalizados', value: count('ASIGNADO', 'EN_ATENCION', 'POR_VERIFICAR', 'CERRADO'), icon: 'git-branch-outline' }
  ];
  if (role === 'superadmin') return [
    { label: 'Reportes totales', value: incidents.length.toString(), icon: 'documents-outline' },
    { label: 'En proceso', value: active, icon: 'pulse-outline' },
    { label: 'Cerrados', value: closed, icon: 'checkmark-circle-outline' }
  ];
  return [
    { label: 'Sin asignar', value: count('REGISTRADO', 'EN_REVISION', 'VALIDADO'), icon: 'alert-circle-outline' },
    { label: 'En atención', value: count('ASIGNADO', 'EN_ATENCION', 'POR_VERIFICAR'), icon: 'construct-outline' },
    { label: 'Cerrados', value: closed, icon: 'checkmark-circle-outline' }
  ];
}

function buildReportPulse(role: UserRole, incidents: Incident[]) {
  const closed = incidents.filter((incident) => incident.status === 'CERRADO').length;
  const value = incidents.length ? Math.round((closed / incidents.length) * 100) : 0;
  return {
    value: value + '%',
    label: role === 'citizen' ? 'de tus reportes resueltos' : 'de reportes visibles cerrados',
    note: incidents.length ? closed + ' de ' + incidents.length + ' reportes cerrados' : 'El indicador aparecerá conforme se registren casos'
  };
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { role, department, databaseRole } = useSession();
  const permissions = workflowPermissionsFor(databaseRole);
  const content = dashboards[role];
  const visual = roleVisuals[role];
  const isWide = width >= 900;
  const isCompact = width < 600;
  const { incidents, isLoading, error, reload, isPreview } = useReports();
  const pending = reportReadScopeFor(databaseRole) === 'pending' && (!isPreview || permissions.operator);
  const dataUnavailable = isLoading || Boolean(error) || isPreview;
  const visibleIncidents = isPreview ? [] : incidents.slice(0, 2);
  const reportStats = useMemo(() => buildReportStats(role, incidents), [incidents, role]);
  const reportPulse = useMemo(() => buildReportPulse(role, incidents), [incidents, role]);
  const departmentWorkload = useMemo(() => {
    const totals = new Map<string, number>();
    incidents.filter((item) => item.status !== 'CERRADO' && item.status !== 'RECHAZADO').forEach((item) => totals.set(item.department ?? 'Sin área asignada', (totals.get(item.department ?? 'Sin área asignada') ?? 0) + 1));
    return Array.from(totals, ([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [incidents]);
  const maximumDepartmentWorkload = Math.max(...departmentWorkload.map((item) => item.total), 1);
  const priorityIncident = useMemo(() => incidents
    .filter((item) => item.status !== 'CERRADO' && item.status !== 'RECHAZADO')[0], [incidents]);
  const dashboardCopy = (role === 'maintenance' || role === 'employee') && department
    ? role === 'maintenance' ? `Reportes canalizados a ${department}.` : 'Consulta personal pendiente de habilitación.'
    : content.copy;

  if (pending) return <ScrollView style={[styles.scroll, { backgroundColor: visual.background }]} contentContainerStyle={styles.page}><View style={[styles.hero, styles.heroCompact, { backgroundColor: visual.primary }]}><Text style={styles.heading}>{permissions.operator ? 'Mis tareas' : 'Consulta pendiente'}</Text><Text style={styles.copy}>{permissions.operator ? 'La consulta de tareas estará disponible cuando se habiliten las asignaciones.' : 'Esta consulta estará disponible en una próxima etapa.'}</Text></View><AppButton label="Mis tareas · pendiente" onPress={() => router.push('/reports')} /><AppButton label="Mi perfil" variant="secondary" onPress={() => router.push('/profile')} /></ScrollView>;

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: visual.background }]} contentContainerStyle={[styles.page, isWide && styles.pageWide]}>
      <View style={styles.shell}>
        <View style={[styles.hero, isCompact && styles.heroCompact, { backgroundColor: visual.primary }]}>
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
              <Text style={styles.copy}>{dashboardCopy}</Text>
            </View>
            {role === 'citizen' && <AppButton label="Nuevo reporte" icon="add-circle-outline" onPress={() => router.push('/report/new')} style={styles.primaryAction} />}
          </View>

          <View style={styles.pulseCard}>
            <View style={styles.pulseHeader}>
              <View style={[styles.liveDot, { backgroundColor: visual.accent }]} />
              <Text style={styles.pulseKicker}>PULSO DE ZACAPA</Text>
            </View>
            <Text style={[styles.pulseValue, { color: visual.accent }]}>{dataUnavailable ? '—' : reportPulse.value}</Text>
            <Text style={styles.pulseLabel}>{reportPulse.label}</Text>
            <View style={styles.pulseDivider} />
            <Text style={styles.pulseNote}>{isLoading ? 'Consultando reportes...' : error || isPreview ? 'El indicador no está disponible' : reportPulse.note}</Text>
          </View>
        </View>

        <View style={styles.contextStrip}>
          <View style={styles.contextItem}><Ionicons name="location-outline" size={17} color={visual.primary} /><Text style={styles.contextText}>Municipio de Zacapa</Text></View>
          <View style={styles.contextSeparator} />
          <View style={styles.contextItem}><Ionicons name="radio-outline" size={17} color={visual.primary} /><Text style={styles.contextText}>{department ?? visual.label}</Text></View>
          <View style={styles.contextSeparator} />
          <View style={styles.contextItem}><Ionicons name="shield-checkmark-outline" size={17} color={visual.primary} /><Text style={styles.contextText}>Sesión protegida</Text></View>
        </View>

        <View style={styles.statsGrid}>{reportStats.map((item, index) => (
          <View key={item.label} style={styles.stat}>
            <View style={[styles.statRail, { backgroundColor: index === 0 ? visual.accent : visual.primary }]} />
            <View style={styles.statBody}>
              <View style={[styles.statIcon, { backgroundColor: `${visual.accent}22` }]}><Ionicons name={item.icon} size={20} color={visual.primary} /></View>
              <Text accessibilityLabel={item.label + ': ' + (dataUnavailable ? 'no disponible' : item.value)} style={[styles.statNumber, { color: visual.primary }]}>{dataUnavailable ? '—' : item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          </View>
        ))}</View>

        {permissions.generalReports && <View style={styles.operationsPanel}>
          <View style={styles.operationsHeader}><View><Text style={styles.sectionKicker}>DISTRIBUCIÓN OPERATIVA</Text><Text style={styles.sectionTitle}>Carga activa por departamento</Text></View><Pressable style={[styles.viewAll, { borderColor: visual.primary }]} onPress={() => router.push('/reports')}><Text style={[styles.sectionLink, { color: visual.primary }]}>Administrar</Text><Ionicons name="arrow-forward" size={15} color={visual.primary} /></Pressable></View>
          {isLoading ? <LoadingState label="Consultando carga departamental..." /> : error || isPreview ? <EmptyState title="Carga no disponible" description="No pudimos consultar los reportes. Intenta actualizar la información." /> : departmentWorkload.length ? <View style={styles.workloadList}>{departmentWorkload.map((item) => <View key={item.name} style={styles.workloadRow}><View style={styles.workloadMeta}><Text style={styles.workloadName}>{item.name}</Text><Text style={[styles.workloadValue, { color: visual.primary }]}>{item.total}</Text></View><View style={styles.workloadTrack}><View style={[styles.workloadFill, { width: `${Math.max(8, Math.round((item.total / maximumDepartmentWorkload) * 100))}%`, backgroundColor: visual.accent }]} /></View></View>)}</View> : <EmptyState title="Sin carga activa" description="No existen casos abiertos distribuidos entre los departamentos." />}
        </View>}

        {!dataUnavailable && permissions.departmentReports && priorityIncident && <Pressable style={[styles.priorityPanel, { borderColor: visual.accent }]} onPress={() => router.push('/reports')}>
          <View style={[styles.priorityIcon, { backgroundColor: visual.primary }]}><Ionicons name="navigate-outline" size={23} color={colors.white} /></View>
          <View style={styles.priorityBody}><Text style={[styles.sectionKicker, { color: visual.primary }]}>REPORTE ABIERTO DEL DEPARTAMENTO</Text><Text style={styles.priorityTitle}>{priorityIncident.title}</Text><Text style={styles.priorityMeta}>{priorityIncident.code} · {priorityIncident.priority === undefined ? 'Prioridad no consultada' : priorityIncident.priority === null ? 'Prioridad no disponible' : `Prioridad ${priorityIncident.priority}`} · {priorityIncident.location}</Text></View>
          <Ionicons name="arrow-forward" size={20} color={visual.primary} />
        </Pressable>}

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
          <View style={styles.incidentList}>{isLoading ? <LoadingState label="Actualizando actividad..." /> : error ? <ErrorState description={error} onRetry={reload} /> : isPreview ? <EmptyState title="Consulta real no disponible" description="Los reportes se mostrarán cuando la consulta real esté disponible." /> : visibleIncidents.length ? visibleIncidents.map((incident) => <IncidentCard key={incident.id} incident={incident} compact />) : <EmptyState title="Aún no hay actividad" description={role === 'citizen' ? 'Tus reportes aparecerán aquí después de registrarlos.' : 'Los casos disponibles aparecerán en este espacio.'} />}</View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 }, page: { padding: spacing.md, paddingBottom: spacing.xxl }, pageWide: { padding: spacing.xl }, shell: { width: '100%', maxWidth: 1120, alignSelf: 'center', gap: spacing.lg },
  hero: { minHeight: 285, borderRadius: 30, padding: spacing.lg, gap: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', overflow: 'hidden' }, heroGlow: { position: 'absolute', width: 270, height: 270, borderRadius: 135, right: -105, top: -120, opacity: 0.16 }, heroCompact: { flexDirection: 'column' }, heroMain: { flex: 1.7, minWidth: 0, justifyContent: 'space-between', gap: spacing.lg }, heroIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, heroLogo: { width: 46, height: 46, borderRadius: 14 }, heroBrand: { color: colors.white, fontSize: 17, fontWeight: '800', marginTop: 1 }, heroText: { flex: 1, justifyContent: 'center', gap: spacing.xs },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 }, heading: { color: colors.white, fontSize: 27, lineHeight: 33, fontWeight: '800', marginTop: spacing.xs, maxWidth: 590 }, copy: { color: '#E5EAE4', fontSize: 15, lineHeight: 22, marginTop: spacing.xs, maxWidth: 610 }, primaryAction: { minWidth: 180, alignSelf: 'flex-start', backgroundColor: colors.secondary },
  pulseCard: { flex: 0.75, minWidth: 0, borderRadius: radius.xl, padding: spacing.lg, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', justifyContent: 'center' }, pulseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, liveDot: { width: 8, height: 8, borderRadius: 4 }, pulseKicker: { color: '#DDE8D7', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, pulseValue: { fontSize: 42, lineHeight: 48, fontWeight: '900', marginTop: spacing.md }, pulseLabel: { color: colors.white, fontSize: 15, lineHeight: 20, fontWeight: '700' }, pulseDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: spacing.md }, pulseNote: { color: '#DDE8D7', fontSize: 12, lineHeight: 18 },
  contextStrip: { minHeight: 52, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }, contextItem: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, contextText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, contextSeparator: { width: 1, height: 22, backgroundColor: colors.border },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, stat: { flexGrow: 1, flexBasis: 180, minHeight: 105, backgroundColor: colors.white, borderRadius: radius.lg, flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: colors.border }, statRail: { width: 5 }, statBody: { flex: 1, padding: spacing.md, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm }, statIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, statNumber: { fontSize: 25, fontWeight: '900' }, statLabel: { width: '100%', color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: spacing.xs },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }, sectionKicker: { color: colors.secondary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 3 }, sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800' }, sectionMeta: { flexShrink: 1, fontSize: 12, fontWeight: '800' }, sectionLink: { fontSize: 13, fontWeight: '800' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, actionCard: { flexBasis: '100%', minHeight: 82, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, actionCardWide: { flexBasis: 260, flexGrow: 1 }, actionIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, actionText: { flex: 1, minWidth: 0 }, actionTitle: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '800' }, actionCopy: { color: colors.muted, fontSize: 13, marginTop: 3 }, actionArrow: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  activityPanel: { backgroundColor: 'rgba(255,255,255,0.58)', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md }, activityHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }, viewAll: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, incidentList: { gap: spacing.sm }
  ,operationsPanel: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.lg }, operationsHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }, workloadList: { gap: spacing.md }, workloadRow: { gap: spacing.xs }, workloadMeta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }, workloadName: { color: colors.text, fontSize: 14, fontWeight: '800' }, workloadValue: { fontSize: 14, fontWeight: '900' }, workloadTrack: { height: 8, backgroundColor: colors.softGreen, borderRadius: radius.pill, overflow: 'hidden' }, workloadFill: { height: '100%', borderRadius: radius.pill }, priorityPanel: { minHeight: 96, backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, priorityIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, priorityBody: { flex: 1, gap: 3 }, priorityTitle: { color: colors.text, fontSize: 16, fontWeight: '800' }, priorityMeta: { color: colors.muted, fontSize: 12, lineHeight: 18 }
});
