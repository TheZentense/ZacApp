import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { ErrorState, LoadingState } from '@/components/DataState';
import { createReport, listReportCategories, type ReportCategory, type ReportEvidenceInput } from '@/services/reports';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, radius, spacing } from '@/theme/tokens';
import { useSession } from '@/context/SessionContext';
import { optimizeEvidence, selectEvidenceImages } from '@/services/evidenceImages';
import { TurnstileChallenge } from '@/components/TurnstileChallenge';
import { guestReportProtectionEnabled } from '@/lib/guestReportSecurity';

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
  const { role, email, fullName, isAuthenticated, isGuest, isLoading, isPasswordRecovery, signInAsGuest } = useSession();
  const mountedRef = useRef(true);
  const [categories, setCategories] = useState<ReportCategory[]>(isSupabaseConfigured ? [] : previewCategories);
  const [category, setCategory] = useState(isSupabaseConfigured ? '' : previewCategories[0].name);
  const [categoriesLoading, setCategoriesLoading] = useState(isSupabaseConfigured);
  const [categoriesError, setCategoriesError] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number; accuracy: number | null } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [evidence, setEvidence] = useState<ReportEvidenceInput[]>([]);
  const cameraRef = useRef<CameraView>(null);
  const requestInFlight = useRef(false);
  const imageInFlight = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdIncident, setCreatedIncident] = useState<{ id: string; code: string } | null>(null);
  const createdIncidentRef = useRef<{ id: string; code: string } | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const captchaSiteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
  const captchaRequired = Boolean(captchaSiteKey);
  const isAnonymousReport = isGuest || !isAuthenticated;
  const protectedGuestFlow = isSupabaseConfigured && isAnonymousReport && guestReportProtectionEnabled();
  const captchaAction = protectedGuestFlow && isAuthenticated ? 'zacapp_reporte_envio' : 'zacapp_reporte_anonimo';
  const maxEvidence = isAnonymousReport ? 3 : 5;
  const resetCaptcha = () => { setCaptchaToken(''); setCaptchaResetKey((value) => value + 1); };

  const captureLocation = async () => {
    if (isLocating || requestInFlight.current) return;
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Permite el acceso a la ubicación para registrar el punto exacto del incidente.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (!mountedRef.current) return;
      setCoordinates({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        accuracy: current.coords.accuracy
      });
    } catch {
      if (mountedRef.current) Alert.alert('No fue posible obtener la ubicación', 'Activa el GPS y vuelve a intentarlo en un lugar con mejor señal.');
    } finally {
      if (mountedRef.current) setIsLocating(false);
    }
  };

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
    if (!isSupabaseConfigured) return () => { mountedRef.current = false; };

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
    if (requestInFlight.current || imageInFlight.current) return;
    imageInFlight.current = true;
    try {
      const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
      if (!mountedRef.current) return;
      if (!permission.granted) return Alert.alert('Permiso requerido', 'Permite el acceso a la cámara para tomar una fotografía.');
      setCameraReady(false); setCameraOpen(true);
    } finally { imageInFlight.current = false; }
  };

  const captureEvidence = async () => {
    if (!cameraRef.current || !cameraReady || imageInFlight.current || requestInFlight.current) return;
    imageInFlight.current = true;
    setIsCapturing(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!picture?.uri) throw new Error('La cámara no devolvió una fotografía.');
      const optimized = await optimizeEvidence(picture.uri);
      if (mountedRef.current) { setEvidence((current) => current.length < maxEvidence ? [...current, optimized] : current); setCameraOpen(false); }
    } catch {
      if (mountedRef.current) Alert.alert('No fue posible tomar la fotografía', 'Intenta nuevamente.');
    } finally { imageInFlight.current = false; if (mountedRef.current) setIsCapturing(false); }
  };

  const selectEvidence = async () => {
    if (requestInFlight.current || imageInFlight.current) return;
    imageInFlight.current = true;
    setIsCapturing(true);
    try {
      const selectedImages = await selectEvidenceImages(maxEvidence - evidence.length);
      if (mountedRef.current && selectedImages.length) setEvidence((current) => [...current, ...selectedImages].slice(0, maxEvidence));
    } catch {
      if (mountedRef.current) Alert.alert('No fue posible preparar la fotografía', 'Selecciona otra imagen e intenta nuevamente.');
    } finally { imageInFlight.current = false; if (mountedRef.current) setIsCapturing(false); }
  };

  const submit = async () => {
    if (requestInFlight.current || imageInFlight.current || createdIncidentRef.current) return;
    const selectedCategory = categories.find((item) => item.name === category);
    if (isAuthenticated && !isGuest && (!fullName.trim() || !email.trim())) return Alert.alert('Perfil incompleto', 'Tu cuenta necesita nombre y correo antes de registrar un reporte.');
    if (!selectedCategory || description.trim().length < 10 || !location.trim()) return Alert.alert('Datos incompletos', 'Selecciona una categoría y agrega una descripción de al menos 10 caracteres y una referencia.');
    if (!coordinates) return Alert.alert('GPS requerido', 'Obtén la ubicación exacta del incidente antes de enviar.');
    if (!evidence.length) return Alert.alert('Fotografía requerida', 'Toma o selecciona al menos una fotografía del incidente antes de enviar.');
    if (protectedGuestFlow && !captchaSiteKey) return Alert.alert('Verificación no disponible', 'Este dispositivo todavía no tiene configurada la verificación de reportes invitados.');
    if ((!isAuthenticated || protectedGuestFlow) && captchaRequired && !captchaToken) return Alert.alert('Verificación requerida', 'Confirma que eres una persona antes de enviar el reporte.');
    requestInFlight.current = true;
    setIsSubmitting(true);
    try {
      if (!isAuthenticated) {
        await signInAsGuest(captchaToken || undefined);
        if (protectedGuestFlow) {
          if (mountedRef.current) Alert.alert('Sesión invitada lista', 'Completa una verificación nueva para enviar este reporte.');
          return;
        }
      }
      const incident = await createReport({
        categoryId: selectedCategory.id,
        description,
        location,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        evidence,
        turnstileToken: protectedGuestFlow ? captchaToken : undefined
      });
      // Keep the identifier immediately, including for already queued submit handlers.
      createdIncidentRef.current = incident;
      if (mountedRef.current) setCreatedIncident(incident);
    } catch (error) {
      if (mountedRef.current) Alert.alert('No fue posible registrar el reporte', error instanceof Error ? error.message : 'Revisa los datos y la conexión antes de intentar nuevamente.');
    } finally {
      requestInFlight.current = false;
      if (mountedRef.current) {
        setIsSubmitting(false);
        if (captchaRequired && (protectedGuestFlow || !createdIncidentRef.current)) resetCaptcha();
      }
    }
  };

  if (isLoading) return <LoadingState label="Verificando sesión..." />;
  if (isPasswordRecovery) return <Redirect href="/reset-password" />;
  if (isAuthenticated && role !== 'citizen') return <Redirect href="/(tabs)" />;

  if (createdIncident) return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, styles.confirmationPage]}>
      <View style={styles.confirmationCard}>
        <View style={styles.successSeal}><Ionicons name="checkmark" size={38} color={colors.white} /></View>
        <Text style={styles.confirmationEyebrow}>REPORTE REGISTRADO</Text>
        <Text style={styles.confirmationTitle}>Recibimos tu reporte</Text>
        <Text style={styles.confirmationCopy}>{isAnonymousReport ? 'El caso quedó asociado a esta sesión anónima. Conserva el código; puedes crear una cuenta para mantener el seguimiento aunque cambies de dispositivo.' : 'El caso quedó asociado a tu cuenta y ya puede consultarse en ZacApp.'}</Text>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Código de seguimiento</Text>
          <Text selectable style={styles.codeValue}>{createdIncident.code}</Text>
          <Text style={styles.codeNote}>Conserva este código para identificar tu reporte.</Text>
        </View>

        <View style={styles.confirmationSummary}>
          <View style={styles.summaryRow}><Ionicons name="apps-outline" size={19} color={colors.secondary} /><View style={styles.summaryText}><Text style={styles.summaryLabel}>Categoría</Text><Text style={styles.summaryValue}>{category}</Text></View></View>
          <View style={styles.summaryRow}><Ionicons name="location-outline" size={19} color={colors.secondary} /><View style={styles.summaryText}><Text style={styles.summaryLabel}>Ubicación</Text><Text style={styles.summaryValue}>{location}</Text></View></View>
          {coordinates && <View style={styles.summaryRow}><Ionicons name="navigate-outline" size={19} color={colors.secondary} /><View style={styles.summaryText}><Text style={styles.summaryLabel}>Coordenadas GPS</Text><Text style={styles.summaryValue}>{coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}</Text></View></View>}
          <View style={styles.summaryRow}><Ionicons name="time-outline" size={19} color={colors.secondary} /><View style={styles.summaryText}><Text style={styles.summaryLabel}>Estado inicial</Text><Text style={styles.summaryValue}>Registrado</Text></View></View>
          {evidence.length > 0 && <View style={styles.summaryRow}><Ionicons name="images-outline" size={19} color={colors.secondary} /><View style={styles.summaryText}><Text style={styles.summaryLabel}>Evidencia</Text><Text style={styles.summaryValue}>{evidence.length} {evidence.length === 1 ? 'fotografía adjunta' : 'fotografías adjuntas'}</Text></View></View>}
        </View>

        <View style={styles.confirmationActions}>
          {isAnonymousReport && <AppButton label="Crear cuenta y conservar seguimiento" icon="person-add-outline" onPress={() => router.push('/register')} />}
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
        <View style={styles.sectionTitleRow}><View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>01</Text></View><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{isAnonymousReport ? 'Reporte anónimo' : 'Datos del ciudadano'}</Text><Text style={styles.sectionCopy}>{isAnonymousReport ? 'No necesitas proporcionar nombre ni correo electrónico.' : 'Se obtienen de la cuenta con la sesión iniciada.'}</Text></View></View>
        {isAnonymousReport ? <View style={styles.guestIdentityForm}>
          <View style={styles.anonymousIdentity}><View style={styles.identityIcon}><Ionicons name="person-outline" size={22} color={colors.white} /></View><View style={styles.identityText}><Text style={styles.identityName}>Continuar sin cuenta</Text><Text style={styles.identityEmail}>El reporte no solicitará datos de contacto.</Text></View><Ionicons name="shield-checkmark-outline" size={22} color={colors.secondary} /></View>
          <View style={styles.guestLimitNote}><Ionicons name="time-outline" size={18} color={colors.secondary} /><Text style={styles.guestLimitText}>Puedes enviar hasta cinco reportes cada 24 horas, con al menos 15 minutos entre cada uno.</Text></View>
        </View> : <View style={styles.identityCard}>
          <View style={styles.identityIcon}><Ionicons name="person-outline" size={22} color={colors.white} /></View>
          <View style={styles.identityText}><Text style={styles.identityName}>{fullName || 'Nombre pendiente'}</Text><Text style={styles.identityEmail}>{email || 'Correo pendiente'}</Text></View>
          <Ionicons name={fullName && email ? 'checkmark-circle' : 'alert-circle'} size={22} color={fullName && email ? colors.secondary : colors.danger} />
        </View>}

        <View style={styles.divider} />
        <View style={styles.sectionTitleRow}><View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>02</Text></View><View><Text style={styles.sectionTitle}>Tipo de incidencia</Text><Text style={styles.sectionCopy}>Selecciona la categoría que mejor corresponda.</Text></View></View>
        {categoriesLoading ? <LoadingState label="Consultando categorías..." /> : categoriesError ? <ErrorState description={categoriesError} onRetry={loadCategories} /> : categories.length ? <View style={styles.categories}>{categories.map((item) => {
          const selected = category === item.name;
          return <Pressable key={item.id} disabled={isSubmitting} onPress={() => setCategory(item.name)} style={[styles.category, selected && styles.categorySelected]}><Ionicons name={categoryIcon(item.name)} size={21} color={selected ? colors.white : colors.primary} /><Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{item.name}</Text>{selected && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}</Pressable>;
        })}</View> : <ErrorState description="No hay categorías disponibles para registrar reportes." onRetry={loadCategories} />}

        <View style={styles.divider} />
        <View style={styles.sectionTitleRow}><View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>03</Text></View><View><Text style={styles.sectionTitle}>Información y ubicación</Text><Text style={styles.sectionCopy}>Describe el problema y registra el punto exacto.</Text></View></View>
        <View style={styles.labelRow}><Text style={styles.label}>Descripción</Text><Text style={styles.counter}>{description.length}/500</Text></View>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          editable={!isSubmitting}
          multiline
          maxLength={500}
          placeholder="Describe qué ocurrió y alguna referencia..."
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Ubicación o referencia</Text>
        <View style={styles.inputWithIcon}><Ionicons name="location-outline" size={20} color={colors.secondary} /><TextInput style={styles.inlineInput} value={location} editable={!isSubmitting} onChangeText={setLocation} placeholder="Barrio, calle o punto de referencia" placeholderTextColor={colors.muted} /></View>

        <Pressable style={[styles.locationCard, coordinates && styles.locationCardReady]} disabled={isSubmitting || isLocating} onPress={captureLocation}>
          <View style={[styles.locationIcon, coordinates && styles.locationIconReady]}><Ionicons name={coordinates ? 'checkmark' : 'navigate-outline'} size={22} color={colors.white} /></View>
          <View style={styles.locationText}>
            <Text style={styles.locationTitle}>{coordinates ? 'Ubicación GPS registrada' : 'Obtener ubicación GPS'}</Text>
            <Text style={styles.locationCopy}>{isLocating ? 'Buscando señal...' : coordinates ? `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}${coordinates.accuracy ? ` · precisión aproximada ${Math.round(coordinates.accuracy)} m` : ''}` : 'Es obligatoria y se solicitará permiso al dispositivo.'}</Text>
          </View>
          <Ionicons name={coordinates ? 'refresh-outline' : 'arrow-forward'} size={19} color={colors.primary} />
        </Pressable>

        <View style={styles.divider} />
        <View style={styles.sectionTitleRow}><View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>04</Text></View><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Evidencia fotográfica</Text><Text style={styles.sectionCopy}>Agrega de 1 a {maxEvidence} fotografías. La primera será la evidencia inicial.</Text></View><View style={styles.evidenceCount}><Text style={styles.evidenceCountText}>{evidence.length}/{maxEvidence}</Text></View></View>
        {evidence.length > 0 && (
          <View style={styles.evidenceGrid}>
            {evidence.map((item, index) => (
              <View key={`${item.uri}-${index}`} style={styles.evidenceTile}>
                <Image source={{ uri: item.uri }} style={styles.evidenceTileImage} />
                <View style={styles.evidenceTileFooter}><Text style={styles.evidenceTileLabel}>{index === 0 ? 'Inicial' : `Adicional ${index}`}</Text><Pressable accessibilityLabel={`Quitar fotografía ${index + 1}`} disabled={isSubmitting || isCapturing} onPress={() => setEvidence((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={styles.removeEvidence}><Ionicons name="trash-outline" size={17} color={colors.danger} /></Pressable></View>
              </View>
            ))}
          </View>
        )}
        {evidence.length < maxEvidence && <View style={styles.evidenceOptions}>
          <Pressable style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]} disabled={isSubmitting || isCapturing} onPress={openCamera}>
            <View style={styles.cameraIcon}><Ionicons name="camera-outline" size={24} color={colors.white} /></View><View style={styles.cameraButtonText}><Text style={styles.cameraButtonTitle}>{evidence.length ? 'Agregar otra fotografía' : 'Tomar fotografía'}</Text><Text style={styles.cameraButtonCopy}>Usa la cámara; se conservarán las proporciones.</Text></View><Ionicons name="arrow-forward" size={18} color={colors.primary} />
          </Pressable>
          <Pressable style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]} disabled={isSubmitting || isCapturing} onPress={selectEvidence}>
            <View style={styles.galleryIcon}><Ionicons name="images-outline" size={24} color={colors.primary} /></View><View style={styles.cameraButtonText}><Text style={styles.cameraButtonTitle}>Elegir de galería</Text><Text style={styles.cameraButtonCopy}>Puedes seleccionar hasta {maxEvidence - evidence.length} {maxEvidence - evidence.length === 1 ? 'imagen' : 'imágenes'}.</Text></View><Ionicons name="arrow-forward" size={18} color={colors.primary} />
          </Pressable>
        </View>}
        {evidence.length > 0 && <Text style={styles.evidenceCopy}>Las imágenes se optimizan sin estirar ni recortar y se vinculan juntas al enviar el reporte.</Text>}

        <View style={styles.formFooter}>
          <View style={styles.privacyNote}><Ionicons name="shield-checkmark-outline" size={18} color={colors.secondary} /><Text style={styles.privacyText}>{isAnonymousReport ? 'Las fotografías y la ubicación GPS quedarán vinculadas de forma segura al reporte, sin solicitar correo.' : 'Tus datos, fotografías y ubicación GPS quedarán vinculados de forma segura al reporte.'}</Text></View>
          {protectedGuestFlow && !isAuthenticated ? <Text style={styles.privacyText}>Primero inicia una sesión invitada. Después completa una verificación nueva para este reporte.</Text> : null}
          {protectedGuestFlow && isGuest ? <Text style={styles.privacyText}>Cada reporte requiere una verificación nueva, incluso si ya ingresaste como invitado.</Text> : null}
          {(!isAuthenticated || protectedGuestFlow) && captchaRequired ? <TurnstileChallenge siteKey={captchaSiteKey} action={captchaAction} resetKey={captchaResetKey} onToken={setCaptchaToken} onExpire={() => setCaptchaToken('')} onError={() => { setCaptchaToken(''); Alert.alert('Verificación no disponible', 'No fue posible cargar la verificación de seguridad. Inténtalo nuevamente.'); }} /> : null}
          <AppButton disabled={isSubmitting || isCapturing || isLocating || categoriesLoading || !category || !coordinates || evidence.length < 1 || (isAuthenticated && !isGuest && (!fullName || !email)) || (protectedGuestFlow && !captchaSiteKey) || ((!isAuthenticated || protectedGuestFlow) && captchaRequired && !captchaToken)} label={isSubmitting ? protectedGuestFlow && !isAuthenticated ? 'Preparando sesión...' : `Subiendo ${evidence.length} ${evidence.length === 1 ? 'fotografía' : 'fotografías'}...` : protectedGuestFlow && !isAuthenticated ? 'Continuar como invitado' : 'Enviar reporte'} icon="send-outline" onPress={submit} />
        </View>
        <AppButton label="Cancelar" disabled={isSubmitting || isCapturing} variant="ghost" icon="close-outline" onPress={() => router.back()} />
      </View>

      <Modal visible={cameraOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setCameraOpen(false)}>
        <View style={styles.cameraPage}>
          {cameraPermission?.granted ? (
            <>
              <CameraView ref={cameraRef} style={styles.cameraPreview} facing="back" onCameraReady={() => setCameraReady(true)} />
              <View style={styles.cameraOverlay}>
                <Pressable style={styles.closeCamera} onPress={() => setCameraOpen(false)}>
                  <Ionicons name="close" size={24} color={colors.white} />
                  <Text style={styles.closeCameraText}>Salir</Text>
                </Pressable>
                <Pressable disabled={!cameraReady || isCapturing} style={styles.shutter} onPress={captureEvidence}>
                  <View style={styles.shutterCenter} />
                </Pressable>
                <Text style={styles.cameraNote}>{isCapturing ? 'Procesando fotografía...' : 'Centra la incidencia y presiona el botón'}</Text>
              </View>
            </>
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
  sectionHeading: { flex: 1 },
  sectionNumber: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  sectionNumberText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sectionCopy: { color: colors.muted, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  identityCard: { minHeight: 72, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  guestIdentityForm: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  anonymousIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  guestLimitNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.softGreen, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.xs },
  guestLimitText: { flex: 1, color: colors.primary, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  identityIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  identityText: { flex: 1 },
  identityName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  identityEmail: { color: colors.muted, fontSize: 12, marginTop: 3 },
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
  locationCard: { minHeight: 82, marginTop: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.softGreen, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  locationCardReady: { borderColor: colors.secondary, backgroundColor: '#F2F7EE' },
  locationIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  locationIconReady: { backgroundColor: colors.secondary },
  locationText: { flex: 1 },
  locationTitle: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  locationCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
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
  cameraOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: 54, paddingBottom: 36, backgroundColor: 'rgba(0,0,0,0.12)' },
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
  confirmationActions: { width: '100%', maxWidth: 520, gap: spacing.sm, marginTop: spacing.sm },
  evidenceOptions: { gap: spacing.sm },
  evidenceCount: { minWidth: 44, height: 32, borderRadius: radius.pill, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  evidenceCountText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  evidenceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  evidenceTile: { flexBasis: 150, flexGrow: 1, maxWidth: 230, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  evidenceTileImage: { width: '100%', height: 132, resizeMode: 'cover', backgroundColor: colors.softGreen },
  evidenceTileFooter: { minHeight: 42, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  evidenceTileLabel: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  removeEvidence: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  galleryIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  evidenceCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  evidencePreview: { width: '100%', height: 240, resizeMode: 'cover', backgroundColor: colors.softGreen },
  evidenceDetails: { padding: spacing.md, gap: spacing.xs },
  evidenceTitle: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  evidenceCopy: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  evidenceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  inlineAction: { minHeight: 40, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  inlineActionText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  removeActionText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  shutterDisabled: { opacity: 0.48 },
  evidenceErrorText: { color: colors.danger },
  uploadError: { width: '100%', maxWidth: 520, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.dangerSoft, padding: spacing.md, gap: spacing.sm },
  uploadErrorTitle: { color: colors.danger, fontSize: 15, fontWeight: '900' },
  uploadErrorCopy: { color: colors.text, fontSize: 13, lineHeight: 19 },
});
