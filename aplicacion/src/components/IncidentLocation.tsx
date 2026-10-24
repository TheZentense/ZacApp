import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Incident } from '@/types/domain';
import { OpenMapViewport } from '@/components/OpenMapViewport';

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
  if (!located.length) return null;
  const latitudes = located.map((item) => item.latitude);
  const longitudes = located.map((item) => item.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeRange = Math.max(maxLatitude - minLatitude, 0.002);
  const longitudeRange = Math.max(maxLongitude - minLongitude, 0.002);

  return <View style={styles.card}>
    <View style={styles.headingRow}><View style={styles.headingIcon}><Ionicons name="analytics-outline" size={21} color={colors.primary} /></View><View style={styles.headingText}><Text style={styles.title}>Concentración de incidencias</Text><Text style={styles.copy}>Distribución de los reportes visibles para este acceso.</Text></View></View>
    <View style={styles.heatmap}>
      <View style={styles.roadHorizontal} /><View style={styles.roadVertical} /><View style={styles.roadDiagonal} />
      {located.map((item) => {
        const left = 8 + ((item.longitude - minLongitude) / longitudeRange) * 84;
        const top = 8 + ((maxLatitude - item.latitude) / latitudeRange) * 78;
        return <View accessibilityLabel={`${item.category}: ${item.code}`} key={item.id} style={[styles.heatPoint, { left: `${left}%`, top: `${top}%`, backgroundColor: heatColors[item.category] ?? colors.secondary }]}><View style={styles.heatCore} /></View>;
      })}
      <View style={styles.heatLegend}><Text style={styles.heatLegendText}>{located.length} puntos con GPS</Text></View>
    </View>
    <View style={styles.legend}>{Array.from(new Set(located.map((item) => item.category))).map((category) => <View key={category} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: heatColors[category] ?? colors.secondary }]} /><Text style={styles.legendText}>{category}</Text></View>)}</View>
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
  heatmap: { height: 260, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#E9EFE5', borderWidth: 1, borderColor: colors.border },
  roadHorizontal: { position: 'absolute', left: 0, right: 0, top: '46%', height: 11, backgroundColor: '#FFFFFF' },
  roadVertical: { position: 'absolute', top: 0, bottom: 0, left: '58%', width: 9, backgroundColor: '#FFFFFF' },
  roadDiagonal: { position: 'absolute', width: '130%', height: 8, left: '-15%', top: '68%', backgroundColor: '#FFFFFF', transform: [{ rotate: '-18deg' }] },
  heatPoint: { position: 'absolute', width: 38, height: 38, marginLeft: -19, marginTop: -19, borderRadius: 19, opacity: 0.58, alignItems: 'center', justifyContent: 'center' },
  heatCore: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.white, borderWidth: 2, borderColor: 'rgba(12,27,31,0.45)' },
  heatLegend: { position: 'absolute', right: spacing.sm, bottom: spacing.sm, backgroundColor: 'rgba(12,27,31,0.78)', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  heatLegendText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.muted, fontSize: 11, fontWeight: '700' }
});
