import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';
import { roleVisuals } from '@/theme/roles';
import { workflowPermissionsFor } from '@/services/sessionPolicy';

const functions = [
  { title: 'Bandeja general', copy: 'Reportes y casos por validar', icon: 'document-text-outline', route: '/reports' },
  { title: 'Seguimiento', copy: 'Revisar procesos y responsables', icon: 'trail-sign-outline', route: '/tracking' },
  { title: 'Por departamento', copy: 'Consulta los reportes canalizados', icon: 'git-branch-outline', route: '/reports' },
  { title: 'Panel operativo', copy: 'Consultar indicadores y carga departamental', icon: 'bar-chart-outline', route: '/' },
  { title: 'Usuarios y accesos', copy: 'Consultar cuentas · edición pendiente', icon: 'people-outline', route: '/admin/users' },
  { title: 'Categorías y áreas', copy: 'Consultar catálogos · edición pendiente', icon: 'pricetags-outline', route: '/admin/catalogs' },
  { title: 'Mi perfil', copy: 'Consultar la sesión administrativa', icon: 'person-outline', route: '/profile' }
] as const;

const maintenanceFunctions = [
  { title: 'Bandeja departamental', copy: 'Casos canalizados al departamento', icon: 'clipboard-outline', route: '/reports' },
  { title: 'Empleados y responsables', copy: 'Responsable actual · asignación pendiente', icon: 'people-outline', route: '/reports' },
  { title: 'Evidencia e historial', copy: 'Consultar fotografías y movimientos', icon: 'camera-outline', route: '/tracking' },
  { title: 'Casos por verificar', copy: 'Consultar trabajos · verificación pendiente', icon: 'checkmark-done-outline', route: '/reports' },
  { title: 'Mi perfil', copy: 'Cuenta y departamento asignado', icon: 'person-outline', route: '/profile' }
] as const;

const employeeFunctions = [
  { title: 'Mis tareas', copy: 'Asignación personal pendiente', icon: 'clipboard-outline', route: '/reports' },
  { title: 'Mi seguimiento', copy: 'Observaciones e historial · pendiente', icon: 'time-outline', route: '/tracking' },
  { title: 'Mi perfil', copy: 'Cuenta y departamento asignado', icon: 'person-outline', route: '/profile' }
] as const;

export default function AdminMenuScreen() {
  const { width } = useWindowDimensions();
  const { role, databaseRole } = useSession();
  const permissions = workflowPermissionsFor(databaseRole);
  const visual = roleVisuals[role];
  const visibleFunctions = permissions.departmentReports ? maintenanceFunctions : permissions.generalReports ? functions : employeeFunctions.filter((item) => permissions.operator || item.route === '/profile');
  const title = permissions.departmentReports ? 'Encargado departamental' : permissions.generalReports ? 'Administración general' : permissions.operator ? 'Empleado operativo' : 'Funciones pendientes';
  const isWide = width >= 780;

  if (role === 'citizen') return <Redirect href="/services" />;

  const openFunction = (item: (typeof visibleFunctions)[number]) => {
    router.push(item.route);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
      <View style={[styles.header, { backgroundColor: visual.primary }]}>
        <View style={styles.headerMain}>
          <View style={[styles.headerIcon, { backgroundColor: visual.accent }]}><Ionicons name="options-outline" size={26} color={visual.primary} /></View>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: visual.accent }]}>{visual.eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.copy}>Elige una opción para continuar.</Text>
          </View>
        </View>
        <View style={styles.moduleCount}><Text style={[styles.moduleNumber, { color: visual.accent }]}>{visibleFunctions.length}</Text><Text style={styles.moduleLabel}>accesos para tu rol</Text></View>
      </View>

      <View style={styles.sectionHeading}><Text style={styles.sectionKicker}>HERRAMIENTAS</Text><Text style={styles.sectionTitle}>¿Qué deseas hacer?</Text></View>
      <View style={styles.grid}>
        {visibleFunctions.map((item) => (
          <Pressable key={item.title} style={({ pressed }) => [styles.card, isWide && styles.cardWide, pressed && styles.pressed]} onPress={() => openFunction(item)}>
            <View style={[styles.icon, { backgroundColor: visual.primary }]}><Ionicons name={item.icon} size={23} color={colors.white} /></View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardCopy}>{item.copy}</Text>
            </View>
            <View style={[styles.cardArrow, { backgroundColor: `${visual.accent}22` }]}><Ionicons name="arrow-forward" size={17} color={visual.primary} /></View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: spacing.md, gap: spacing.lg },
  header: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
  headerMain: { flex: 1, minWidth: 0, flexBasis: 260, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerIcon: { flexShrink: 0, width: 46, height: 46, borderRadius: 16, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: spacing.xs },
  title: { color: colors.white, fontSize: 23, lineHeight: 29, fontWeight: '800' },
  copy: { color: '#DDE8D7', marginTop: spacing.xs, lineHeight: 20 },
  moduleCount: { minWidth: 130, borderRadius: radius.lg, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.10)' },
  moduleNumber: { fontSize: 28, fontWeight: '900' },
  moduleLabel: { color: '#DDE8D7', fontSize: 12, fontWeight: '700' },
  sectionHeading: { gap: 2 },
  sectionKicker: { color: colors.secondary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: { flexGrow: 1, flexBasis: '100%', minWidth: 0, minHeight: 82, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardWide: { flexBasis: 340, flexGrow: 1 },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { color: colors.primary, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  cardCopy: { color: colors.muted, marginTop: spacing.xs, lineHeight: 19 },
  cardArrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 }
});
