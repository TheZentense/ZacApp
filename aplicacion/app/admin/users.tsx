import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { ErrorState, LoadingState } from '@/components/DataState';
import { useSession } from '@/context/SessionContext';
import { listDepartments, type ReportDepartment } from '@/services/reports';
import { listManagedUsers, updateManagedUser, type ManagedUser } from '@/services/users';
import { colors, radius, spacing } from '@/theme/tokens';
import type { UserRole } from '@/types/domain';

const roles: { value: UserRole; label: string }[] = [
  { value: 'ciudadano', label: 'Ciudadano' }, { value: 'operador', label: 'Operador' },
  { value: 'coordinador', label: 'Coordinador' }, { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'comunicacion', label: 'Comunicación' }
];

export default function UsersScreen() {
  const { databaseRole } = useSession();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [departments, setDepartments] = useState<ReportDepartment[]>([]);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('ciudadano');
  const [selectedStatus, setSelectedStatus] = useState<'ACTIVO' | 'INACTIVO'>('ACTIVO');
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const [userResult, departmentResult] = await Promise.allSettled([listManagedUsers(), listDepartments()]);
    if (userResult.status === 'fulfilled') setUsers(userResult.value); else setError('No fue posible consultar los usuarios.');
    if (departmentResult.status === 'fulfilled') setDepartments(departmentResult.value);
    setLoading(false);
  }, []);

  useEffect(() => { if (databaseRole !== 'administrador') return; const timer = setTimeout(load, 0); return () => clearTimeout(timer); }, [databaseRole, load]);
  const filteredUsers = useMemo(() => users.filter((item) => !search.trim() || item.fullName.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))), [search, users]);
  if (databaseRole !== 'administrador') return <Redirect href="/(tabs)" />;

  const openUser = (user: ManagedUser) => { setSelected(user); setSelectedRole(user.role); setSelectedStatus(user.status); setSelectedDepartment(user.departmentId); setError(''); setMessage(''); };
  const save = async () => {
    if (!selected || saving) return;
    try { setSaving(true); setError(''); setMessage(''); await updateManagedUser({ id: selected.id, role: selectedRole, status: selectedStatus, departmentId: selectedDepartment }); setMessage('La cuenta se actualizó correctamente.'); await load(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'No fue posible actualizar la cuenta.'); }
    finally { setSaving(false); }
  };

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable style={styles.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={20} color={colors.white} /></Pressable><View style={styles.headerText}><Text style={styles.eyebrow}>SUPERADMINISTRACIÓN · ACCESOS</Text><Text style={styles.title}>Usuarios y personal</Text><Text style={styles.copy}>Asigna funciones y departamentos sin exponer credenciales.</Text></View><View style={styles.count}><Text style={styles.countValue}>{users.length}</Text><Text style={styles.countLabel}>cuentas</Text></View></View>
    {selected ? <><Pressable style={styles.returnButton} onPress={() => setSelected(null)}><Ionicons name="arrow-back" size={18} color={colors.primary} /><Text style={styles.returnText}>Volver a usuarios</Text></Pressable><View style={styles.editor}>
      <View><Text style={styles.editorTitle}>{selected.fullName}</Text><Text style={styles.editorMeta}>Registrado el {selected.createdAt}</Text></View>
      {selected.role === 'administrador' ? <View style={styles.protectedBox}><Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} /><Text style={styles.protectedText}>Esta cuenta administrativa está protegida y no puede modificarse desde esta pantalla.</Text></View> : <><Text style={styles.label}>Rol</Text><View style={styles.options}>{roles.map((item) => <Pressable key={item.value} onPress={() => setSelectedRole(item.value)} style={[styles.option, selectedRole === item.value && styles.optionActive]}><Text style={[styles.optionText, selectedRole === item.value && styles.optionTextActive]}>{item.label}</Text></Pressable>)}</View>
      {selectedRole !== 'ciudadano' && <><Text style={styles.label}>Departamento</Text><View style={styles.options}>{departments.map((item) => <Pressable key={item.id} onPress={() => setSelectedDepartment(item.id)} style={[styles.option, selectedDepartment === item.id && styles.optionActive]}><Text style={[styles.optionText, selectedDepartment === item.id && styles.optionTextActive]}>{item.name}</Text></Pressable>)}</View></>}
      <Text style={styles.label}>Estado de la cuenta</Text><View style={styles.options}>{(['ACTIVO', 'INACTIVO'] as const).map((item) => <Pressable key={item} onPress={() => setSelectedStatus(item)} style={[styles.option, selectedStatus === item && styles.optionActive]}><Text style={[styles.optionText, selectedStatus === item && styles.optionTextActive]}>{item === 'ACTIVO' ? 'Activo' : 'Inactivo'}</Text></Pressable>)}</View>
      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}{message ? <View style={styles.successBox}><Text style={styles.successText}>{message}</Text></View> : null}<AppButton label={saving ? 'Guardando...' : 'Guardar cambios'} icon="save-outline" disabled={saving} onPress={save} /></>}
    </View></> : <><View style={styles.search}><Ionicons name="search-outline" size={19} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Buscar por nombre" placeholderTextColor={colors.muted} style={styles.searchInput} /></View>{loading ? <LoadingState label="Consultando usuarios..." /> : error ? <ErrorState description={error} onRetry={load} /> : <View style={styles.list}>{filteredUsers.map((item) => <Pressable key={item.id} style={styles.userCard} onPress={() => openUser(item)}><View style={styles.avatar}><Text style={styles.avatarText}>{item.fullName.slice(0, 2).toUpperCase()}</Text></View><View style={styles.userMain}><Text style={styles.userName}>{item.fullName}</Text><Text style={styles.userMeta}>{item.role} · {item.departmentName ?? 'Sin departamento'}</Text></View><View style={[styles.status, item.status === 'INACTIVO' && styles.statusInactive]}><Text style={[styles.statusText, item.status === 'INACTIVO' && styles.statusTextInactive]}>{item.status === 'ACTIVO' ? 'Activo' : 'Inactivo'}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable>)}</View>}</>}
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { width: '100%', maxWidth: 920, alignSelf: 'center', padding: spacing.lg, gap: spacing.md }, header: { backgroundColor: '#0C1B1F', borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }, back: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }, headerText: { flex: 1, minWidth: 230 }, eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { color: colors.white, fontSize: 25, fontWeight: '800', marginTop: spacing.xs }, copy: { color: '#DDE8D7', marginTop: spacing.xs }, count: { minWidth: 86, alignItems: 'center', padding: spacing.sm, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.10)' }, countValue: { color: colors.accent, fontSize: 24, fontWeight: '900' }, countLabel: { color: colors.white, fontSize: 11 }, search: { minHeight: 50, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, searchInput: { flex: 1, color: colors.text, fontSize: 15 }, list: { gap: spacing.sm }, userCard: { minHeight: 78, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.primary, fontWeight: '900' }, userMain: { flex: 1 }, userName: { color: colors.text, fontSize: 15, fontWeight: '800' }, userMeta: { color: colors.muted, fontSize: 12, marginTop: 3, textTransform: 'capitalize' }, status: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.softGreen }, statusInactive: { backgroundColor: colors.dangerSoft }, statusText: { color: colors.primary, fontSize: 11, fontWeight: '800' }, statusTextInactive: { color: colors.danger }, returnButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm }, returnText: { color: colors.primary, fontWeight: '800' }, editor: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md }, editorTitle: { color: colors.text, fontSize: 21, fontWeight: '800' }, editorMeta: { color: colors.muted, marginTop: 3 }, label: { color: colors.text, fontSize: 13, fontWeight: '800' }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, option: { minHeight: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' }, optionActive: { backgroundColor: colors.primary, borderColor: colors.primary }, optionText: { color: colors.text, fontWeight: '700' }, optionTextActive: { color: colors.white }, protectedBox: { borderRadius: radius.md, backgroundColor: colors.softGreen, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, protectedText: { flex: 1, color: colors.primary, fontWeight: '700', lineHeight: 19 }, errorBox: { borderRadius: radius.md, backgroundColor: colors.dangerSoft, padding: spacing.md }, errorText: { color: colors.danger, fontWeight: '700' }, successBox: { borderRadius: radius.md, backgroundColor: colors.softGreen, padding: spacing.md }, successText: { color: colors.primary, fontWeight: '700' } });
