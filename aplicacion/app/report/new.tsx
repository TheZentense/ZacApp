import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { getPriorityLabel, getStatusLabel } from '@/components/StatusBadge';
import { useReports } from '@/context/ReportsContext';
import { useSession } from '@/context/SessionContext';
import { demoProfileByEmail } from '@/data/mockIncidents';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Incident, IncidentPriority } from '@/types/domain';

const categories = ['Agua potable', 'Alumbrado público', 'Drenajes', 'Desechos sólidos', 'Calles', 'Áreas públicas'];

const priorityOptions: { key: IncidentPriority; label: string }[] = [
  { key: 'BAJA', label: 'Baja' },
  { key: 'MEDIA', label: 'Media' },
  { key: 'ALTA', label: 'Alta' },
  { key: 'URGENTE', label: 'Urgente' }
];

type FormErrors = Partial<Record<'category' | 'description' | 'location' | 'priority', string>>;

export default function NewReportScreen() {
  const { addDemoReport } = useReports();
  const { email } = useSession();
  const profile = demoProfileByEmail[email as keyof typeof demoProfileByEmail] ?? demoProfileByEmail['ciudadano@zacapp.gt'];
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<IncidentPriority>('MEDIA');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [evidenceAttached, setEvidenceAttached] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<Incident | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const openCamera = async () => {
    if (!cameraPermission?.granted) await requestCameraPermission();
    setCameraOpen(true);
  };

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!category) nextErrors.category = 'Selecciona una categoria.';
    if (!description.trim()) nextErrors.description = 'Completa la descripcion antes de enviar el reporte.';
    if (!location.trim()) nextErrors.location = 'Completa la ubicacion antes de enviar el reporte.';
    if (!priority) nextErrors.priority = 'Selecciona una prioridad.';
    setErrors(nextErrors);
    return nextErrors;
  };

  const submit = () => {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      Alert.alert('Campos obligatorios', 'Completa los campos obligatorios antes de enviar el reporte.');
      return;
    }

    const report = addDemoReport({
      category,
      description,
      location,
      priority,
      citizenEmail: email,
      citizenName: profile.name,
      evidenceAttached
    });
    setSubmittedReport(report);
  };

  const resetForm = () => {
    setCategory('');
    setPriority('MEDIA');
    setDescription('');
    setLocation('');
    setEvidenceAttached(false);
    setErrors({});
    setSubmittedReport(null);
  };

  if (submittedReport) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
        <View style={styles.confirmation}>
          <View style={styles.confirmIcon}>
            <Ionicons name="checkmark" size={28} color={colors.white} />
          </View>
          <Text style={styles.confirmTitle}>Reporte enviado correctamente</Text>
          <Text style={styles.confirmCopy}>Tu reporte fue creado en modo demostracion.</Text>

          <View style={styles.confirmDetails}>
            <SummaryRow label="Codigo" value={submittedReport.code} />
            <SummaryRow label="Estado" value={getStatusLabel(submittedReport.status)} />
            <SummaryRow label="Fecha" value={submittedReport.createdAt} />
            <SummaryRow label="Departamento responsable" value={submittedReport.department} />
            <SummaryRow label="Evidencia" value={submittedReport.evidenceAttached ? 'Fotografia demo adjunta' : 'Sin evidencia adjunta'} />
          </View>

          <AppButton label="Ver mis reportes" icon="document-text-outline" onPress={() => router.replace('/(tabs)/reports' as never)} />
          <AppButton label="Crear otro reporte" variant="ghost" icon="add-circle-outline" onPress={resetForm} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Reportar incidente</Text>
        <Text style={styles.copy}>Completa la información principal para registrar la incidencia.</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Categoría</Text>
        <View style={styles.categoryGrid}>
          {categories.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              style={[styles.categoryChip, category === item && styles.categoryChipActive]}
              onPress={() => {
                setCategory(item);
                setErrors((current) => ({ ...current, category: undefined }));
              }}
            >
              <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}

        <Text style={styles.label}>Descripción</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={(value) => {
            setDescription(value);
            if (value.trim()) setErrors((current) => ({ ...current, description: undefined }));
          }}
          multiline
          maxLength={300}
          placeholder="Describe qué ocurrió y alguna referencia..."
          placeholderTextColor={colors.muted}
        />
        <View style={styles.counterRow}>
          {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : <View />}
          <Text style={styles.counter}>{description.length} / 300</Text>
        </View>

        <Text style={styles.label}>Ubicación o referencia</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={(value) => {
            setLocation(value);
            if (value.trim()) setErrors((current) => ({ ...current, location: undefined }));
          }}
          placeholder="Barrio, calle o punto de referencia"
          placeholderTextColor={colors.muted}
        />
        {errors.location ? <Text style={styles.errorText}>{errors.location}</Text> : null}
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}
          onPress={() => {
            setLocation('Ubicación actual - Zacapa');
            setErrors((current) => ({ ...current, location: undefined }));
          }}
        >
          <Ionicons name="location-outline" size={18} color={colors.primary} />
          <Text style={styles.locationButtonText}>Usar ubicación actual</Text>
        </Pressable>

        <Text style={styles.label}>Prioridad</Text>
        <View style={styles.priorityRow}>
          {priorityOptions.map((item) => (
            <Pressable key={item.key} accessibilityRole="button" style={[styles.priorityChip, priority === item.key && styles.priorityChipActive]} onPress={() => setPriority(item.key)}>
              <Text style={[styles.priorityText, priority === item.key && styles.priorityTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        {errors.priority ? <Text style={styles.errorText}>{errors.priority}</Text> : null}

        <Text style={styles.label}>Evidencia fotográfica</Text>
        {evidenceAttached ? (
          <View style={styles.evidencePreview}>
            <View style={styles.evidenceIcon}>
              <Ionicons name="image-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.evidenceText}>
              <Text style={styles.evidenceTitle}>Evidencia demo adjunta</Text>
              <Text style={styles.evidenceCopy}>La fotografía es opcional en esta etapa.</Text>
            </View>
            <Pressable accessibilityRole="button" style={styles.removeEvidence} onPress={() => setEvidenceAttached(false)}>
              <Text style={styles.removeEvidenceText}>Quitar evidencia</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]} onPress={openCamera}>
            <Ionicons name="camera-outline" size={22} color={colors.primary} />
            <View style={styles.cameraButtonText}>
              <Text style={styles.cameraButtonTitle}>Abrir cámara</Text>
              <Text style={styles.cameraButtonCopy}>Abre la cámara para adjuntar evidencia al reporte.</Text>
            </View>
          </Pressable>
        )}

        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Resumen</Text>
          <SummaryRow label="Categoría" value={category || 'Sin seleccionar'} />
          <SummaryRow label="Ubicación" value={location || 'Sin completar'} />
          <SummaryRow label="Prioridad" value={getPriorityLabel(priority)} />
        </View>

        <AppButton label="Enviar reporte" icon="send-outline" onPress={submit} />
        <AppButton label="Cancelar" variant="ghost" onPress={() => router.back()} />
      </View>

      <Modal visible={cameraOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setCameraOpen(false)}>
        <View style={styles.cameraPage}>
          {cameraPermission?.granted ? (
            <CameraView style={styles.cameraPreview} facing="back">
              <View style={styles.cameraOverlay}>
                <Pressable accessibilityRole="button" style={styles.closeCamera} onPress={() => setCameraOpen(false)}>
                  <Ionicons name="close" size={24} color={colors.white} />
                  <Text style={styles.closeCameraText}>Salir</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={styles.shutter}
                  onPress={() => {
                    setEvidenceAttached(true);
                    setCameraOpen(false);
                  }}
                >
                  <View style={styles.shutterCenter} />
                </Pressable>
                <Text style={styles.cameraNote}>Vista previa de cámara · evidencia demo</Text>
              </View>
            </CameraView>
          ) : (
            <View style={styles.permissionPage}>
              <Ionicons name="camera-outline" size={52} color={colors.primary} />
              <Text style={styles.permissionTitle}>Acceso a la cámara</Text>
              <Text style={styles.permissionCopy}>ZacApp necesita permiso para utilizar la cámara del dispositivo.</Text>
              <AppButton label="Permitir cámara" icon="camera-outline" onPress={requestCameraPermission} />
              <AppButton label="Salir" variant="ghost" onPress={() => setCameraOpen(false)} />
            </View>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  header: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 28, fontWeight: '800', color: colors.primary },
  copy: { color: colors.muted, lineHeight: 21, marginTop: spacing.xs },
  form: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.text, fontWeight: '700', marginTop: spacing.sm },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 16, color: colors.text },
  multiline: { minHeight: 108, textAlignVertical: 'top' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryChip: { flexGrow: 1, flexBasis: 150, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  categoryChipActive: { backgroundColor: colors.softGreen, borderColor: colors.primary },
  categoryText: { color: colors.muted, fontWeight: '800', textAlign: 'center' },
  categoryTextActive: { color: colors.primary },
  counterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  counter: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  locationButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  locationButtonText: { color: colors.primary, fontWeight: '800' },
  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  priorityChip: { flexGrow: 1, flexBasis: 120, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  priorityChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  priorityText: { color: colors.muted, fontWeight: '800', textAlign: 'center' },
  priorityTextActive: { color: colors.white },
  cameraButton: { minHeight: 72, backgroundColor: colors.softGreen, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cameraButtonText: { flex: 1 },
  cameraButtonTitle: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  cameraButtonCopy: { color: colors.muted, fontSize: 12, marginTop: spacing.xs },
  evidencePreview: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  evidenceIcon: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  evidenceText: { flex: 1, minWidth: 180 },
  evidenceTitle: { color: colors.primary, fontWeight: '800' },
  evidenceCopy: { color: colors.muted, fontSize: 12, marginTop: 2 },
  removeEvidence: { paddingVertical: spacing.sm },
  removeEvidenceText: { color: colors.danger, fontWeight: '800' },
  summary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, marginTop: spacing.sm },
  summaryTitle: { color: colors.primary, fontSize: 16, fontWeight: '800', marginBottom: spacing.xs },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  summaryLabel: { color: colors.secondary, fontWeight: '800' },
  summaryValue: { flex: 1, color: colors.text, fontWeight: '600', textAlign: 'right' },
  confirmation: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  confirmIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  confirmTitle: { color: colors.primary, fontSize: 24, fontWeight: '800' },
  confirmCopy: { color: colors.muted, lineHeight: 21 },
  confirmDetails: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.xs },
  pressed: { opacity: 0.8 },
  cameraPage: { flex: 1, backgroundColor: '#000000' },
  cameraPreview: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: 54, paddingBottom: 36, backgroundColor: 'rgba(0,0,0,0.12)' },
  closeCamera: { alignSelf: 'flex-end', backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: radius.pill, paddingHorizontal: spacing.md, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  closeCameraText: { color: colors.white, fontWeight: '800' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', marginTop: 'auto' },
  shutterCenter: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.white },
  cameraNote: { color: colors.white, backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.lg, overflow: 'hidden' },
  permissionPage: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
  permissionTitle: { color: colors.primary, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  permissionCopy: { color: colors.muted, fontSize: 16, lineHeight: 23, textAlign: 'center', marginBottom: spacing.md }
});
