import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { ErrorState, LoadingState } from '@/components/DataState';
import { createReport, listReportCategories, type ReportCategory } from '@/services/reports';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';

const previewCategories: ReportCategory[] = [
  { id: 1, name: 'Alumbrado público' },
  { id: 2, name: 'Agua potable' },
  { id: 3, name: 'Limpieza' },
  { id: 4, name: 'Calles y baches' },
  { id: 5, name: 'Áreas públicas' }
];

function categoryIcon(name: string): keyof typeof Ionicons.glyphMap {
  const normalized = name.toLocaleLowerCase('es-GT');
  if (normalized.includes('alumbrado')) return 'bulb-outline';
  if (normalized.includes('agua')) return 'water-outline';
  if (normalized.includes('limpieza') || normalized.includes('desecho')) return 'trash-outline';
  if (normalized.includes('calle') || normalized.includes('bache')) return 'car-outline';
  if (normalized.includes('área') || normalized.includes('parque')) return 'leaf-outline';
  return 'apps-outline';
}

export default function NewReportScreen() {
  const { role } = useSession();
  const mountedRef = useRef(true);
  const [categories, setCategories] = useState<ReportCategory[]>(isSupabaseConfigured ? [] : previewCategories);
  const [category, setCategory] = useState(isSupabaseConfigured ? '' : previewCategories[0].name);
  const [categoriesLoading, setCategoriesLoading] = useState(isSupabaseConfigured);
  const [categoriesError, setCategoriesError] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdIncident, setCreatedIncident] = useState<{ id: string; code: string } | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const applyCategories = (availableCategories: ReportCategory[]) => {
    setCategories(availableCategories);
    setCategory((current) => availableCategories.some((item) => item.name === current) ? current : availableCategories[0]?.name ?? '');
  };

  const loadCategories = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setCategoriesLoading(true);
    setCategoriesError('');
    try {
      const availableCategories = await listReportCategories();
      if (!mountedRef.current) return;
      applyCategories(availableCategories);
    } catch (error) {
      if (!mountedRef.current) return;
      setCategoriesError(error instanceof Error ? error.message : 'No fue posible consultar las categorías.');
    } finally {
      if (!mountedRef.current) return;
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!isSupabaseConfigured) return;

    let active = true;
    listReportCategories()
      .then((availableCategories) => {
        if (!active || !mountedRef.current) return;
        applyCategories(availableCategories);
      })
      .catch((error) => {
        if (!active || !mountedRef.current) return;
        setCategoriesError(error instanceof Error ? error.message : 'No fue posible consultar las categorías.');
      })
      .finally(() => {
        if (!active || !mountedRef.current) return;
        setCategoriesLoading(false);
      });

    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, []);

  const openCamera = async () => {
    if (!cameraPermission?.granted) await requestCameraPermission();
    setCameraOpen(true);
  };
  const submit = async () => {
    if (!category || !description.trim() || !location.trim()) return Alert.alert('Datos incompletos', 'Selecciona una categoría y agrega la descripción y ubicación.');
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const incident = await createReport({ categoryName: category, description, location });
      setCreatedIncident(incident);
    } catch (error) {
      Alert.alert('No fue posible registrar el reporte', error instanceof Error ? error.message : 'Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (role !== 'citizen') return <Redirect href="/(tabs)" />;

  if (createdIncident) return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, styles.confirmationPage]}>
      <View style={styles.confirmationCard}>
        <View style={styles.successSeal}><Ionicons name="checkmark" size={38} color={colors.white} /></View>
        <Text style={styles.confirmationEyebrow}>REPORTE REGISTRADO</Text>
        <Text style={styles.confirmationTitle}>Recibimos tu reporte</Text>
        <Text style={styles.confirmationCopy}>El caso quedó asociado a tu cuenta y ya puede consultarse en ZacApp.</Text>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Código de seguimiento</Text>
          <Text selectable style={styles.codeValue}>{createdIncident.code}</Text>
          <Text style={styles.codeNote}>Conserva este código para identificar tu reporte.</Text>
        </View>

        <View style={styles.confirmationSummary}>
          <View style={styles.summaryRow}><Ionicons name="apps-outline" size={19} color={colors.secondary} /><View style={styles.summaryText}><Text style={styles.summaryLabel}>Categoría</Text><Text style={styles.summaryValue}>{category}</Text></View></View>
          <View style={styles.summaryRow}><Ionicons name="location-outline" size={19} color={colors.secondary} /><View style={styles.summaryText}><Text style={styles.summaryLabel}>Ubicación</Text><Text style={styles.summaryValue}>{location}</Text></View></View>
          <View style={styles.summaryRow}><Ionicons name="time-outline" size={19} color={colors.secondary} /><View style={styles.summaryText}><Text style={styles.summaryLabel}>Estado inicial</Text><Text style={styles.summaryValue}>Registrado</Text></View></View>
        </View>

        <View style={styles.confirmationActions}>
          <AppButton label="Ver mis reportes" icon="documents-outline" onPress={() => router.replace('/reports')} />
          <AppButton label="Consultar seguimiento" variant="secondary" icon="trail-sign-outline" onPress={() => router.replace('/tracking')} />
          <AppButton label="Volver al inicio" variant="ghost" icon="home-outline" onPress={() => router.replace('/')} />
        </View>
      </View>
    </ScrollView>
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={styles.headerTop}><View style={styles.headerIcon}><Ionicons name="megaphone-outline" size={25} color={colors.primary} /></View><Text style={styles.eyebrow}>REPORTE CIUDADANO</Text></View>
        <Text style={styles.title}>Reportar incidente</Text>
        <Text style={styles.copy}>Ayúdanos a ubicar y atender una incidencia en Zacapa.</Text>
        <View style={styles.steps}>
          <View style={styles.stepActive}><Text style={styles.stepNumberActive}>1</Text><Text style={styles.stepTextActive}>Información</Text></View>
          <View style={styles.stepLine} />
          <View style={styles.step}><Text style={styles.stepNumber}>2</Text><Text style={styles.stepText}>Confirmación</Text></View>
        </View>
      </View>

      <View style={styles.form}>
        <View style={styles.sectionTitleRow}><View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>01</Text></View><View><Text style={styles.sectionTitle}>Tipo de incidencia</Text><Text style={styles.sectionCopy}>Selecciona la categoría que mejor corresponda.</Text></View></View>
        {categoriesLoading ? <LoadingState label="Consultando categorías..." /> : categoriesError ? <ErrorState description={categoriesError} onRetry={loadCategories} /> : categories.length ? <View style={styles.categories}>{categories.map((item) => {
          const selected = category === item.name;
          return <Pressable key={item.id} onPress={() => setCategory(item.name)} style={[styles.category, selected && styles.categorySelected]}><Ionicons name={categoryIcon(item.name)} size={21} color={selected ? colors.white : colors.primary} /><Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{item.name}</Text>{selected && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}</Pressable>;
        })}</View> : <ErrorState description="No hay categorías disponibles para registrar reportes." onRetry={loadCategories} />}

        <View style={styles.divider} />
        <View style={styles.sectionTitleRow}><View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>02</Text></View><View><Text style={styles.sectionTitle}>Información del caso</Text><Text style={styles.sectionCopy}>Describe el problema y dónde se encuentra.</Text></View></View>
        <View style={styles.labelRow}><Text style={styles.label}>Descripción</Text><Text style={styles.counter}>{description.length}/500</Text></View>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={500}
          placeholder="Describe qué ocurrió y alguna referencia..."
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Ubicación o referencia</Text>
        <View style={styles.inputWithIcon}><Ionicons name="location-outline" size={20} color={colors.secondary} /><TextInput style={styles.inlineInput} value={location} onChangeText={setLocation} placeholder="Barrio, calle o punto de referencia" placeholderTextColor={colors.muted} /></View>

        <View style={styles.divider} />
        <View style={styles.sectionTitleRow}><View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>03</Text></View><View><Text style={styles.sectionTitle}>Evidencia fotográfica</Text><Text style={styles.sectionCopy}>Una fotografía puede facilitar la validación.</Text></View></View>
        <Pressable style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]} onPress={openCamera}>
          <View style={styles.cameraIcon}><Ionicons name="camera-outline" size={24} color={colors.white} /></View>
          <View style={styles.cameraButtonText}>
            <Text style={styles.cameraButtonTitle}>Abrir cámara</Text>
            <Text style={styles.cameraButtonCopy}>Toma una fotografía desde el dispositivo.</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={colors.primary} />
        </Pressable>

        <View style={styles.formFooter}><View style={styles.privacyNote}><Ionicons name="shield-checkmark-outline" size={18} color={colors.secondary} /><Text style={styles.privacyText}>El reporte quedará asociado únicamente a tu cuenta.</Text></View><AppButton disabled={isSubmitting || categoriesLoading || !category} label={isSubmitting ? 'Registrando...' : 'Enviar reporte'} icon="send-outline" onPress={submit} /></View>
        <AppButton label="Cancelar" variant="ghost" icon="close-outline" onPress={() => router.back()} />
      </View>

      <Modal visible={cameraOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setCameraOpen(false)}>
        <View style={styles.cameraPage}>
          {cameraPermission?.granted ? (
            <CameraView style={styles.cameraPreview} facing="back">
              <View style={styles.cameraOverlay}>
                <Pressable style={styles.closeCamera} onPress={() => setCameraOpen(false)}>
                  <Ionicons name="close" size={24} color={colors.white} />
                  <Text style={styles.closeCameraText}>Salir</Text>
                </Pressable>
                <Pressable style={styles.shutter} onPress={() => Alert.alert('Captura no disponible', 'El almacenamiento de fotografías aún no está configurado.') }>
                  <View style={styles.shutterCenter} />
                </Pressable>
                <Text style={styles.cameraNote}>Vista previa de cámara · sin almacenamiento</Text>
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

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  header: { backgroundColor: colors.primary, borderRadius: 28, padding: spacing.xl, overflow: 'hidden' },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  headerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { fontSize: 30, fontWeight: '800', color: colors.white },
  copy: { color: '#DDE8D7', lineHeight: 21, marginTop: spacing.xs },
  steps: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', maxWidth: 420 },
  stepActive: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, opacity: 0.62 },
  stepNumberActive: { width: 26, height: 26, borderRadius: 13, textAlign: 'center', lineHeight: 26, backgroundColor: colors.accent, color: colors.primary, fontWeight: '900', overflow: 'hidden' },
  stepNumber: { width: 26, height: 26, borderRadius: 13, textAlign: 'center', lineHeight: 26, backgroundColor: 'rgba(255,255,255,0.16)', color: colors.white, fontWeight: '900', overflow: 'hidden' },
  stepTextActive: { color: colors.white, fontSize: 12, fontWeight: '800' },
  stepText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  stepLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.24)', marginHorizontal: spacing.sm },
  form: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  sectionNumber: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  sectionNumberText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sectionCopy: { color: colors.muted, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  category: { minHeight: 48, flexGrow: 1, flexBasis: 190, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  categorySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  categoryTextSelected: { color: colors.white },
  label: { color: colors.text, fontWeight: '700', marginTop: spacing.sm },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 16, color: colors.text },
  inputWithIcon: { minHeight: 52, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inlineInput: { flex: 1, minHeight: 50, fontSize: 16, color: colors.text },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  cameraButton: { minHeight: 82, backgroundColor: colors.softGreen, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cameraIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  cameraButtonText: { flex: 1 },
  cameraButtonTitle: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  cameraButtonCopy: { color: colors.muted, fontSize: 12, marginTop: spacing.xs },
  formFooter: { marginTop: spacing.md, gap: spacing.md },
  privacyNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  privacyText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 },
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
  permissionCopy: { color: colors.muted, fontSize: 16, lineHeight: 23, textAlign: 'center', marginBottom: spacing.md },
  confirmationPage: { minHeight: '100%', justifyContent: 'center' },
  confirmationCard: { width: '100%', backgroundColor: colors.white, borderRadius: 28, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  successSeal: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primary, borderWidth: 7, borderColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  confirmationEyebrow: { color: colors.secondary, fontSize: 11, fontWeight: '900', letterSpacing: 1.3, marginTop: spacing.xs },
  confirmationTitle: { color: colors.primary, fontSize: 29, fontWeight: '900', textAlign: 'center' },
  confirmationCopy: { maxWidth: 480, color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  codeCard: { width: '100%', maxWidth: 520, borderRadius: radius.xl, backgroundColor: colors.primary, padding: spacing.lg, alignItems: 'center', gap: spacing.xs },
  codeLabel: { color: '#DDE8D7', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  codeValue: { color: colors.accent, fontSize: 25, fontWeight: '900', letterSpacing: 0.8 },
  codeNote: { color: '#DDE8D7', fontSize: 12, textAlign: 'center' },
  confirmationSummary: { width: '100%', maxWidth: 520, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg },
  summaryRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryText: { flex: 1 },
  summaryLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  summaryValue: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 2 },
  confirmationActions: { width: '100%', maxWidth: 520, gap: spacing.sm, marginTop: spacing.sm }
});
