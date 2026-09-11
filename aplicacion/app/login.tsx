import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { colors, radius, spacing } from '@/theme/tokens';

export default function LoginScreen() {
  const [email, setEmail] = useState('demo@zacapp.gt');
  const [password, setPassword] = useState('demo1234');
  const { width } = useWindowDimensions();
  const isNativeMobile = Platform.OS !== 'web' && width < 768;

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scrollContent, isNativeMobile && styles.scrollContentMobile]} keyboardShouldPersistTaps="handled">
        <View style={[styles.content, isNativeMobile && styles.contentMobile]}>
          <View style={[styles.brandPanel, isNativeMobile && styles.brandPanelMobile]}>
            <View style={[styles.logoMark, isNativeMobile && styles.logoMarkMobile]}>
              <Ionicons name="leaf-outline" size={isNativeMobile ? 34 : 34} color={colors.white} />
            </View>
            <Text style={[styles.kicker, isNativeMobile && styles.kickerMobile]}>Sistema comunitario</Text>
            <Text style={[styles.title, isNativeMobile && styles.titleMobile]}>ZacApp</Text>
            <Text style={[styles.subtitle, isNativeMobile && styles.subtitleMobile]}>Reportes ciudadanos para dar seguimiento a incidencias en Zacapa.</Text>
          </View>

          <View style={[styles.card, isNativeMobile && styles.cardMobile]}>
            <Text style={[styles.cardTitle, isNativeMobile && styles.cardTitleMobile]}>Bienvenido</Text>
            <Text style={[styles.cardCopy, isNativeMobile && styles.cardCopyMobile]}>Ingresa con la cuenta de demostración para revisar el avance visual.</Text>

            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="correo@zacapp.gt"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Contraseña"
              placeholderTextColor={colors.muted}
            />

            <AppButton label="Iniciar sesión" icon="log-in-outline" onPress={() => router.replace('/(tabs)')} />
            <Text style={styles.helpText}>Acceso simulado. La autenticación real se mantiene sin cambios.</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  scrollContentMobile: { flexGrow: 0, justifyContent: 'flex-start', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', flexDirection: 'row', gap: spacing.xl, alignItems: 'stretch', flexWrap: 'wrap' },
  contentMobile: { maxWidth: 430, flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch', gap: spacing.lg },
  brandPanel: { flex: 1, minWidth: 280, backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.xl, justifyContent: 'center', gap: spacing.md },
  brandPanelMobile: { flex: 0, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, maxHeight: 340, width: '100%', borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, justifyContent: 'flex-start', gap: 6 },
  logoMark: { width: 68, height: 68, borderRadius: 22, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  logoMarkMobile: { width: 68, height: 68, borderRadius: 20 },
  kicker: { color: colors.accent, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  kickerMobile: { fontSize: 12 },
  title: { color: colors.white, fontSize: 42, fontWeight: '800' },
  titleMobile: { fontSize: 44 },
  subtitle: { color: '#DDE8D7', fontSize: 17, lineHeight: 25, maxWidth: 420 },
  subtitleMobile: { fontSize: 17, lineHeight: 23 },
  card: { flex: 1, minWidth: 300, backgroundColor: colors.white, padding: spacing.xl, borderRadius: radius.xl, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, elevation: 3 },
  cardMobile: { flex: 0, flexGrow: 0, minWidth: 0, width: '100%', padding: spacing.lg, borderRadius: radius.lg, gap: spacing.xs },
  cardTitle: { color: colors.primary, fontSize: 28, fontWeight: '800' },
  cardTitleMobile: { fontSize: 24 },
  cardCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: spacing.md },
  cardCopyMobile: { fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  label: { color: colors.text, fontWeight: '600', marginTop: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 16, backgroundColor: colors.surface },
  helpText: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: spacing.xs }
});
