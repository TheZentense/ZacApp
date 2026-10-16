import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { isSupabaseConfigured } from '@/lib/supabase';
import { mockIncidents } from '@/data/mockIncidents';
import { listReports } from '@/services/reports';
import type { Incident } from '@/types/domain';
import { useSession } from '@/context/SessionContext';
import { personalTasksPendingMessage, reportReadScopeFor } from '@/services/sessionPolicy';

export function useReports() {
  const { userId, databaseRole, departmentId, isAuthenticated } = useSession();
  const requestVersion = useRef(0);
  const focused = useRef(false);
  const [incidents, setIncidents] = useState<Incident[]>(isSupabaseConfigured ? [] : mockIncidents);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState('');
  const [resultOwner, setResultOwner] = useState('');
  const identityKey = JSON.stringify([userId, databaseRole, departmentId]);

  const loadReports = useCallback(async () => {
    if (!focused.current) return;
    const version = ++requestVersion.current;
    const current = () => focused.current && version === requestVersion.current;
    if (databaseRole === 'operador' || (isSupabaseConfigured && databaseRole && reportReadScopeFor(databaseRole) === 'pending')) {
      setIncidents([]); setIsLoading(false); setError(personalTasksPendingMessage); return;
    }
    if (!isSupabaseConfigured) {
      setIncidents(mockIncidents);
      setIsLoading(false);
      return;
    }
    if (!isAuthenticated || !userId || !databaseRole) { setIncidents([]); setIsLoading(false); setError(isAuthenticated ? 'No fue posible verificar tu perfil. Inicia sesión nuevamente.' : ''); return; }

    setIsLoading(true);
    setError('');
    try {
      const reports = await listReports();
      if (current()) { setIncidents(reports); setResultOwner(identityKey); }
    } catch (loadError) {
      if (current()) { setIncidents([]); setError(loadError instanceof Error ? loadError.message : 'No fue posible consultar los reportes.'); }
    } finally {
      if (current()) setIsLoading(false);
    }
  }, [databaseRole, identityKey, isAuthenticated, userId]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    setIncidents(isSupabaseConfigured ? [] : mockIncidents);
    void loadReports();
    return () => { focused.current = false; ++requestVersion.current; };
  }, [loadReports]));

  const readable = databaseRole !== 'operador' && (!isSupabaseConfigured || (resultOwner === identityKey && reportReadScopeFor(databaseRole) !== 'pending'));
  return { incidents: readable ? incidents : [], isLoading, error, reload: loadReports, isPreview: !isSupabaseConfigured };
}
