import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { colors, radius, spacing } from '@/theme/tokens';

export default function NewReportScreen() {
  const [category, setCategory] = useState('Alumbrado público');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const submit = () => {
    if (!description.trim() || !location.trim()) return Alert.alert('Datos incompletos', 'Agrega una descripción y ubicación.');
    Alert.alert('Reporte registrado', 'Tu reporte se registró correctamente.', [{ text: 'Aceptar', onPress: () => router.back() }]);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Reportar incidente</Text>
        <Text style={styles.copy}>Completa la información principal. Esta pantalla sigue usando datos locales para demostración.</Text>
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

        <AppButton label="Enviar reporte" icon="send-outline" onPress={submit} />
        <AppButton label="Cancelar" variant="ghost" onPress={() => router.back()} />
      </View>
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
  multiline: { minHeight: 120, textAlignVertical: 'top' }
});
