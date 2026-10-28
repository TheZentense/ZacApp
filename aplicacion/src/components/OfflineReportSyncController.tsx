import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSession } from '@/context/SessionContext';
import { syncOfflineReports } from '@/services/offlineReports';

export function OfflineReportSyncController() {
  const { userId, isAuthenticated, isGuest } = useSession();

  useEffect(() => {
    if (Platform.OS === 'web' || !isAuthenticated || isGuest || !userId) return;
    const sync = () => { void syncOfflineReports(userId); };
    sync();
    const network = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) sync();
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => {
      network();
      appState.remove();
    };
  }, [isAuthenticated, isGuest, userId]);

  return null;
}
