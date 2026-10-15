import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme/tokens';
import { SessionProvider } from '@/context/SessionContext';
import { ReportsProvider } from '@/context/ReportsContext';

export default function RootLayout() {
  return (
    <SessionProvider>
      <ReportsProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: colors.primary }, headerTintColor: colors.white }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Ingresar' }} />
          <Stack.Screen name="register" options={{ title: 'Crear cuenta' }} />
          <Stack.Screen name="forgot-password" options={{ title: 'Recuperar contraseña' }} />
          <Stack.Screen name="reset-password" options={{ title: 'Nueva contraseña' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="report/new" options={{ title: 'Nuevo reporte', presentation: 'modal' }} />
          <Stack.Screen name="admin/users" options={{ title: 'Administración de usuarios' }} />
        </Stack>
      </ReportsProvider>
    </SessionProvider>
  );
}
