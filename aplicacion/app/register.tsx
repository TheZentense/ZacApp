import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { colors, radius, spacing } from '@/theme/tokens';

export default function RegisterScreen() {
  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Registro ciudadano</Text>
          <Text style={styles.copy}>Crea una cuenta para registrar incidencias y consultar su seguimiento.</Text>
          <Text style={styles.label}>Nombre completo</Text>
          <TextInput style={styles.input} placeholder="Nombre y apellidos" placeholderTextColor={colors.muted} />
          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput style={styles.input} placeholder="correo@ejemplo.com" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" />
          <Text style={styles.label}>Contraseña</Text>
          <TextInput style={styles.input} placeholder="Contraseña" placeholderTextColor={colors.muted} secureTextEntry />
          <Text style={styles.label}>Confirmar contraseña</Text>
          <TextInput style={styles.input} placeholder="Repite la contraseña" placeholderTextColor={colors.muted} secureTextEntry />
          <AppButton label="Crear cuenta" icon="person-add-outline" onPress={() => Alert.alert('Registro ciudadano', 'El formulario está listo para conectarse al servicio de autenticación.')} />
          <AppButton label="Volver a iniciar sesión" variant="secondary" icon="arrow-back-outline" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.primary, fontSize: 28, fontWeight: '800' },
  copy: { color: colors.muted, lineHeight: 21, marginBottom: spacing.md },
  label: { color: colors.text, fontWeight: '700', marginTop: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 16, backgroundColor: colors.surface }
});
