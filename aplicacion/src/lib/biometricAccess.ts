import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCOUNT_KEY = 'zacapp.biometric.account';
const PROOF_KEY = 'zacapp.biometric.proof';
const proofOptions: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Confirma tu identidad para abrir ZacApp'
};

export async function hasStrongBiometrics(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return await SecureStore.isAvailableAsync()
      && SecureStore.canUseBiometricAuthentication()
      && await LocalAuthentication.hasHardwareAsync()
      && await LocalAuthentication.isEnrolledAsync()
      && await LocalAuthentication.getEnrolledLevelAsync() === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG;
  } catch {
    return false;
  }
}

export async function isBiometricEnabledFor(accountId: string): Promise<boolean> {
  if (!accountId || Platform.OS !== 'android') return false;
  try {
    return await hasStrongBiometrics() && await SecureStore.getItemAsync(ACCOUNT_KEY) === accountId;
  } catch {
    return false;
  }
}

async function promptForStrongBiometrics(): Promise<boolean> {
  if (!await hasStrongBiometrics()) return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Desbloquear ZacApp',
    cancelLabel: 'Usar contraseña',
    disableDeviceFallback: true,
    biometricsSecurityLevel: 'strong'
  });
  return result.success;
}

export async function enableBiometricAccess(accountId: string): Promise<boolean> {
  if (!accountId || !await promptForStrongBiometrics()) return false;
  // The protected entry is invalidated when the enrolled biometric set changes.
  await SecureStore.setItemAsync(PROOF_KEY, accountId, proofOptions);
  await SecureStore.setItemAsync(ACCOUNT_KEY, accountId);
  return true;
}

export async function verifyBiometricAccess(accountId: string): Promise<boolean> {
  if (!await isBiometricEnabledFor(accountId) || !await promptForStrongBiometrics()) return false;
  try {
    return await SecureStore.getItemAsync(PROOF_KEY, proofOptions) === accountId;
  } catch {
    return false;
  }
}

export async function clearBiometricAccess(): Promise<void> {
  if (Platform.OS !== 'android') return;
  // Clear the unprotected account hint first so a failed native deletion cannot
  // leave biometric unlock enabled for a signed-out user.
  await SecureStore.deleteItemAsync(ACCOUNT_KEY);
  try { await SecureStore.deleteItemAsync(PROOF_KEY, proofOptions); } catch { /* An invalidated key is unusable. */ }
}
