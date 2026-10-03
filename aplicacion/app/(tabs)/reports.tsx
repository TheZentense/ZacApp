import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { IncidentCard } from '@/components/IncidentCard';
import { SectionHeader } from '@/components/SectionHeader';
import { getStatusLabel } from '@/components/StatusBadge';
import { useReports } from '@/context/ReportsContext';
import { mockIncidents, statusFilterLabels } from '@/data/mockIncidents';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Incident, IncidentStatus } from '@/types/domain';
import { useSession } from '@/context/SessionContext';

type Filter = 'TODOS' | IncidentStatus;

export default function ReportsScreen() {
  const { role, department, email } = useSession();
  const { demoReports } = useReports();
  const [filter, setFilter] = useState<Filter>('TODOS');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Incident | null>(null);

  const allIncidents = useMemo(() => [...demoReports, ...mockIncidents], [demoReports]);

  const roleIncidents = useMemo(() => {
    if (role === 'admin') return allIncidents;
    if (role === 'maintenance') return allIncidents.filter((item) => item.department === department);
    return allIncidents.filter((item) => item.citizenEmail === email);
  }, [allIncidents, department, email, role]);

  const incidents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return roleIncidents.filter((item) => {
      const matchesStatus = filter === 'TODOS' || item.status === filter;
      const matchesSearch = !term || [item.code, item.title, item.category, item.location, item.citizenName, item.department].some((value) => value.toLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [filter, roleIncidents, search]);

  const heading = role === 'admin' ? 'Reportes' : role === 'maintenance' ? `Asignados · ${department}` : 'Mis reportes';
  const helper = role === 'admin'
    ? 'Lista simple para revisar, asignar o cambiar el estado de reportes.'
    : role === 'maintenance'
      ? 'Solo se muestran reportes del area asignada a esta cuenta.'
      : 'Busca tus reportes y consulta su detalle o seguimiento.';

  const showTracking = () => router.push('/tracking');
  const simulated = (message: string) => Alert.alert('Accion simulada', message);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>{selected ? 'Detalle del reporte' : heading}</Text>
        <Text style={styles.copy}>{selected ? 'Informacion principal de la incidencia seleccionada.' : helper}</Text>
      </View>

      {selected ? (
        <>
          <Pressable style={styles.backButton} onPress={() => setSelected(null)}>
            <Ionicons name="arrow-back" size={19} color={colors.primary} />
            <Text style={styles.backText}>Volver a la lista</Text>
          </Pressable>

          <IncidentCard incident={selected} showCitizen={role === 'admin'} />

          <View style={styles.detailCard}>
            <DetailRow label="Codigo" value={selected.code} />
            {role === 'admin' ? <DetailRow label="Ciudadano" value={selected.citizenName} /> : null}
            <DetailRow label="Categoria" value={selected.category} />
            <DetailRow label="Ubicacion" value={selected.location} />
            <DetailRow label="Descripcion" value={selected.description} />
            <DetailRow label="Departamento" value={selected.department} />
            <DetailRow label="Prioridad" value={selected.priority} />
            <DetailRow label="Estado" value={getStatusLabel(selected.status)} />
            <DetailRow label="Evidencia" value={selected.evidenceAttached ? 'Fotografia demo adjunta' : 'Sin evidencia adjunta'} />
          </View>

          {role === 'admin' ? (
            <View style={styles.actionsCard}>
              <SectionHeader title="Acciones administrativas" meta="Simuladas" />
              <AppButton label="Asignar" icon="git-branch-outline" onPress={() => simulated('El reporte quedaria asignado a un departamento.')} />
              <AppButton label="Cambiar estado" variant="ghost" icon="swap-horizontal-outline" onPress={() => simulated('El estado del reporte quedaria actualizado.')} />
            </View>
          ) : null}

          {role === 'maintenance' ? (
            <View style={styles.actionsCard}>
              <SectionHeader title="Acciones de mantenimiento" meta="Simuladas" />
              <AppButton label="Iniciar trabajo" icon="play-outline" onPress={() => simulated('El trabajo quedaria marcado como iniciado.')} />
              <AppButton label="Marcar en proceso" variant="ghost" icon="construct-outline" onPress={() => simulated('El reporte quedaria marcado como en proceso.')} />
              <AppButton label="Marcar atendido" variant="secondary" icon="checkmark-circle-outline" onPress={() => simulated('El reporte quedaria marcado como atendido.')} />
            </View>
          ) : null}
        </>
      ) : (
        <>
          <View style={styles.searchCard}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar por codigo, categoria, ubicacion o ciudadano"
              placeholderTextColor={colors.muted}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {statusFilterLabels.map((item) => (
                <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.filter, filter === item.key && styles.filterActive]}>
                  <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <SectionHeader title={`${incidents.length} reportes encontrados`} meta={filter === 'TODOS' ? 'Todos los estados' : getStatusLabel(filter)} />
          <View style={styles.list}>
            {incidents.map((item) => (
              <IncidentCard
                key={item.id}
                incident={item}
                compact
                showCitizen={role === 'admin'}
                actions={[
                  { label: 'Ver detalle', onPress: () => setSelected(item) },
                  ...(role === 'citizen' ? [{ label: 'Ver seguimiento', onPress: showTracking }] : []),
                  ...(role === 'admin' ? [
                    { label: 'Asignar', onPress: () => simulated('El reporte quedaria asignado.') },
                    { label: 'Cambiar estado', onPress: () => simulated('El estado quedaria actualizado.') }
                  ] : []),
                  ...(role === 'maintenance' ? [
                    { label: 'Iniciar trabajo', onPress: () => simulated('El trabajo quedaria iniciado.') },
                    { label: 'Marcar atendido', onPress: () => simulated('El reporte quedaria atendido.') }
                  ] : [])
                ]}
              />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 980, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  header: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 26, fontWeight: '800', color: colors.primary },
  copy: { color: colors.muted, marginTop: spacing.xs, lineHeight: 21 },
  searchCard: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md },
  searchInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.text },
  filters: { gap: spacing.sm },
  filter: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.muted, fontWeight: '700' },
  filterTextActive: { color: colors.white },
  list: { gap: spacing.md },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  backText: { color: colors.primary, fontWeight: '800' },
  detailCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  detailRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.secondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  detailValue: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: spacing.xs, lineHeight: 21 },
  actionsCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm }
});
