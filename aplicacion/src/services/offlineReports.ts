import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { createReport, type CreateReportInput, type ReportCategory, type ReportEvidenceInput } from '@/services/reports';

const QUEUE_KEY = 'zacapp.offline-reports.v1';
const CATEGORIES_KEY = 'zacapp.report-categories.v1';
const queueDirectory = Platform.OS === 'web' ? null : new Directory(Paths.document, 'zacapp-reportes-pendientes');

export type OfflineReport = {
  id: string;
  userId: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  payload: Omit<CreateReportInput, 'turnstileToken'> & { incidentId: string };
};

type SyncResult = { sent: number; pending: number };
type QueueListener = (reports: OfflineReport[]) => void;
const listeners = new Set<QueueListener>();
let syncing = false;

async function readQueue(): Promise<OfflineReport[]> {
  const value = await AsyncStorage.getItem(QUEUE_KEY);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(reports: OfflineReport[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(reports));
  listeners.forEach((listener) => listener(reports));
}

function ensureQueueDirectory() {
  if (!queueDirectory) throw new Error('El guardado sin conexión está disponible en la aplicación móvil.');
  queueDirectory.create({ idempotent: true, intermediates: true });
  return queueDirectory;
}

async function persistEvidence(reportId: string, evidence: ReportEvidenceInput[]) {
  const directory = new Directory(ensureQueueDirectory(), reportId);
  directory.create({ idempotent: true, intermediates: true });
  const persisted: ReportEvidenceInput[] = [];
  try {
    for (const [index, item] of evidence.entries()) {
      const source = new File(item.uri);
      if (!source.exists) throw new Error('Una fotografía ya no está disponible en el dispositivo.');
      const destination = new File(directory, `evidencia-${String(index + 1).padStart(2, '0')}.jpg`);
      await source.copy(destination, { overwrite: true });
      persisted.push({ uri: destination.uri, mimeType: 'image/jpeg' });
    }
    return persisted;
  } catch (error) {
    if (directory.exists) directory.delete();
    throw error;
  }
}

function deleteEvidence(report: OfflineReport) {
  if (!queueDirectory) return;
  const directory = new Directory(queueDirectory, report.id);
  if (directory.exists) directory.delete();
}

export async function cacheReportCategories(categories: ReportCategory[]) {
  if (categories.length) await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export async function readCachedReportCategories(): Promise<ReportCategory[]> {
  const value = await AsyncStorage.getItem(CATEGORIES_KEY);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => Number.isInteger(item?.id) && typeof item?.name === 'string') : [];
  } catch {
    return [];
  }
}

export async function queueOfflineReport(userId: string, input: Omit<CreateReportInput, 'turnstileToken' | 'incidentId'> & { incidentId?: string }) {
  if (!userId) throw new Error('No fue posible identificar la cuenta del reporte.');
  const reportId = input.incidentId ?? Crypto.randomUUID();
  const evidence = await persistEvidence(reportId, input.evidence);
  const report: OfflineReport = {
    id: reportId,
    userId,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    payload: { ...input, incidentId: reportId, resumeOffline: true, evidence }
  };
  const queue = await readQueue();
  await writeQueue([...queue.filter((item) => item.id !== report.id), report]);
  return report;
}

export async function listOfflineReports(userId: string) {
  return (await readQueue()).filter((item) => item.userId === userId);
}

export async function syncOfflineReports(userId: string): Promise<SyncResult> {
  if (!userId || syncing) return { sent: 0, pending: (await listOfflineReports(userId)).length };
  const network = await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable === false) return { sent: 0, pending: (await listOfflineReports(userId)).length };

  syncing = true;
  let sent = 0;
  try {
    let queue = await readQueue();
    for (const report of queue.filter((item) => item.userId === userId)) {
      try {
        await createReport(report.payload);
        deleteEvidence(report);
        queue = queue.filter((item) => item.id !== report.id);
        sent += 1;
      } catch (error) {
        const index = queue.findIndex((item) => item.id === report.id);
        if (index >= 0) queue[index] = {
          ...queue[index],
          attempts: queue[index].attempts + 1,
          lastError: error instanceof Error ? error.message : 'No fue posible sincronizar el reporte.'
        };
        // Preserve ordering and stop: a connection failure would make every
        // subsequent attempt fail too.
        break;
      }
      await writeQueue(queue);
    }
    await writeQueue(queue);
    return { sent, pending: queue.filter((item) => item.userId === userId).length };
  } finally {
    syncing = false;
  }
}

export function subscribeOfflineReports(listener: QueueListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
