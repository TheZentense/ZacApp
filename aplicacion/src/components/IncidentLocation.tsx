import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Incident } from '@/types/domain';
import { OpenMapViewport } from '@/components/OpenMapViewport';
import { IncidentHeatmapViewport } from '@/components/IncidentHeatmapViewport';

const heatColors: Record<string, string> = {
  'Agua potable': '#1976D2',
  'Alumbrado público': '#ED8B00',
  Drenajes: '#62351A',
  Limpieza: '#2E7D32',
  'Desechos sólidos': '#2E7D32',
  'Calles y baches': '#C62828',
  Calles: '#C62828',
  'Áreas públicas': '#8FAA38'
};

export function ReportLocationMap({ latitude, longitude, label }: { latitude: number; longitude: number; label: string }) {
  const externalUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;

  return <View style={styles.card}>
    <View style={styles.headingRow}><View style={styles.headingIcon}><Ionicons name="map-outline" size={21} color={colors.primary} /></View><View style={styles.headingText}><Text style={styles.title}>Ubicación del incidente</Text><Text style={styles.copy}>{label}</Text></View></View>
    <OpenMapViewport latitude={latitude} longitude={longitude} label={label} />
    <Pressable accessibilityRole="link" style={styles.openButton} onPress={() => void Linking.openURL(externalUrl)}><Ionicons name="navigate-outline" size={18} color={colors.white} /><Text style={styles.openButtonText}>Abrir mapa y ruta</Text></Pressable>
    <Text style={styles.attribution}>Mapa interactivo con datos abiertos. También puedes abrir la ruta completa.</Text>
  </View>;
}

export function IncidentHeatmap({ incidents }: { incidents: Incident[] }) {
  const located = incidents.filter((item): item is Incident & { latitude: number; longitude: number } => item.latitude != null && item.longitude != null);
  const categories = useMemo(() => Array.from(new Set(located.map((item) => item.category))).sort(), [located]);
  const [selectedCategory, setSelectedCategory] = useState('TODAS');
  const activeCategory = categories.includes(selectedCategory) ? selectedCategory : 'TODAS';
  const visible = activeCategory === 'TODAS' ? located : located.filter((item) => item.category === activeCategory);
  if (!located.length) return null;
  return <View style={styles.card}>
    <View style={styles.headingRow}><View style={styles.headingIcon}><Ionicons name="analytics-outline" size={21} color={colors.primary} /></View><View style={styles.headingText}><Text style={styles.title}>Concentración de incidencias</Text><Text style={styles.copy}>Distribución de los reportes visibles para este acceso.</Text></View></View>
    <View style={styles.mapFilters}><Text style={styles.filterTitle}>Mostrar en el mapa</Text><View style={styles.filterOptions}>
      <Pressable onPress={() => setSelectedCategory('TODAS')} style={[styles.filterChip, activeCategory === 'TODAS' && styles.filterChipActive]}><Text style={[styles.filterChipText, activeCategory === 'TODAS' && styles.filterChipTextActive]}>Todas</Text></Pressable>
      {categories.map((category) => <Pressable key={category} onPress={() => setSelectedCategory(category)} style={[styles.filterChip, activeCategory === category && styles.filterChipActive]}><View style={[styles.legendDot, { backgroundColor: heatColors[category] ?? colors.secondary }]} /><Text style={[styles.filterChipText, activeCategory === category && styles.filterChipTextActive]}>{category}</Text></Pressable>)}
    </View></View>
    <IncidentHeatmapViewport incidents={visible} />
    <View style={styles.mapFooter}><View style={styles.heatLegend}><Text style={styles.heatLegendText}>{visible.length} {visible.length === 1 ? 'punto' : 'puntos'} con GPS</Text></View><Text style={styles.mapHint}>Selecciona un punto para consultar su categoría y código.</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headingIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  headingText: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: '800' },
  copy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  openButton: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  openButtonText: { color: colors.white, fontWeight: '800' },
  attribution: { color: colors.muted, fontSize: 10, textAlign: 'right' },
  heatLegend: { alignSelf: 'flex-start', backgroundColor: colors.text, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  heatLegendText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  mapFilters: { gap: spacing.sm },
  filterTitle: { color: colors.secondary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  filterChip: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  filterChipTextActive: { color: colors.white },
  mapFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  mapHint: { flex: 1, minWidth: 180, color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'right' },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
