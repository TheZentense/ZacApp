import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ReportEvidenceInput } from '@/services/reports';

export async function optimizeEvidence(uri: string): Promise<ReportEvidenceInput> {
  const context = ImageManipulator.manipulate(uri);
  const image = await context.renderAsync();
  if (image.width > 1600) context.resize({ width: 1600, height: null });
  const resized = await context.renderAsync();
  const result = await resized.saveAsync({ compress: 0.72, format: SaveFormat.JPEG });
  return { uri: result.uri, mimeType: 'image/jpeg' };
}

export async function selectEvidenceImage(): Promise<ReportEvidenceInput | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1, selectionLimit: 1 });
  if (result.canceled || !result.assets[0]?.uri) return null;
  return optimizeEvidence(result.assets[0].uri);
}
