import { Camera, Map, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

const OPEN_FREE_MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export function OpenMapViewport({ latitude, longitude, label }: { latitude: number; longitude: number; label: string }) {
  const coordinates: [number, number] = [longitude, latitude];

  return <View style={styles.viewport}>
    <Map mapStyle={OPEN_FREE_MAP_STYLE} style={styles.map} attribution compass>
      <Camera initialViewState={{ center: coordinates, zoom: 16 }} />
      <ViewAnnotation id="incident-location" lngLat={coordinates} anchor="bottom">
        <View style={styles.marker}><Ionicons name="location" size={25} color={colors.white} /></View>
      </ViewAnnotation>
    </Map>
    <View pointerEvents="none" style={styles.locationLabel}>
      <Text style={styles.locationLabelTitle}>Punto registrado</Text>
      <Text numberOfLines={2} style={styles.locationLabelCopy}>{label}</Text>
    </View>
    <View pointerEvents="none" style={styles.coordinates}><Text style={styles.coordinatesText}>{latitude.toFixed(6)}, {longitude.toFixed(6)}</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  viewport: { height: 280, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#E7EFE2', borderWidth: 1, borderColor: colors.border },
  map: { flex: 1 },
  marker: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.danger, borderWidth: 3, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  locationLabel: { position: 'absolute', left: spacing.sm, top: spacing.sm, maxWidth: '68%', borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.94)', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  locationLabelTitle: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  locationLabelCopy: { color: colors.text, fontSize: 10, lineHeight: 14, marginTop: 1 },
  coordinates: { position: 'absolute', left: spacing.sm, bottom: spacing.sm, borderRadius: radius.pill, backgroundColor: 'rgba(12,27,31,0.84)', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  coordinatesText: { color: colors.white, fontSize: 11, fontWeight: '800' }
});
