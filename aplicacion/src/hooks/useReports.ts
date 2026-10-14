import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { isSupabaseConfigured } from '@/lib/supabase';
import { mockIncidents } from '@/data/mockIncidents';
import { listReports } from '@/services/reports';
import type { Incident } from '@/types/domain';

export function useReports() {
  const [incidents, setIncidents] = useState<Incident[]>(isSupabaseConfigured ? [] : mockIncidents);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIncidents(mockIncidents);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      setIncidents(await listReports());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No fue posible consultar los reportes.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadReports();
  }, [loadReports]));

  return { incidents, isLoading, error, reload: loadReports, isPreview: !isSupabaseConfigured };
}
