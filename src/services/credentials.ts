import * as SecureStore from 'expo-secure-store';
const KEY = 'planly.account-session.1';
export const readCredential = () => SecureStore.getItemAsync(KEY);
export const writeCredential = (value: string) => SecureStore.setItemAsync(KEY, value);
export const removeCredential = () => SecureStore.deleteItemAsync(KEY);
