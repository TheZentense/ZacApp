import { useCallback, useRef, useState } from 'react';
import { Redirect, useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSession } from '@/context/SessionContext';
import { listManagedUsers, type ManagedUser } from '@/services/users';
import { AppButton } from '@/components/AppButton';
import { ErrorState, LoadingState } from '@/components/DataState';
import { backendPendingMessage } from '@/lib/backendCapabilities';
import { colors, radius, spacing } from '@/theme/tokens';

export default function UsersScreen() {
  const { databaseRole, isAuthenticated, isLoading } = useSession();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState('');
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
    try { const items = await listManagedUsers(); if (current()) setUsers(items); }
    catch { if (current()) { setUsers([]); setError('No fue posible consultar los usuarios.'); } }
    finally { if (current()) setLoading(false); }
  }, [allowed]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    void load();
    return () => { focused.current = false; ++request.current; };
  }, [load]));
  if (isLoading) return <LoadingState />;
  if (!allowed) return <Redirect href="/(tabs)" />;
  const visible = users.filter((item) => `${item.fullName} ${item.role}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')));
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Usuarios y accesos</Text>
    <View style={styles.card}><Text style={styles.copy}>{backendPendingMessage} Puedes consultar las cuentas visibles para tu sesión. La edición de roles, estado y departamento está pendiente.</Text><AppButton label="Modificar accesos · pendiente" disabled onPress={() => {}} /></View>
    <TextInput accessibilityLabel="Buscar usuarios" placeholder="Buscar por nombre o rol" style={styles.input} value={search} onChangeText={setSearch} />
    {loading ? <LoadingState /> : error ? <ErrorState description={error} onRetry={load} /> : visible.map((item) => <View style={styles.card} key={item.id}><Text style={styles.name}>{item.fullName}</Text><Text style={styles.copy}>{item.role} · {item.departmentId ? `Área ${item.departmentId}` : 'Sin departamento'}</Text></View>)}
    {!loading && !error && !visible.length && <Text style={styles.copy}>No hay cuentas con estos criterios.</Text>}
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { padding: spacing.lg, gap: spacing.md, maxWidth: 920, width: '100%', alignSelf: 'center' }, title: { color: colors.primary, fontSize: 26, fontWeight: '800' }, card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border }, name: { color: colors.text, fontSize: 17, fontWeight: '700' }, copy: { color: colors.muted, lineHeight: 21 }, input: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, color: colors.text } });
