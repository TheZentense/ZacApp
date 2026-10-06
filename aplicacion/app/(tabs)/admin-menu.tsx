import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme/tokens';

const functions = [
  { title: 'Gestionar reportes', copy: 'Consultar y actualizar incidencias', icon: 'document-text-outline', route: '/reports' },
  { title: 'Seguimiento', copy: 'Revisar procesos y responsables', icon: 'trail-sign-outline', route: '/tracking' },
  { title: 'Mantenimiento', copy: 'Administrar encargados, empleados y departamentos', icon: 'construct-outline' },
  { title: 'Asignaciones', copy: 'Derivar reportes y corregir responsables por error', icon: 'git-branch-outline', route: '/reports' },
  { title: 'Usuarios', copy: 'Administrar cuentas y accesos', icon: 'people-outline' },
  { title: 'Roles y permisos', copy: 'Definir funciones del personal', icon: 'shield-checkmark-outline' },
  { title: 'Categorías', copy: 'Organizar los tipos de incidencias', icon: 'pricetags-outline' },
  { title: 'Áreas municipales', copy: 'Organizar departamentos y responsables', icon: 'business-outline' },
  { title: 'Notificaciones', copy: 'Gestionar avisos y comunicaciones', icon: 'notifications-outline' },
  { title: 'Reportes y métricas', copy: 'Consultar indicadores de atención', icon: 'bar-chart-outline' },
  { title: 'Configuración', copy: 'Administrar preferencias del sistema', icon: 'settings-outline' },
  { title: 'Mi perfil', copy: 'Consultar la sesión administrativa', icon: 'person-outline', route: '/profile' }
] as const;

export default function AdminMenuScreen() {
  const openFunction = (item: (typeof functions)[number]) => {
    if ('route' in item) return router.push(item.route);
    Alert.alert(item.title, 'Módulo en preparación.');
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerIcon}><Ionicons name="options-outline" size={26} color={colors.white} /></View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Funciones administrativas</Text>
          <Text style={styles.copy}>Selecciona la herramienta que deseas utilizar.</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {functions.map((item) => (
          <Pressable key={item.title} style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => openFunction(item)}>
            <View style={styles.icon}><Ionicons name={item.icon} size={24} color={colors.primary} /></View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardCopy}>{item.copy}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg },
  header: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { color: colors.white, fontSize: 24, fontWeight: '800' },
  copy: { color: '#DDE8D7', marginTop: spacing.xs, lineHeight: 20 },
  grid: { gap: spacing.md },
  card: { minHeight: 82, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1 },
  cardTitle: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  cardCopy: { color: colors.muted, marginTop: spacing.xs, lineHeight: 19 },
  pressed: { opacity: 0.8 }
});
