import { Camera, Map, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';
import type { Incident } from '@/types/domain';
import { colors, radius } from '@/theme/tokens';

const OPEN_FREE_MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

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

export function IncidentHeatmapViewport({ incidents }: { incidents: Incident[] }) {
  const located = incidents.filter((item): item is Incident & { latitude: number; longitude: number } => item.latitude != null && item.longitude != null);
  const longitude = located.reduce((total, item) => total + item.longitude, 0) / located.length;
  const latitude = located.reduce((total, item) => total + item.latitude, 0) / located.length;

  return <View style={styles.viewport}>
    <Map mapStyle={OPEN_FREE_MAP_STYLE} style={styles.map} attribution compass>
      <Camera initialViewState={{ center: [longitude, latitude], zoom: located.length === 1 ? 15 : 13 }} />
      {located.map((item) => <ViewAnnotation key={item.id} id={`heat-${item.id}`} lngLat={[item.longitude, item.latitude]} anchor="center">
        <View accessibilityLabel={`${item.category}: ${item.code}`} style={[styles.halo, { backgroundColor: heatColors[item.category] ?? colors.secondary }]}><View style={styles.core} /></View>
      </ViewAnnotation>)}
    </Map>
  </View>;
}

const styles = StyleSheet.create({
  viewport: { height: 300, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#E7EFE2', borderWidth: 1, borderColor: colors.border },
  map: { flex: 1 },
  halo: { width: 42, height: 42, borderRadius: 21, opacity: 0.72, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.88)' },
  core: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.white, borderWidth: 2, borderColor: 'rgba(12,27,31,0.55)' }
});
