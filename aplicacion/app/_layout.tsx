import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme/tokens';
import { SessionProvider } from '@/context/SessionContext';

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: colors.primary }, headerTintColor: colors.white }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Ingresar' }} />
        <Stack.Screen name="register" options={{ title: 'Crear cuenta' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="report/new" options={{ title: 'Nuevo reporte', presentation: 'modal' }} />
      </Stack>
    </SessionProvider>
  );
}
