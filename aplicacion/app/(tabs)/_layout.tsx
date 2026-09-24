import { router, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import type { ComponentProps } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';

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
  { name: 'reports', title: 'Gestionar reportes', icon: 'document-text-outline' },
  { name: 'tracking', title: 'Seguimiento', icon: 'trail-sign-outline' },
  { name: 'admin-menu', title: 'Funciones', icon: 'options-outline' },
  { name: 'profile', title: 'Perfil', icon: 'person-outline' }
] satisfies { name: string; title: string; icon: IconName }[];

const maintenanceNavigation = [
  { name: 'index', title: 'Panel de trabajo', icon: 'construct-outline' },
  { name: 'reports', title: 'Asignaciones', icon: 'clipboard-outline' },
  { name: 'tracking', title: 'Seguimiento', icon: 'trail-sign-outline' },
  { name: 'profile', title: 'Perfil', icon: 'person-outline' }
] satisfies { name: string; title: string; icon: IconName }[];

function WebSidebar({ state, navigation, role }: BottomTabBarProps & { role: 'citizen' | 'admin' | 'maintenance' }) {
  const [expanded, setExpanded] = useState(true);
  const { signOut } = useSession();
  const isAdmin = role === 'admin';
  const isMaintenance = role === 'maintenance';
  const isStaff = isAdmin || isMaintenance;
  const items = isAdmin ? adminNavigation : isMaintenance ? maintenanceNavigation : citizenNavigation;
  const accent = isMaintenance ? '#7DD3CF' : '#E7B04B';
  const activeRoute = state.routes[state.index]?.name;

  return (
    <View style={[styles.sidebar, !expanded && styles.sidebarCollapsed, isStaff && styles.adminSidebar, isMaintenance && styles.maintenanceSidebar]}>
      <View style={[styles.brand, !expanded && styles.brandCollapsed]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Contraer navegación' : 'Expandir navegación'}
          style={[styles.logoButton, !expanded && styles.logoButtonCollapsed]}
          onPress={() => setExpanded((current) => !current)}
        >
          <View style={[styles.logo, isStaff && styles.adminLogo]}>
            <Image source={require('../../assets/images/zacapp-logo-dark.png')} style={styles.logoImage} resizeMode="cover" />
          </View>
          <View style={[styles.toggleHint, isStaff && styles.adminToggleHint, isMaintenance && styles.maintenanceToggleHint]}>
            <Ionicons name={expanded ? 'chevron-back' : 'chevron-forward'} size={11} color={isStaff ? '#14243A' : colors.white} />
          </View>
        </Pressable>
        {expanded && (
          <View style={styles.brandText}>
            <Text style={[styles.brandTitle, isStaff && styles.adminText]}>ZacApp</Text>
            <Text style={[styles.brandSubtitle, isStaff && styles.adminMuted]}>{isAdmin ? 'Superadministración' : isMaintenance ? 'Mantenimiento · Agua' : 'Portal ciudadano'}</Text>
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
              style={[styles.navItem, !expanded && styles.navItemCollapsed, active && styles.navItemActive, active && isStaff && styles.adminNavItemActive]}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!event.defaultPrevented) navigation.navigate(route.name);
              }}
            >
              <Ionicons name={item.icon} size={21} color={active ? (isStaff ? accent : colors.primary) : (isStaff ? '#B9C5D5' : colors.muted)} />
              {expanded && <Text style={[styles.navText, isStaff && styles.adminMuted, active && styles.navTextActive, active && isStaff && { color: accent }]}>{item.title}</Text>}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar sesión"
        style={[styles.logoutButton, !expanded && styles.navItemCollapsed, isStaff && styles.adminLogoutButton]}
        onPress={() => {
          signOut();
          router.replace('/login');
        }}
      >
        <Ionicons name="log-out-outline" size={21} color={isStaff ? accent : colors.danger} />
        {expanded && <Text style={[styles.logoutText, isStaff && { color: accent }]}>Cerrar sesión</Text>}
      </Pressable>

    </View>
  );
}

export default function TabsLayout() {
  const { role } = useSession();
  const isAdmin = role === 'admin';
  const isMaintenance = role === 'maintenance';
  const isStaff = isAdmin || isMaintenance;
  const isWeb = Platform.OS === 'web';
  const navigationBackground = isMaintenance ? '#0F4C5C' : isAdmin ? '#14243A' : colors.white;
  const navigationAccent = isMaintenance ? '#7DD3CF' : isAdmin ? '#E7B04B' : colors.primary;
  const navigationMuted = isStaff ? '#B9C5D5' : colors.muted;

  return (
    <Tabs
      tabBar={isWeb ? (props) => <WebSidebar {...props} role={role} /> : undefined}
      screenOptions={{
        headerStyle: { backgroundColor: navigationBackground },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '800' },
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
      }}
    >
      <Tabs.Screen name="reports" options={{ title: isAdmin ? 'Gestionar reportes' : isMaintenance ? 'Asignaciones' : 'Mis reportes', href: isAdmin && !isWeb ? null : '/reports', tabBarIcon: ({ color, size }) => <Ionicons name={isMaintenance ? 'clipboard-outline' : 'document-text-outline'} color={color} size={size} /> }} />
      <Tabs.Screen name="tracking" options={{ title: 'Seguimiento', href: isAdmin && !isWeb ? null : '/tracking', tabBarIcon: ({ color, size }) => <Ionicons name="trail-sign-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="index" options={{ title: isAdmin ? 'Panel' : isMaintenance ? 'Trabajo' : 'Inicio', tabBarItemStyle: !isWeb && !isStaff ? styles.centerTabItem : undefined, tabBarIcon: ({ color, size }) => !isWeb && !isStaff ? <View style={styles.centerTabIcon}><Ionicons name="home" color={colors.white} size={size + 2} /></View> : <Ionicons name={isAdmin ? 'grid-outline' : isMaintenance ? 'construct-outline' : 'home-outline'} color={color} size={size} /> }} />
      <Tabs.Screen name="services" options={{ title: 'Servicios', href: role === 'citizen' ? '/services' : null, tabBarIcon: ({ color, size }) => <Ionicons name="apps-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', href: isAdmin && !isWeb ? null : '/profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} /> }} />
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
  centerTabItem: { marginTop: -10 },
  centerTabIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.white, elevation: 5 },
});
