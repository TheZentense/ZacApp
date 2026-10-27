import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export function PaginationControls({ page, pageCount, pageSize, total, onPageChange, onPageSizeChange }: Props) {
  if (!total) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const candidates = Array.from(new Set([1, page - 1, page, page + 1, pageCount])).filter((value) => value >= 1 && value <= pageCount);

  return <View style={styles.card}>
    <Text style={styles.summary}>Mostrando {start}–{end} de {total}</Text>
    <View style={styles.row}>
      <Pressable accessibilityLabel="Página anterior" disabled={page <= 1} onPress={() => onPageChange(page - 1)} style={[styles.arrow, page <= 1 && styles.disabled]}><Ionicons name="chevron-back" size={18} color={colors.primary} /></Pressable>
      {candidates.map((value) => <Pressable key={value} onPress={() => onPageChange(value)} style={[styles.page, value === page && styles.pageActive]}><Text style={[styles.pageText, value === page && styles.pageTextActive]}>{value}</Text></Pressable>)}
      <Pressable accessibilityLabel="Página siguiente" disabled={page >= pageCount} onPress={() => onPageChange(page + 1)} style={[styles.arrow, page >= pageCount && styles.disabled]}><Ionicons name="chevron-forward" size={18} color={colors.primary} /></Pressable>
    </View>
    <View style={styles.row}><Text style={styles.sizeLabel}>Por página</Text>{[10, 20].map((size) => <Pressable key={size} onPress={() => onPageSizeChange(size)} style={[styles.size, pageSize === size && styles.sizeActive]}><Text style={[styles.sizeText, pageSize === size && styles.pageTextActive]}>{size}</Text></Pressable>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, alignItems: 'center' },
  summary: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  arrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  page: { minWidth: 38, height: 38, borderRadius: 19, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  pageActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pageText: { color: colors.primary, fontWeight: '800' },
  pageTextActive: { color: colors.white },
  sizeLabel: { color: colors.muted, fontSize: 12, marginRight: spacing.xs },
  size: { minWidth: 42, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center' },
  sizeActive: { backgroundColor: colors.primary },
  sizeText: { color: colors.primary, fontWeight: '800' }
});
