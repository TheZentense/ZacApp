import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { colors, radius, spacing } from '@/theme/tokens';

export default function NewReportScreen() {
  const [category, setCategory] = useState('Alumbrado público');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [gpsAuthorized, setGpsAuthorized] = useState(false);
  const [photoAttached, setPhotoAttached] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const openCamera = async () => {
    if (!cameraPermission?.granted) await requestCameraPermission();
    setCameraOpen(true);
  };
  const submit = () => {
    if (!description.trim() || !location.trim()) return Alert.alert('Datos incompletos', 'Agrega una descripción y ubicación.');
    if (!gpsAuthorized) return Alert.alert('GPS requerido', 'Autoriza compartir la ubicación aproximada del incidente para continuar.');
    if (!photoAttached) return Alert.alert('Imagen requerida', 'Adjunta una imagen de evidencia para registrar el reporte.');
    Alert.alert('Reporte registrado', 'Tu reporte se registró correctamente.', [{ text: 'Aceptar', onPress: () => router.back() }]);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Reportar incidente</Text>
        <Text style={styles.copy}>Completa la información principal para registrar la incidencia.</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Categoría</Text>
        <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholderTextColor={colors.muted} />

        <Text style={styles.label}>Descripción</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Describe qué ocurrió y alguna referencia..."
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Ubicación o referencia</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Barrio, calle o punto de referencia"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Ubicación GPS aproximada</Text>
        <Pressable style={({ pressed }) => [styles.permissionCard, gpsAuthorized && styles.permissionCardActive, pressed && styles.pressed]} onPress={() => setGpsAuthorized(true)}>
          <View style={[styles.permissionIcon, gpsAuthorized && styles.permissionIconActive]}>
            <Ionicons name={gpsAuthorized ? 'checkmark-circle' : 'navigate-outline'} size={24} color={gpsAuthorized ? colors.white : colors.primary} />
          </View>
          <View style={styles.permissionText}>
            <Text style={styles.permissionTitle}>{gpsAuthorized ? 'GPS temporal autorizado' : 'Solicitar GPS del incidente'}</Text>
            <Text style={styles.permissionCopy}>Demo visual: el usuario autoriza compartir por este momento la ubicación aproximada necesaria para atender el incidente.</Text>
          </View>
        </Pressable>

        <Text style={styles.label}>Evidencia fotográfica</Text>
        <Pressable style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]} onPress={openCamera}>
          <Ionicons name={photoAttached ? 'image' : 'camera-outline'} size={22} color={colors.primary} />
          <View style={styles.cameraButtonText}>
            <Text style={styles.cameraButtonTitle}>{photoAttached ? 'Imagen adjunta' : 'Abrir cámara o subir imagen'}</Text>
            <Text style={styles.cameraButtonCopy}>{photoAttached ? 'La evidencia de demostración quedó asociada al reporte.' : 'La imagen es obligatoria para demostrar el estado del incidente.'}</Text>
          </View>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.demoUpload, photoAttached && styles.demoUploadActive, pressed && styles.pressed]} onPress={() => setPhotoAttached(true)}>
          <Ionicons name={photoAttached ? 'checkmark-circle' : 'cloud-upload-outline'} size={19} color={photoAttached ? colors.white : colors.primary} />
          <Text style={[styles.demoUploadText, photoAttached && styles.demoUploadTextActive]}>{photoAttached ? 'Evidencia cargada' : 'Usar imagen de ejemplo'}</Text>
        </Pressable>

        <AppButton label="Enviar reporte" icon="send-outline" onPress={submit} />
        <AppButton label="Cancelar" variant="ghost" onPress={() => router.back()} />
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
                <Pressable style={styles.shutter} onPress={() => { setPhotoAttached(true); setCameraOpen(false); Alert.alert('Imagen adjunta', 'Se agregó una evidencia de demostración al reporte.'); }}>
                  <View style={styles.shutterCenter} />
                </Pressable>
                <Text style={styles.cameraNote}>Vista previa de cámara · evidencia demo</Text>
              </View>
            </CameraView>
          ) : (
            <View style={styles.permissionPage}>
              <Ionicons name="camera-outline" size={52} color={colors.primary} />
              <Text style={styles.cameraPermissionTitle}>Acceso a la cámara</Text>
              <Text style={styles.cameraPermissionCopy}>ZacApp necesita permiso para utilizar la cámara del dispositivo.</Text>
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
  header: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 28, fontWeight: '800', color: colors.primary },
  copy: { color: colors.muted, lineHeight: 21, marginTop: spacing.xs },
  form: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.text, fontWeight: '700', marginTop: spacing.sm },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 16, color: colors.text },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  cameraButton: { minHeight: 72, backgroundColor: colors.softGreen, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cameraButtonText: { flex: 1 },
  cameraButtonTitle: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  cameraButtonCopy: { color: colors.muted, fontSize: 12, marginTop: spacing.xs },
  permissionCard: { minHeight: 86, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  permissionCardActive: { borderColor: colors.primary, backgroundColor: colors.softGreen },
  permissionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  permissionIconActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  permissionText: { flex: 1 },
  permissionTitle: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  permissionCopy: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: spacing.xs },
  demoUpload: { minHeight: 44, alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  demoUploadActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  demoUploadText: { color: colors.primary, fontWeight: '800' },
  demoUploadTextActive: { color: colors.white },
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
  cameraPermissionTitle: { color: colors.primary, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  cameraPermissionCopy: { color: colors.muted, fontSize: 16, lineHeight: 23, textAlign: 'center', marginBottom: spacing.md }
});
