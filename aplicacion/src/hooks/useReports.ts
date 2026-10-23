import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { mockIncidents } from '@/data/mockIncidents';
import { listReports } from '@/services/reports';
import type { Incident } from '@/types/domain';
import { useSession } from '@/context/SessionContext';
import { reportReadScopeFor } from '@/services/sessionPolicy';

let channelSequence = 0;

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
    if (isSupabaseConfigured && databaseRole && reportReadScopeFor(databaseRole) === 'pending') {
      setIncidents([]); setIsLoading(false); setError('Esta cuenta todavía no tiene una consulta de reportes habilitada.'); return;
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
    let active = true;
    focused.current = true;
    setIncidents(isSupabaseConfigured ? [] : mockIncidents);
    void loadReports();
    const scope = reportReadScopeFor(databaseRole);
    const filter = scope === 'citizen' ? `citizen_id=eq.${userId}`
      : scope === 'personal' ? `assigned_to=eq.${userId}`
      : scope === 'department' ? `assigned_department_id=eq.${departmentId}` : undefined;
    const refresh = () => { if (active) void loadReports(); };
    const channel = supabase && isAuthenticated && userId && scope !== 'pending' && (scope !== 'department' || departmentId)
      ? supabase.channel(`report-list-${++channelSequence}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents', ...(filter ? { filter } : {}) }, refresh)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents', ...(filter ? { filter } : {}) }, refresh)
        .subscribe((status) => {
          // SUBSCRIBED also fires after a WebSocket reconnect.
          if (active && status === 'SUBSCRIBED') void loadReports();
        })
      : null;
    const appState = AppState?.addEventListener?.('change', (state) => {
      if (active && state === 'active') void loadReports();
    });
    // An UPDATE can revoke the old assignee's RLS visibility, so that user may
    // not receive the change event. Reconcile while this screen is focused.
    const fallback = channel ? setInterval(() => { if (active) void loadReports(); }, 45_000) : null;
    return () => {
      active = false;
      focused.current = false;
      ++requestVersion.current;
      if (fallback) clearInterval(fallback);
      appState?.remove();
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [databaseRole, departmentId, isAuthenticated, loadReports, userId]));

  const readable = !isSupabaseConfigured || (resultOwner === identityKey && reportReadScopeFor(databaseRole) !== 'pending');
  return { incidents: readable ? incidents : [], isLoading, error, reload: loadReports, isPreview: !isSupabaseConfigured };
}
