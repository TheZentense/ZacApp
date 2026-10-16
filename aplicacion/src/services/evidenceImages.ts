import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import type { ReportEvidenceInput } from '@/services/reports';

const maxEvidenceBytes = 5 * 1024 * 1024;

function checkEvidenceSize(size: number) {
  if (!size || size > maxEvidenceBytes) throw new Error('La fotografía debe pesar como máximo 5 MB y no estar vacía.');
}

export async function readEvidenceBytes(uri: string): Promise<ArrayBuffer> {
  let bytes: ArrayBuffer;
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('No fue posible preparar la fotografía.');
    bytes = await response.arrayBuffer();
  } else {
    // Camera and ImageManipulator return local URIs, not HTTP responses.
    let file: File;
    let size: number;
    try {
      file = new File(uri);
      if (!file.exists) throw new Error('Missing local image');
      size = file.size;
    } catch {
      throw new Error('La fotografía local ya no está disponible. Vuelve a seleccionarla.');
    }
    checkEvidenceSize(size);
    try {
      bytes = await file.arrayBuffer();
    } catch {
      throw new Error('No fue posible leer la fotografía local. Intenta nuevamente o selecciona otra imagen.');
    }
  }
  // Validate the actual buffer too, in case the file changed after the size check.
  checkEvidenceSize(bytes.byteLength);
  return bytes;
}

export async function optimizeEvidence(uri: string): Promise<ReportEvidenceInput> {
  const context = ImageManipulator.manipulate(uri);
  const image = await context.renderAsync();
  if (Math.max(image.width, image.height) > 1600) {
    context.resize(image.width >= image.height ? { width: 1600, height: null } : { width: null, height: 1600 });
  }
  const resized = await context.renderAsync();
  const result = await resized.saveAsync({ compress: 0.72, format: SaveFormat.JPEG });
  return { uri: result.uri, mimeType: 'image/jpeg' };
}

export async function selectEvidenceImages(limit: number): Promise<ReportEvidenceInput[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: limit > 1,
    quality: 1,
    selectionLimit: limit
  });
  if (result.canceled) return [];
  const uris = result.assets.map((asset) => asset.uri).filter(Boolean).slice(0, limit);
  return Promise.all(uris.map(optimizeEvidence));
}
