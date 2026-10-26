import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Supabase's storage adapter. Existing Android sessions move to the encrypted
// Android Keystore on their first read; deletion happens only after a good write.
export const secureAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    const secured = await SecureStore.getItemAsync(key);
    if (secured !== null) {
      await AsyncStorage.removeItem(key);
      return secured;
    }
    const legacy = await AsyncStorage.getItem(key);
    if (legacy === null) return null;
    await SecureStore.setItemAsync(key, legacy);
    await AsyncStorage.removeItem(key);
    return legacy;
  },
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
    await AsyncStorage.removeItem(key);
  },
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(key);
  }
};
