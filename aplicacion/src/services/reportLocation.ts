import * as Location from 'expo-location';
import { Platform } from 'react-native';

export const MAX_REPORT_ACCURACY_METERS = 200;
const MAX_POSITION_AGE_MS = 30_000;
const MAX_CAPTURE_AGE_MS = 10 * 60_000;
const HIGH_ACCURACY_TIMEOUT_MS = 12_000;
const FALLBACK_TIMEOUT_MS = 8_000;

export type ReportCoordinates = { latitude: number; longitude: number; accuracy: number; timestamp: number };
type LocationFailure = 'denied' | 'timeout' | 'unavailable' | 'stale' | 'invalid';

export class ReportLocationError extends Error {
  constructor(public readonly reason: LocationFailure) {
    const messages: Record<LocationFailure, string> = {
      denied: 'Permite el acceso a la ubicación en el navegador o en los ajustes del dispositivo y vuelve a intentar.',
      timeout: 'Se agotó el tiempo para obtener la ubicación. Acércate a una ventana o sal al exterior y vuelve a intentar.',
      unavailable: 'El dispositivo no pudo obtener la posición. Comprueba que la ubicación esté activada y vuelve a intentar.',
      stale: 'El dispositivo devolvió una ubicación anterior. Vuelve a intentar para obtener una posición actual.',
      invalid: 'El dispositivo devolvió coordenadas o precisión no válidas. Vuelve a intentar.'
    };
    super(messages[reason]);
    this.name = 'ReportLocationError';
  }
}

export function isPreciseReportLocation(position: ReportCoordinates | null): boolean {
  return position !== null && position.accuracy <= MAX_REPORT_ACCURACY_METERS &&
    Date.now() - position.timestamp <= MAX_CAPTURE_AGE_MS && Date.now() - position.timestamp >= -5_000;
}

function validatePosition(coords: { latitude: number; longitude: number; accuracy: number | null }, timestamp: number): ReportCoordinates {
  const { latitude, longitude, accuracy } = coords;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      accuracy === null || !Number.isFinite(accuracy) || accuracy <= 0) {
    throw new ReportLocationError('invalid');
  }
  const age = Date.now() - timestamp;
  if (!Number.isFinite(timestamp) || age > MAX_POSITION_AGE_MS || age < -5_000) {
    throw new ReportLocationError('stale');
  }
  return { latitude, longitude, accuracy, timestamp };
}

function withDeadline<T>(operation: () => Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      finished = true;
      reject(new ReportLocationError('timeout'));
    }, milliseconds);
    try {
      operation().then(
        (value) => { if (!finished) { finished = true; clearTimeout(timer); resolve(value); } },
        (error) => { if (!finished) { finished = true; clearTimeout(timer); reject(error); } }
      );
    } catch (error) {
      if (!finished) { finished = true; clearTimeout(timer); reject(error); }
    }
  });
}

function webPosition(highAccuracy: boolean, timeout: number): Promise<ReportCoordinates> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new ReportLocationError('unavailable'));
  }
  return withDeadline(() => new Promise((resolve, reject) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          try { resolve(validatePosition(position.coords, position.timestamp)); }
          catch (error) { reject(error); }
        },
        (error) => reject(new ReportLocationError(error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable')),
        { enableHighAccuracy: highAccuracy, timeout, maximumAge: 0 }
      );
    } catch (error) {
      const denied = error && typeof error === 'object' && 'name' in error &&
        (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      reject(new ReportLocationError(denied ? 'denied' : 'unavailable'));
    }
  }), timeout);
}

async function nativePosition(accuracy: Location.Accuracy, timeout: number): Promise<ReportCoordinates> {
  const position = await withDeadline(() => Location.getCurrentPositionAsync({ accuracy }), timeout);
  return validatePosition(position.coords, position.timestamp);
}

export async function captureReportLocation(): Promise<ReportCoordinates> {
  if (Platform.OS !== 'web') {
    const permission = await withDeadline(() => Location.requestForegroundPermissionsAsync(), HIGH_ACCURACY_TIMEOUT_MS);
    if (!permission.granted) throw new ReportLocationError('denied');
  }
  const attempts = Platform.OS === 'web'
    ? [() => webPosition(true, HIGH_ACCURACY_TIMEOUT_MS), () => webPosition(false, FALLBACK_TIMEOUT_MS)]
    : [() => nativePosition(Location.Accuracy.High, HIGH_ACCURACY_TIMEOUT_MS), () => nativePosition(Location.Accuracy.Balanced, FALLBACK_TIMEOUT_MS)];
  try {
    return await attempts[0]();
  } catch (firstError) {
    if (firstError instanceof ReportLocationError &&
        (firstError.reason === 'denied' || (Platform.OS === 'web' && firstError.reason !== 'timeout' && firstError.reason !== 'unavailable'))) {
      throw firstError;
    }
    try {
      return await attempts[1]();
    } catch (secondError) {
      if (secondError instanceof ReportLocationError) throw secondError;
      if (firstError instanceof ReportLocationError && firstError.reason === 'timeout') throw firstError;
      throw new ReportLocationError('unavailable');
    }
  }
}
