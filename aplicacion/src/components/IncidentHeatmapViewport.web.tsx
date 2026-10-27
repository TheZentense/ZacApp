import { createElement, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Incident } from '@/types/domain';
import { colors, radius } from '@/theme/tokens';

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
  const points = incidents
    .filter((item): item is Incident & { latitude: number; longitude: number } => item.latitude != null && item.longitude != null)
    .map((item) => ({ code: item.code, category: item.category, latitude: item.latitude, longitude: item.longitude, color: heatColors[item.category] ?? colors.secondary }));
  const source = useMemo(() => {
    const safePoints = JSON.stringify(points).replace(/</g, '\\u003c');
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css" rel="stylesheet"><style>html,body,#map{width:100%;height:100%;margin:0}.maplibregl-ctrl-attrib{font-size:9px}.marker{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;opacity:.72;border:2px solid rgba(255,255,255,.9);box-shadow:0 2px 8px rgba(12,27,31,.28)}.marker:after{content:'';width:10px;height:10px;border-radius:50%;background:#fff;border:2px solid rgba(12,27,31,.55)}</style></head><body><div id="map"></div><script src="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js"></script><script>const points=${safePoints};const map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/liberty',center:[points[0].longitude,points[0].latitude],zoom:points.length===1?15:13});map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');const bounds=new maplibregl.LngLatBounds();points.forEach(p=>{const el=document.createElement('div');el.className='marker';el.style.background=p.color;el.title=p.category+' · '+p.code;new maplibregl.Marker({element:el}).setLngLat([p.longitude,p.latitude]).setPopup(new maplibregl.Popup({offset:22}).setText(p.category+' · '+p.code)).addTo(map);bounds.extend([p.longitude,p.latitude])});if(points.length>1)map.fitBounds(bounds,{padding:48,maxZoom:15,duration:0});</script></body></html>`;
  }, [points]);

  return <View style={styles.viewport}>{createElement('iframe', { srcDoc: source, title: 'Mapa de concentración de incidencias', loading: 'lazy', style: { width: '100%', height: '100%', border: 0 } })}</View>;
}

const styles = StyleSheet.create({
  viewport: { height: 300, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#E7EFE2', borderWidth: 1, borderColor: colors.border }
});
