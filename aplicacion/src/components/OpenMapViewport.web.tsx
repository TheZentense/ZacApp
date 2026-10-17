import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme/tokens';

export function OpenMapViewport({ latitude, longitude, label }: { latitude: number; longitude: number; label: string }) {
  const delta = 0.006;
  const bounds = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join(',');
  const source = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bounds)}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return <View style={styles.viewport}>
    {createElement('iframe', {
      src: source,
      title: `Mapa de ${label}`,
      loading: 'lazy',
      style: { width: '100%', height: '100%', border: 0 }
    })}
  </View>;
}

const styles = StyleSheet.create({
  viewport: { height: 280, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#E7EFE2', borderWidth: 1, borderColor: colors.border }
});
