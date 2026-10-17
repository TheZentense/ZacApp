import { useCallback, useRef, useState } from 'react';
import { Redirect, useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/context/SessionContext';
import { listCatalogs, type CatalogItem } from '@/services/catalogs';
import { AppButton } from '@/components/AppButton';
import { ErrorState, LoadingState } from '@/components/DataState';
import { backendPendingMessage } from '@/lib/backendCapabilities';
import { colors, radius, spacing } from '@/theme/tokens';

export default function CatalogsScreen() {
  const { databaseRole, isAuthenticated, isLoading } = useSession();
  const [catalogs, setCatalogs] = useState<{ categories: CatalogItem[]; departments: CatalogItem[] }>({ categories: [], departments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const focused = useRef(false);
  const request = useRef(0);
  const allowed = isAuthenticated && databaseRole === 'administrador';
  const load = useCallback(async () => {
    if (!allowed || !focused.current) return;
    const version = ++request.current;
    const current = () => focused.current && version === request.current;
    setLoading(true); setError('');
    try { const items = await listCatalogs(); if (current()) setCatalogs(items); }
    catch { if (current()) { setCatalogs({ categories: [], departments: [] }); setError('No fue posible consultar los catálogos.'); } }
    finally { if (current()) setLoading(false); }
  }, [allowed]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    void load();
    return () => { focused.current = false; ++request.current; };
  }, [load]));
  if (isLoading) return <LoadingState />;
  if (!allowed) return <Redirect href="/(tabs)" />;
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Categorías y departamentos</Text>
    <View style={styles.card}><Text style={styles.copy}>{backendPendingMessage} La consulta muestra únicamente las opciones permitidas para tu sesión.</Text><AppButton label="Modificar catálogo · pendiente" disabled onPress={() => {}} /></View>
    {loading ? <LoadingState /> : error ? <ErrorState description={error} onRetry={load} /> : (['categories', 'departments'] as const).map((key) => <View style={styles.card} key={key}><Text style={styles.heading}>{key === 'categories' ? 'Categorías' : 'Departamentos'}</Text>{catalogs[key].map((item) => <Text key={item.id} style={styles.copy}>{item.name} · {item.active ? 'Disponible' : 'Inactiva'}</Text>)}{!catalogs[key].length && <Text style={styles.copy}>Sin opciones visibles.</Text>}</View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { padding: spacing.lg, gap: spacing.md, maxWidth: 920, width: '100%', alignSelf: 'center' }, title: { color: colors.primary, fontSize: 26, fontWeight: '800' }, heading: { color: colors.primary, fontSize: 20, fontWeight: '700' }, card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border }, copy: { color: colors.muted, lineHeight: 21 } });
