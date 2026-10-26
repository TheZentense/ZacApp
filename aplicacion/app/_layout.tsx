import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme/tokens';
import { SessionProvider, useSession } from '@/context/SessionContext';
import { ReportsProvider } from '@/context/ReportsContext';
import { SessionSecurityController } from '@/components/SessionSecurityController';
import { BiometricLockScreen } from '@/components/BiometricLockScreen';
import { isSupabaseConfigured } from '@/lib/supabase';

function AppNavigation() {
  const { isLoading, isLocked, isAuthenticated, isPasswordRecovery } = useSession();
  const pathname = usePathname();
  const privateAccess = !isSupabaseConfigured || (!isLoading && !isLocked && isAuthenticated);
  return <>
    <SessionSecurityController />
    <ReportsProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: colors.primary }, headerTintColor: colors.white }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Ingresar' }} />
        <Stack.Screen name="register" options={{ title: 'Crear cuenta' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Recuperar contraseña' }} />
        <Stack.Screen name="reset-password" options={{ title: 'Nueva contraseña' }} />
        <Stack.Protected guard={!isLoading && !isLocked}>
          <Stack.Screen name="report/new" options={{ title: 'Nuevo reporte', presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={privateAccess}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="admin/users" options={{ title: 'Administración de usuarios' }} />
          <Stack.Screen name="admin/catalogs" options={{ title: 'Categorías y departamentos' }} />
        </Stack.Protected>
      </Stack>
      {(isLoading || (isLocked && !isPasswordRecovery && pathname !== '/login')) && <BiometricLockScreen />}
    </ReportsProvider>
  </>;
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <AppNavigation />
    </SessionProvider>
  );
}
