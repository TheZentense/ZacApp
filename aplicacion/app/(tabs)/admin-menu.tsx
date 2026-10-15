import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';
import { roleVisuals } from '@/theme/roles';

const functions = [
  { title: 'Gestionar reportes', copy: 'Consultar y actualizar incidencias', icon: 'document-text-outline', route: '/reports' },
  { title: 'Seguimiento', copy: 'Revisar procesos y responsables', icon: 'trail-sign-outline', route: '/tracking' },
  { title: 'Asignaciones', copy: 'Distribuir reportes entre áreas y responsables', icon: 'git-branch-outline', route: '/reports' },
  { title: 'Panel operativo', copy: 'Consultar indicadores y carga departamental', icon: 'bar-chart-outline', route: '/' },
  { title: 'Usuarios y accesos', copy: 'Gestionar personal, estado y departamento', icon: 'people-outline', route: '/admin/users' },
  { title: 'Mi perfil', copy: 'Consultar la sesión administrativa', icon: 'person-outline', route: '/profile' }
] as const;

const maintenanceFunctions = [
  { title: 'Trabajo asignado', copy: 'Consultar órdenes del departamento', icon: 'clipboard-outline', route: '/reports' },
  { title: 'Actualizar estado', copy: 'Registrar el avance de una atención', icon: 'sync-outline', route: '/reports' },
  { title: 'Evidencia e historial', copy: 'Consultar fotografías y movimientos', icon: 'camera-outline', route: '/tracking' },
  { title: 'Ubicaciones', copy: 'Consultar los puntos de atención', icon: 'location-outline', route: '/reports' },
  { title: 'Mi perfil', copy: 'Cuenta y departamento asignado', icon: 'person-outline', route: '/profile' }
] as const;

const employeeFunctions = [
  { title: 'Bandeja departamental', copy: 'Revisar reportes recibidos', icon: 'file-tray-full-outline', route: '/reports' },
  { title: 'Validar reportes', copy: 'Confirmar información y categoría', icon: 'checkmark-done-outline', route: '/reports' },
  { title: 'Canalizar', copy: 'Enviar casos al equipo responsable', icon: 'git-branch-outline', route: '/reports' },
  { title: 'Historial del área', copy: 'Consultar movimientos del departamento', icon: 'time-outline', route: '/tracking' },
  { title: 'Mi perfil', copy: 'Cuenta y departamento asignado', icon: 'person-outline', route: '/profile' }
] as const;

export default function AdminMenuScreen() {
  const { width } = useWindowDimensions();
  const { role } = useSession();
  const visual = roleVisuals[role];
  const visibleFunctions = role === 'maintenance' ? maintenanceFunctions : role === 'employee' ? employeeFunctions : functions;
  const title = role === 'maintenance' ? 'Herramientas de campo' : role === 'employee' ? 'Funciones del departamento' : 'Funciones administrativas';
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
            <Text style={[styles.eyebrow, { color: visual.accent }]}>{visual.eyebrow} · CENTRO DE CONTROL</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.copy}>Selecciona una función disponible para tu rol.</Text>
          </View>
        </View>
        <View style={styles.moduleCount}><Text style={[styles.moduleNumber, { color: visual.accent }]}>{visibleFunctions.length}</Text><Text style={styles.moduleLabel}>módulos disponibles</Text></View>
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
  page: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg },
  header: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
  headerMain: { flex: 1, minWidth: 260, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: spacing.xs },
  title: { color: colors.white, fontSize: 24, fontWeight: '800' },
  copy: { color: '#DDE8D7', marginTop: spacing.xs, lineHeight: 20 },
  moduleCount: { minWidth: 130, borderRadius: radius.lg, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.10)' },
  moduleNumber: { fontSize: 28, fontWeight: '900' },
  moduleLabel: { color: '#DDE8D7', fontSize: 12, fontWeight: '700' },
  sectionHeading: { gap: 2 },
  sectionKicker: { color: colors.secondary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: { minHeight: 82, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardWide: { flexBasis: 340, flexGrow: 1 },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1 },
  cardTitle: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  cardCopy: { color: colors.muted, marginTop: spacing.xs, lineHeight: 19 },
  cardArrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 }
});
