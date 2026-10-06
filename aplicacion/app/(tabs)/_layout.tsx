import { router, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import type { ComponentProps } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSession, type UserRole } from '@/context/SessionContext';

type IconName = ComponentProps<typeof Ionicons>['name'];

const citizenNavigation = [
  { name: 'index', title: 'Inicio', icon: 'home-outline' },
  { name: 'reports', title: 'Mis reportes', icon: 'document-text-outline' },
  { name: 'tracking', title: 'Seguimiento', icon: 'trail-sign-outline' },
  { name: 'services', title: 'Servicios', icon: 'apps-outline' },
  { name: 'profile', title: 'Perfil', icon: 'person-outline' }
] satisfies { name: string; title: string; icon: IconName }[];

const adminNavigation = [
  { name: 'index', title: 'Panel', icon: 'grid-outline' },
  { name: 'reports', title: 'Gestión', icon: 'document-text-outline' },
  { name: 'tracking', title: 'Control', icon: 'analytics-outline' },
  { name: 'admin-menu', title: 'Funciones', icon: 'options-outline' },
  { name: 'profile', title: 'Perfil', icon: 'person-outline' }
] satisfies { name: string; title: string; icon: IconName }[];

const maintenanceManagerNavigation = [
  { name: 'index', title: 'Panel', icon: 'construct-outline' },
  { name: 'reports', title: 'Asignar', icon: 'git-branch-outline' },
  { name: 'tracking', title: 'Filtros', icon: 'funnel-outline' },
  { name: 'profile', title: 'Perfil', icon: 'person-outline' }
] satisfies { name: string; title: string; icon: IconName }[];

const maintenanceEmployeeNavigation = [
  { name: 'index', title: 'Tareas', icon: 'construct-outline' },
  { name: 'reports', title: 'Recibidas', icon: 'clipboard-outline' },
  { name: 'tracking', title: 'Avance', icon: 'trail-sign-outline' },
  { name: 'profile', title: 'Perfil', icon: 'person-outline' }
] satisfies { name: string; title: string; icon: IconName }[];

function getRoleNavigation(role: UserRole) {
  if (role === 'admin') return adminNavigation;
  if (role === 'maintenance_manager') return maintenanceManagerNavigation;
  if (role === 'maintenance_employee') return maintenanceEmployeeNavigation;
  return citizenNavigation;
}

function getRoleMeta(role: UserRole, departmentLabel: string | null) {
  const isAdmin = role === 'admin';
  const isMaintenance = role === 'maintenance_manager' || role === 'maintenance_employee';
  const isMaintenanceManager = role === 'maintenance_manager';
  const isMaintenanceEmployee = role === 'maintenance_employee';
  const isStaff = isAdmin || isMaintenance;
  return {
    isAdmin,
    isMaintenance,
    isMaintenanceManager,
    isMaintenanceEmployee,
    isStaff,
    background: isMaintenance ? '#0F4C5C' : isAdmin ? '#14243A' : colors.white,
    accent: isMaintenance ? '#7DD3CF' : isAdmin ? '#E7B04B' : colors.primary,
    muted: isStaff ? '#B9C5D5' : colors.muted,
    subtitle: isAdmin
      ? 'Administración general'
      : isMaintenanceManager
        ? `Encargado · ${departmentLabel ?? 'Departamento'}`
        : isMaintenanceEmployee
          ? `Empleado · ${departmentLabel ?? 'Departamento'}`
          : 'Portal ciudadano'
  };
}

