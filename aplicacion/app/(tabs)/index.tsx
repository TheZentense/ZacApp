import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { AppButton } from '@/components/AppButton';
import { IncidentCard } from '@/components/IncidentCard';
import { SectionHeader } from '@/components/SectionHeader';
import { StatCard } from '@/components/StatCard';
import { useReports } from '@/context/ReportsContext';
import { mockIncidents } from '@/data/mockIncidents';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';

type IconName = ComponentProps<typeof Ionicons>['name'];

type QuickAction = {
  title: string;
  copy: string;
  icon: IconName;
  route: string;
};

const citizenActions: QuickAction[] = [
  { title: 'Nuevo reporte', copy: 'Registrar una incidencia', icon: 'add-circle-outline', route: '/report/new' },
  { title: 'Mis reportes', copy: 'Consultar mis casos', icon: 'document-text-outline', route: '/reports' },
  { title: 'Seguimiento', copy: 'Ver avance y responsable', icon: 'trail-sign-outline', route: '/tracking' },
  { title: 'Servicios', copy: 'Ver servicios ciudadanos', icon: 'apps-outline', route: '/services' },
  { title: 'Perfil', copy: 'Datos de contacto', icon: 'person-outline', route: '/profile' }
];

const adminActions: QuickAction[] = [
  { title: 'Reportes', copy: 'Ver incidencias registradas', icon: 'document-text-outline', route: '/reports' },
  { title: 'Usuarios', copy: 'Listado de cuentas demo', icon: 'people-outline', route: '/admin-menu' },
  { title: 'Departamentos', copy: 'Resumen por area', icon: 'business-outline', route: '/admin-menu' },
  { title: 'Asignaciones', copy: 'Reporte, area y estado', icon: 'git-branch-outline', route: '/admin-menu' },
  { title: 'Perfil', copy: 'Sesion administrativa', icon: 'person-outline', route: '/profile' }
];

const maintenanceActions: QuickAction[] = [
  { title: 'Mis asignaciones', copy: 'Trabajos de mi area', icon: 'clipboard-outline', route: '/reports' },
  { title: 'En proceso', copy: 'Casos activos', icon: 'construct-outline', route: '/reports' },
  { title: 'Historial', copy: 'Casos atendidos', icon: 'file-tray-full-outline', route: '/tracking' },
  { title: 'Perfil', copy: 'Datos del equipo', icon: 'person-outline', route: '/profile' }
];

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { role, department, email } = useSession();
  const { demoReports } = useReports();
  const isWide = width >= 900;
  const allIncidents = useMemo(() => [...demoReports, ...mockIncidents], [demoReports]);

  const visibleIncidents = useMemo(() => {
    if (role === 'admin') return allIncidents;
    if (role === 'maintenance') return allIncidents.filter((incident) => incident.department === department);
    return allIncidents.filter((incident) => incident.citizenEmail === email);
  }, [allIncidents, department, email, role]);

  const counts = useMemo(() => {
    const pending = visibleIncidents.filter((incident) => ['REGISTRADO', 'EN_REVISION', 'VALIDADO', 'ASIGNADO'].includes(incident.status)).length;
    const inProgress = visibleIncidents.filter((incident) => ['EN_ATENCION', 'POR_VERIFICAR'].includes(incident.status)).length;
    const resolved = visibleIncidents.filter((incident) => incident.status === 'CERRADO').length;
    return { pending, inProgress, resolved };
  }, [visibleIncidents]);

  const stats = role === 'maintenance'
    ? [
        { label: 'Asignados', value: visibleIncidents.length, icon: 'clipboard-outline' as IconName },
        { label: 'Pendientes', value: counts.pending, icon: 'time-outline' as IconName },
        { label: 'En proceso', value: counts.inProgress, icon: 'construct-outline' as IconName },
        { label: 'Atendidos', value: counts.resolved, icon: 'checkmark-circle-outline' as IconName }
      ]
    : [
        { label: role === 'admin' ? 'Total de reportes' : 'Mis reportes', value: visibleIncidents.length, icon: 'file-tray-full-outline' as IconName },
        { label: 'Pendientes', value: counts.pending, icon: 'time-outline' as IconName },
        { label: 'En proceso', value: counts.inProgress, icon: 'construct-outline' as IconName },
        { label: 'Resueltos', value: counts.resolved, icon: 'checkmark-circle-outline' as IconName }
      ];

  const actions = role === 'admin' ? adminActions : role === 'maintenance' ? maintenanceActions : citizenActions;
  const title = role === 'admin' ? 'Dashboard administrativo' : role === 'maintenance' ? `Inicio · ${department}` : 'Inicio ciudadano';
  const subtitle = role === 'admin'
    ? 'Resumen sencillo de reportes, usuarios, departamentos y asignaciones.'
    : role === 'maintenance'
      ? 'Vista de trabajos asignados al area actual. No se muestran reportes de otros departamentos.'
      : 'Accesos principales para registrar reportes y revisar su seguimiento.';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, isWide && styles.pageWide]}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>Modo demostracion</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.copy}>{subtitle}</Text>
          </View>
          {role === 'citizen' ? <AppButton label="Nuevo reporte" icon="add-circle-outline" onPress={() => router.push('/report/new')} style={styles.headerButton} /> : null}
        </View>

        <View style={styles.statsGrid}>
          {stats.map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} icon={item.icon} />
          ))}
        </View>

        <SectionHeader title="Accesos principales" meta={role === 'admin' ? 'Administracion' : role === 'maintenance' ? 'Mantenimiento' : 'Ciudadano'} />
        <View style={styles.actionsGrid}>
          {actions.map((item) => (
            <Pressable key={item.title} style={({ pressed }) => [styles.actionCard, isWide && styles.actionCardWide, pressed && styles.pressed]} onPress={() => router.push(item.route as never)}>
              <View style={styles.actionIcon}>
                <Ionicons name={item.icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>{item.title}</Text>
                <Text style={styles.actionCopy}>{item.copy}</Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        <SectionHeader title={role === 'maintenance' ? 'Mis asignaciones recientes' : role === 'admin' ? 'Reportes recientes' : 'Actividad reciente'} meta={`${visibleIncidents.length} visibles`} />
        <View style={styles.incidentList}>
          {visibleIncidents.slice(0, 4).map((incident) => (
            <IncidentCard key={incident.id} incident={incident} compact showCitizen={role === 'admin'} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { padding: spacing.lg },
  pageWide: { padding: spacing.xl },
  shell: { width: '100%', maxWidth: 1080, alignSelf: 'center', gap: spacing.lg },
  header: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md
  },
  headerText: { gap: spacing.xs },
  headerButton: { alignSelf: 'flex-start', minWidth: 180 },
  kicker: { color: colors.secondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: colors.primary, fontSize: 26, fontWeight: '800' },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22, maxWidth: 680 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  actionCard: {
    flexBasis: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  actionCardWide: { flexBasis: 260, flexGrow: 1 },
  actionIcon: { width: 42, height: 42, borderRadius: radius.sm, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1 },
  actionTitle: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  actionCopy: { color: colors.muted, marginTop: 2, lineHeight: 18 },
  incidentList: { gap: spacing.md },
  pressed: { opacity: 0.82 }
});
