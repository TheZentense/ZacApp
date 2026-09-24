import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { colors, radius, spacing } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

const services = [
  { title: 'Mapa de incidencias', copy: 'Consulta reportes cercanos y zonas de atención.', icon: 'map-outline' },
  { title: 'Notificaciones', copy: 'Revisa avisos y cambios de estado importantes.', icon: 'notifications-outline' },
  { title: 'Directorio municipal', copy: 'Encuentra áreas y medios de contacto.', icon: 'call-outline' },
  { title: 'Guía ciudadana', copy: 'Conoce cómo registrar y dar seguimiento a un caso.', icon: 'book-outline' },
  { title: 'Centro de ayuda', copy: 'Consulta respuestas y canales de asistencia.', icon: 'help-circle-outline' },
  { title: 'Preferencias', copy: 'Configura avisos y opciones de la aplicación.', icon: 'options-outline' }
] satisfies { title: string; copy: string; icon: IconName }[];

export default function ServicesScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerIcon}><Ionicons name="apps-outline" size={27} color={colors.white} /></View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Servicios ciudadanos</Text>
          <Text style={styles.copy}>Accede a recursos, información y opciones de atención.</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {services.map((service) => (
          <Pressable key={service.title} style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => Alert.alert(service.title, 'Módulo en preparación.')}>
            <View style={styles.icon}><Ionicons name={service.icon} size={25} color={colors.primary} /></View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{service.title}</Text>
              <Text style={styles.cardCopy}>{service.copy}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg },
  header: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { color: colors.white, fontSize: 25, fontWeight: '800' },
  copy: { color: '#DDE8D7', marginTop: spacing.xs, lineHeight: 21 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: { minHeight: 98, flexGrow: 1, flexBasis: 320, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1 },
  cardTitle: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  cardCopy: { color: colors.muted, marginTop: spacing.xs, lineHeight: 19 },
  pressed: { opacity: 0.8 }
});
