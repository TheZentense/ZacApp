import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { colors, radius, spacing } from '@/theme/tokens';

export default function NewReportScreen() {
  const [category, setCategory] = useState('Alumbrado público');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const submit = () => {
    if (!description.trim() || !location.trim()) return Alert.alert('Datos incompletos', 'Agrega una descripción y ubicación.');
    Alert.alert('Reporte registrado', 'Se guardó localmente como demostración del MVP.', [{ text: 'Aceptar', onPress: () => router.back() }]);
  };
  return <ScrollView contentContainerStyle={styles.page}><Text style={styles.title}>Reportar incidente</Text><Text style={styles.copy}>Completa la información básica. Fotografías y geolocalización se integrarán en el siguiente incremento.</Text><Text style={styles.label}>Categoría</Text><TextInput style={styles.input} value={category} onChangeText={setCategory} /><Text style={styles.label}>Descripción</Text><TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} multiline placeholder="Describe qué ocurrió y alguna referencia..." /><Text style={styles.label}>Ubicación o referencia</Text><TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Barrio, calle o punto de referencia" /><AppButton label="Enviar reporte" onPress={submit} /></ScrollView>;
}
const styles = StyleSheet.create({ page: { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.background }, title: { fontSize: 28, fontWeight: '800', color: colors.primary }, copy: { color: colors.muted, lineHeight: 21, marginBottom: spacing.md }, label: { color: colors.text, fontWeight: '700', marginTop: spacing.sm }, input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 16 }, multiline: { minHeight: 120, textAlignVertical: 'top' } });
