import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IncidentCard } from '@/components/IncidentCard';
import { mockIncidents } from '@/data/mockIncidents';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Incident } from '@/types/domain';
import { useSession } from '@/context/SessionContext';

type Filter = 'TODOS' | 'ACTIVOS' | 'PENDIENTES' | 'EN_PROCESO' | 'CERRADOS';
const citizenFilters: { key: Filter; label: string }[] = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'ACTIVOS', label: 'Activos' },
  { key: 'CERRADOS', label: 'Resueltos' }
];
const staffFilters: { key: Filter; label: string }[] = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'PENDIENTES', label: 'Pendientes' },
  { key: 'EN_PROCESO', label: 'En proceso' },
  { key: 'CERRADOS', label: 'Resueltos' }
];

const assigneesByDepartment: Record<string, { label: string; detail: string }[]> = {
  'Agua potable': [
    { label: 'Grupo de fugas', detail: '4 empleados' },
    { label: 'Técnico de válvulas', detail: '1 empleado' },
    { label: 'Supervisor de redes', detail: 'validación final' }
  ],
  'Alumbrado público': [
    { label: 'EEMZA · Grupo 1', detail: '4 empleados' },
    { label: 'EEMZA · Técnico individual', detail: '1 empleado' },
    { label: 'Cuadrilla nocturna', detail: '2 empleados' }
  ],
  Limpieza: [
    { label: 'Ruta centro', detail: '3 empleados' },
    { label: 'Ruta colonias', detail: '4 empleados' },
    { label: 'Supervisor de limpieza', detail: '1 empleado' }
  ],
  Secretaría: [
    { label: 'Asesoría legal', detail: '1 responsable' },
    { label: 'Mesa de expedientes', detail: '2 empleados' },
    { label: 'Secretaría municipal', detail: 'revisión interna' }
  ]
};

const municipalAreas = ['Agua potable', 'Alumbrado público', 'Limpieza', 'Secretaría'];

