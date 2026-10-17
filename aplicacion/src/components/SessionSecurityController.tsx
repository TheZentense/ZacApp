import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState, BackHandler, Platform } from 'react-native';
import { useSession } from '@/context/SessionContext';

const BACKGROUND_AT_KEY = '@zacapp/security/background-at';
const BACKGROUND_SESSION_LIMIT_MS = 10 * 60 * 1000;

export function SessionSecurityController() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, signOut } = useSession();
  const signingOutRef = useRef(false);

  const closeExpiredSession = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    try {
      await AsyncStorage.removeItem(BACKGROUND_AT_KEY);
      await signOut();
      router.replace('/login');
      Alert.alert('Sesión cerrada', 'Tu sesión se cerró después de 10 minutos fuera de ZacApp.');
    } finally {
      signingOutRef.current = false;
    }
  }, [signOut]);

  const verifyBackgroundTime = useCallback(async () => {
    const backgroundAt = await AsyncStorage.getItem(BACKGROUND_AT_KEY);
    if (!backgroundAt) return;

    const elapsed = Date.now() - Number(backgroundAt);
    if (Number.isFinite(elapsed) && elapsed >= BACKGROUND_SESSION_LIMIT_MS) {
      await closeExpiredSession();
      return;
    }
    await AsyncStorage.removeItem(BACKGROUND_AT_KEY);
  }, [closeExpiredSession]);

  useEffect(() => {
    if (Platform.OS === 'web' || isLoading || !isAuthenticated) return;

    void verifyBackgroundTime();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        void AsyncStorage.setItem(BACKGROUND_AT_KEY, String(Date.now()));
      } else if (nextState === 'active') {
        void verifyBackgroundTime();
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated, isLoading, verifyBackgroundTime]);

  useEffect(() => {
    if (Platform.OS !== 'android' || isLoading || !isAuthenticated) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pathname !== '/profile') {
        router.replace('/profile');
        return true;
      }

      Alert.alert('Cerrar sesión', '¿Deseas cerrar sesión?', [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await AsyncStorage.removeItem(BACKGROUND_AT_KEY);
              await signOut();
              router.replace('/login');
            })();
          }
        }
      ]);
      return true;
    });

    return () => subscription.remove();
  }, [isAuthenticated, isLoading, pathname, signOut]);

  return null;
}