function WebSidebar({ state, navigation, role }: BottomTabBarProps & { role: UserRole }) {
  const [expanded, setExpanded] = useState(true);
  const { signOut, departmentLabel } = useSession();
  const meta = getRoleMeta(role, departmentLabel);
  const items = getRoleNavigation(role);
  const activeRoute = state.routes[state.index]?.name;

  return (
    <View style={[styles.sidebar, !expanded && styles.sidebarCollapsed, meta.isStaff && styles.adminSidebar, meta.isMaintenance && styles.maintenanceSidebar]}>
      <View style={[styles.brand, !expanded && styles.brandCollapsed]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Contraer navegación' : 'Expandir navegación'}
          style={[styles.logoButton, !expanded && styles.logoButtonCollapsed]}
          onPress={() => setExpanded((current) => !current)}
        >
          <View style={[styles.logo, meta.isStaff && styles.adminLogo]}>
            <Image source={require('../../assets/images/zacapp-logo-dark.png')} style={styles.logoImage} resizeMode="cover" />
          </View>
          <View style={[styles.toggleHint, meta.isStaff && styles.adminToggleHint, meta.isMaintenance && styles.maintenanceToggleHint]}>
            <Ionicons name={expanded ? 'chevron-back' : 'chevron-forward'} size={11} color={meta.isStaff ? '#14243A' : colors.white} />
          </View>
        </Pressable>
        {expanded && (
          <View style={styles.brandText}>
            <Text style={[styles.brandTitle, meta.isStaff && styles.adminText]}>ZacApp</Text>
            <Text style={[styles.brandSubtitle, meta.isStaff && styles.adminMuted]}>{meta.subtitle}</Text>
          </View>
        )}
      </View>

      <View style={styles.navigation}>
        {items.map((item) => {
          const route = state.routes.find((candidate) => candidate.name === item.name);
          if (!route) return null;
          const active = activeRoute === item.name;
          return (
            <Pressable
              key={item.name}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              style={[styles.navItem, !expanded && styles.navItemCollapsed, active && styles.navItemActive, active && meta.isStaff && styles.adminNavItemActive]}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!event.defaultPrevented) navigation.navigate(route.name);
              }}
            >
              <Ionicons name={item.icon} size={21} color={active ? (meta.isStaff ? meta.accent : colors.primary) : (meta.isStaff ? '#B9C5D5' : colors.muted)} />
              {expanded && <Text style={[styles.navText, meta.isStaff && styles.adminMuted, active && styles.navTextActive, active && meta.isStaff && { color: meta.accent }]}>{item.title}</Text>}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar sesión"
        style={[styles.logoutButton, !expanded && styles.navItemCollapsed, meta.isStaff && styles.adminLogoutButton]}
        onPress={() => {
          signOut();
          router.replace('/login');
        }}
      >
        <Ionicons name="log-out-outline" size={21} color={meta.isStaff ? meta.accent : colors.danger} />
        {expanded && <Text style={[styles.logoutText, meta.isStaff && { color: meta.accent }]}>Cerrar sesión</Text>}
      </Pressable>

    </View>
  );
}

function NativeBottomBar({ state, navigation, role }: BottomTabBarProps & { role: UserRole }) {
  const { departmentLabel } = useSession();
  const meta = getRoleMeta(role, departmentLabel);
  const items = getRoleNavigation(role);
  const activeRoute = state.routes[state.index]?.name;

  return (
    <View style={[styles.nativeBar, { backgroundColor: meta.background, borderTopColor: meta.isStaff ? '#2B4360' : colors.border }]}>
      {items.map((item) => {
        const route = state.routes.find((candidate) => candidate.name === item.name);
        if (!route) return null;
        const active = activeRoute === item.name;
        return (
          <Pressable
            key={item.name}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            style={[styles.nativeItem, active && (meta.isStaff ? styles.nativeItemStaffActive : styles.nativeItemActive)]}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!event.defaultPrevented) navigation.navigate(route.name);
            }}
          >
            <Ionicons name={item.icon} size={22} color={active ? (meta.isStaff ? meta.accent : colors.primary) : meta.muted} />
            <Text numberOfLines={1} style={[styles.nativeLabel, { color: active ? (meta.isStaff ? meta.accent : colors.primary) : meta.muted }]}>{item.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { role, signOut } = useSession();
  const isMaintenance = role === 'maintenance_manager' || role === 'maintenance_employee';
  const isMaintenanceManager = role === 'maintenance_manager';
  const isMaintenanceEmployee = role === 'maintenance_employee';
  const isAdmin = role === 'admin';
  const isStaff = isAdmin || isMaintenance;
  const isWeb = Platform.OS === 'web';
  const navigationBackground = isMaintenance ? '#0F4C5C' : isAdmin ? '#14243A' : colors.white;
  const navigationAccent = isMaintenance ? '#7DD3CF' : isAdmin ? '#E7B04B' : colors.primary;
  const navigationMuted = isStaff ? '#B9C5D5' : colors.muted;

  return (
    <Tabs
      tabBar={(props) => isWeb ? <WebSidebar {...props} role={role} /> : <NativeBottomBar {...props} role={role} />}
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: navigationBackground },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '800' },
        headerLeft: !isWeb && isStaff && route.name !== 'index'
          ? () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Regresar al panel"
                style={styles.headerAction}
                onPress={() => router.replace('/(tabs)')}
              >
                <Ionicons name="arrow-back" size={20} color={colors.white} />
                <Text style={styles.headerActionText}>Panel</Text>
              </Pressable>
            )
          : undefined,
        headerRight: !isWeb && isStaff
          ? () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar sesión"
                style={styles.headerAction}
                onPress={() => {
                  signOut();
                  router.replace('/login');
                }}
              >
                <Ionicons name="log-out-outline" size={20} color={colors.white} />
                <Text style={styles.headerActionText}>Salir</Text>
              </Pressable>
            )
          : undefined,
        tabBarActiveTintColor: navigationAccent,
        tabBarInactiveTintColor: navigationMuted,
        tabBarActiveBackgroundColor: isWeb ? (isStaff ? '#203753' : colors.softGreen) : undefined,
        tabBarPosition: isWeb ? 'left' : 'bottom',
        tabBarLabelPosition: isWeb ? 'beside-icon' : 'below-icon',
        tabBarStyle: isWeb
          ? {
              width: 260,
              paddingTop: 28,
              paddingHorizontal: 14,
              backgroundColor: navigationBackground,
              borderRightColor: isStaff ? '#2B4360' : colors.border,
              borderTopColor: 'transparent'
            }
          : {
              borderTopColor: isStaff ? '#2B4360' : colors.border,
              backgroundColor: navigationBackground,
              height: !isAdmin ? 70 : undefined,
              paddingBottom: !isAdmin ? 8 : undefined
            },
        tabBarItemStyle: isWeb ? { minHeight: 54, maxHeight: 54, borderRadius: 12, marginVertical: 4 } : undefined,
        tabBarLabelStyle: isWeb ? { fontSize: 14, fontWeight: '700', textAlign: 'left' } : undefined
      })}
    >
      <Tabs.Screen name="reports" options={{ title: isAdmin ? 'Gestión de reportes' : isMaintenanceManager ? 'Asignar tareas' : isMaintenanceEmployee ? 'Tareas recibidas' : 'Mis reportes', href: '/reports', tabBarIcon: ({ color, size }) => <Ionicons name={isMaintenanceManager ? 'git-branch-outline' : isMaintenanceEmployee ? 'clipboard-outline' : 'document-text-outline'} color={color} size={size} /> }} />
      <Tabs.Screen name="tracking" options={{ title: isAdmin ? 'Control' : isMaintenanceManager ? 'Filtros' : isMaintenanceEmployee ? 'Avance' : 'Seguimiento', href: '/tracking', tabBarIcon: ({ color, size }) => <Ionicons name={isMaintenanceManager ? 'funnel-outline' : 'trail-sign-outline'} color={color} size={size} /> }} />
      <Tabs.Screen name="index" options={{ title: isAdmin ? 'Panel' : isMaintenanceManager ? 'Panel' : isMaintenanceEmployee ? 'Tareas' : 'Inicio', tabBarItemStyle: !isWeb && !isStaff ? styles.centerTabItem : undefined, tabBarIcon: ({ color, size }) => !isWeb && !isStaff ? <View style={styles.centerTabIcon}><Ionicons name="home" color={colors.white} size={size + 2} /></View> : <Ionicons name={isAdmin ? 'grid-outline' : isMaintenance ? 'construct-outline' : 'home-outline'} color={color} size={size} /> }} />
      <Tabs.Screen name="services" options={{ title: 'Servicios', href: role === 'citizen' ? '/services' : null, tabBarIcon: ({ color, size }) => <Ionicons name="apps-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', href: '/profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="admin-menu" options={{ title: 'Funciones', href: isAdmin ? '/admin-menu' : null, tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 252, minHeight: '100%', padding: spacing.md, backgroundColor: colors.white, borderRightWidth: 1, borderRightColor: colors.border },
  sidebarCollapsed: { width: 82, paddingHorizontal: spacing.sm },
  adminSidebar: { backgroundColor: '#14243A', borderRightColor: '#2B4360' },
  maintenanceSidebar: { backgroundColor: '#0F4C5C', borderRightColor: '#246575' },
  brand: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  brandCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  logoButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  logoButtonCollapsed: { marginHorizontal: 'auto' },
  logo: { width: 44, height: 44, borderRadius: 13, flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  adminLogo: { borderColor: '#E7B04B' },
  logoImage: { width: '100%', height: '100%' },
  toggleHint: { position: 'absolute', right: -2, bottom: -1, width: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary, borderWidth: 2, borderColor: colors.white },
  adminToggleHint: { backgroundColor: '#E7B04B', borderColor: '#14243A' },
  maintenanceToggleHint: { backgroundColor: '#7DD3CF', borderColor: '#0F4C5C' },
  brandText: { flex: 1 },
  brandTitle: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  brandSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  adminText: { color: colors.white },
  adminMuted: { color: '#B9C5D5' },
  navigation: { flex: 1, paddingTop: spacing.lg, gap: spacing.xs },
  navItem: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  navItemCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  navItemActive: { backgroundColor: colors.softGreen },
  adminNavItemActive: { backgroundColor: '#203753' },
  navText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  navTextActive: { color: colors.primary },
  adminActiveText: { color: '#E7B04B' },
  logoutButton: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.dangerSoft },
  adminLogoutButton: { backgroundColor: '#203753' },
  logoutText: { color: colors.danger, fontSize: 14, fontWeight: '800' },
  headerAction: { minHeight: 40, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerActionText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  nativeBar: { minHeight: 74, paddingHorizontal: spacing.xs, paddingTop: spacing.xs, paddingBottom: spacing.sm, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  nativeItem: { flex: 1, minHeight: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 2 },
  nativeItemActive: { backgroundColor: colors.softGreen },
  nativeItemStaffActive: { backgroundColor: '#203753' },
  nativeLabel: { fontSize: 11, fontWeight: '800' },
  centerTabItem: { marginTop: -10 },
  centerTabIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.white, elevation: 5 },
});