export default function ReportsScreen() {
  const { role, department, departmentLabel } = useSession();
  const isMaintenanceManager = role === 'maintenance_manager';
  const isMaintenanceEmployee = role === 'maintenance_employee';
  const isMaintenance = isMaintenanceManager || isMaintenanceEmployee;
  const [filter, setFilter] = useState<Filter>('TODOS');
  const [selected, setSelected] = useState<Incident | null>(null);
  const [assignedTarget, setAssignedTarget] = useState<string | null>(null);
  const incidents = useMemo(() => mockIncidents.filter((item) => {
    const belongsToDepartment = !department || item.category === department;
    const matchesFilter = filter === 'TODOS'
      || (filter === 'CERRADOS' && item.status === 'CERRADO')
      || (filter === 'ACTIVOS' && item.status !== 'CERRADO')
      || (filter === 'EN_PROCESO' && ['EN_ATENCION', 'POR_VERIFICAR'].includes(item.status))
      || (filter === 'PENDIENTES' && !['EN_ATENCION', 'POR_VERIFICAR', 'CERRADO'].includes(item.status));
    return belongsToDepartment && matchesFilter;
  }), [department, filter]);
  const heading = role === 'admin' ? 'Gestión de reportes' : isMaintenanceManager ? `Asignar · ${departmentLabel ?? department}` : isMaintenanceEmployee ? `Tareas · ${departmentLabel ?? department}` : 'Mis reportes';
  const teamOptions = selected ? assigneesByDepartment[selected.category] ?? [] : [];
  const visibleFilters = role === 'citizen' ? citizenFilters : staffFilters;

  return <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
    <View style={styles.header}>
      <Text style={styles.title}>{selected ? 'Detalle del reporte' : heading}</Text>
      <Text style={styles.copy}>{selected ? 'Información y estado actual de la incidencia seleccionada.' : isMaintenanceManager ? 'Recibe incidentes de tu departamento, filtra por estado y asigna cada tarea.' : isMaintenanceEmployee ? 'Aquí solo aparecen las tareas que te fueron asignadas dentro de tu departamento.' : role === 'admin' ? 'Administra incidencias, corrige errores y deriva cada caso al área responsable.' : 'Filtra la lista y selecciona un reporte para consultar su información.'}</Text>
    </View>
    {selected ? <>
      <Pressable style={styles.backButton} onPress={() => { setSelected(null); setAssignedTarget(null); }}><Ionicons name="arrow-back" size={19} color={colors.primary} /><Text style={styles.backText}>Volver a reportes</Text></Pressable>
      <IncidentCard incident={selected} />
      <View style={styles.detailCard}>
        <DetailRow label="Fecha de registro" value={selected.createdAt} />
        <DetailRow label="Última actualización" value={selected.updatedAt} />
        <DetailRow label="Categoría" value={selected.category} />
        <DetailRow label="Ubicación" value={selected.location} />
      </View>
      {role === 'admin' && (
        <View style={styles.workflowCard}>
          <Text style={styles.workflowTitle}>Derivar a departamento</Text>
          <Text style={styles.workflowCopy}>El administrador valida el caso y lo envía al área municipal que corresponde. No crea reportes ciudadanos desde este flujo.</Text>
          <View style={styles.chipGrid}>
            {municipalAreas.map((area) => (
              <View key={area} style={[styles.assignmentChip, area === selected.category && styles.assignmentChipActive]}>
                <Ionicons name={area === selected.category ? 'checkmark-circle' : 'business-outline'} size={18} color={area === selected.category ? colors.white : colors.primary} />
                <Text style={[styles.assignmentText, area === selected.category && styles.assignmentTextActive]}>{area}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {isMaintenanceManager && (
        <View style={styles.workflowCard}>
          <Text style={styles.workflowTitle}>Asignar a empleado o sector</Text>
          <Text style={styles.workflowCopy}>Solo el encargado del departamento puede distribuir este incidente a un grupo o responsable específico.</Text>
          <View style={styles.chipGrid}>
            {teamOptions.map((employee) => (
              <Pressable key={employee.label} style={[styles.assignmentChip, assignedTarget === employee.label && styles.assignmentChipActive]} onPress={() => setAssignedTarget(employee.label)}>
                <Ionicons name={assignedTarget === employee.label ? 'checkmark-circle' : 'people-outline'} size={18} color={assignedTarget === employee.label ? colors.white : colors.primary} />
                <View>
                  <Text style={[styles.assignmentText, assignedTarget === employee.label && styles.assignmentTextActive]}>{employee.label}</Text>
                  <Text style={[styles.assignmentDetail, assignedTarget === employee.label && styles.assignmentTextActive]}>{employee.detail}</Text>
                </View>
              </Pressable>
            ))}
          </View>
          <View style={styles.nextStep}>
            <Ionicons name="git-branch-outline" size={19} color={colors.secondary} />
            <Text style={styles.nextStepText}>{assignedTarget ? `Asignado a ${assignedTarget}. Queda listo para que el empleado o grupo actualice avance.` : 'Selecciona un grupo o empleado para continuar la atención.'}</Text>
          </View>
        </View>
      )}
      {isMaintenanceEmployee && (
        <View style={styles.workflowCard}>
          <Text style={styles.workflowTitle}>Tarea recibida</Text>
          <Text style={styles.workflowCopy}>Este usuario no puede reasignar ni administrar reportes. Solo consulta la tarea enviada por su encargado y actualiza el avance correspondiente.</Text>
          <View style={styles.nextStep}>
            <Ionicons name="construct-outline" size={19} color={colors.secondary} />
            <Text style={styles.nextStepText}>Responsable actual: empleado del departamento {departmentLabel ?? department}.</Text>
          </View>
        </View>
      )}
    </> : <>
      <View style={styles.filters}>{visibleFilters.map((item) => <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.filter, filter === item.key && styles.filterActive]}><Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</View>
      <Text style={styles.resultCount}>{incidents.length} reportes encontrados</Text>
      <View style={styles.list}>{incidents.map((item) => <IncidentCard key={item.id} incident={item} compact onPress={() => setSelected(item)} />)}</View>
      {incidents.length === 0 && <Text style={styles.empty}>No hay incidentes para este filtro.</Text>}
    </>}
  </ScrollView>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  header: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 28, fontWeight: '800', color: colors.primary },
  copy: { color: colors.muted, marginTop: spacing.xs, lineHeight: 21 },
  filters: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  filter: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.muted, fontWeight: '700' },
  filterTextActive: { color: colors.white },
  resultCount: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  list: { gap: spacing.md },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  backText: { color: colors.primary, fontWeight: '800' },
  detailCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  detailRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.secondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  detailValue: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: spacing.xs },
  workflowCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  workflowTitle: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  workflowCopy: { color: colors.muted, lineHeight: 20 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  assignmentChip: { minHeight: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.softGreen, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  assignmentChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  assignmentText: { color: colors.primary, fontWeight: '800' },
  assignmentDetail: { color: colors.muted, fontSize: 12, marginTop: 2 },
  assignmentTextActive: { color: colors.white },
  nextStep: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  nextStepText: { flex: 1, color: colors.text, fontWeight: '600', lineHeight: 20 },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: spacing.xl }
});
