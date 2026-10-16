import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { colors, radius, spacing } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

const services = [
  { title: 'Nuevo reporte', copy: 'Describe el caso y adjunta una fotografía.', icon: 'add-circle-outline', route: '/report/new' },
  { title: 'Mis reportes', copy: 'Consulta los casos que has enviado.', icon: 'document-text-outline', route: '/reports' },
  { title: 'Seguimiento', copy: 'Revisa avances, historial y fotografías.', icon: 'trail-sign-outline', route: '/tracking' },
  { title: 'Estado del reporte', copy: 'Consulta en qué etapa está tu caso.', icon: 'git-branch-outline', route: '/tracking' },
  { title: 'Mi cuenta', copy: 'Consulta los datos de tu perfil.', icon: 'person-outline', route: '/profile' },
  { title: 'Actividad reciente', copy: 'Revisa tus reportes más recientes.', icon: 'pulse-outline', route: '/' }
] satisfies { title: string; copy: string; icon: IconName; route: '/report/new' | '/reports' | '/tracking' | '/profile' | '/' }[];

export default function ServicesScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerMain}>
          <View style={styles.headerIcon}><Ionicons name="compass-outline" size={27} color={colors.primary} /></View>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>EXPLORA ZACAPP</Text>
            <Text style={styles.title}>Servicios</Text>
            <Text style={styles.copy}>Reporta y consulta desde tu cuenta.</Text>
          </View>
        </View>
        <View style={styles.cityMark}><Ionicons name="location-outline" size={18} color={colors.accent} /><Text style={styles.cityText}>Zacapa</Text></View>
      </View>

      <View><Text style={styles.sectionKicker}>RECURSOS DISPONIBLES</Text><Text style={styles.sectionTitle}>¿Qué deseas hacer?</Text></View>
      <View style={styles.grid}>
        {services.map((service, index) => (
          <Pressable key={service.title} style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push(service.route)}>
            <View style={styles.cardIndex}><Text style={styles.cardIndexText}>{String(index + 1).padStart(2, '0')}</Text></View>
            <View style={styles.icon}><Ionicons name={service.icon} size={24} color={colors.white} /></View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{service.title}</Text>
              <Text style={styles.cardCopy}>{service.copy}</Text>
            </View>
            <View style={styles.cardArrow}><Ionicons name="arrow-forward" size={17} color={colors.primary} /></View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: spacing.md, gap: spacing.lg },
  header: { backgroundColor: colors.primary, borderRadius: 28, padding: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
  headerMain: { flex: 1, minWidth: 0, flexBasis: 260, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerIcon: { flexShrink: 0, width: 46, height: 46, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: spacing.xs },
  title: { color: colors.white, fontSize: 24, lineHeight: 30, fontWeight: '800' },
  copy: { color: '#DDE8D7', marginTop: spacing.xs, lineHeight: 21 },
  cityMark: { borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.10)', paddingHorizontal: spacing.md, minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cityText: { color: colors.white, fontWeight: '800' },
  sectionKicker: { color: colors.secondary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: { minHeight: 108, flexGrow: 1, flexBasis: 280, minWidth: 0, maxWidth: '100%', backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md, overflow: 'hidden' },
  cardIndex: { position: 'absolute', right: 12, top: 8 },
  cardIndexText: { color: colors.softGreen, fontSize: 28, fontWeight: '900' },
  icon: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { color: colors.primary, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  cardCopy: { color: colors.muted, marginTop: spacing.xs, lineHeight: 19 },
  cardArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 }
});
