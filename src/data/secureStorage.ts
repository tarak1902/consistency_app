import * as SecureStore from 'expo-secure-store';

/**
 * Supabase session storage backed by the device keychain/keystore.
 * SecureStore values are limited to ~2 KB, and a session (with provider
 * tokens) can exceed that, so values are split into chunks.
 */
const CHUNK = 1800;
const countKey = (key: string) => `${key}.n`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;
// SecureStore keys allow [A-Za-z0-9._-] only.
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

async function removeChunks(key: string): Promise<void> {
  const n = Number((await SecureStore.getItemAsync(countKey(key))) ?? '0');
  await Promise.all(
    Array.from({ length: n }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))),
  );
  await SecureStore.deleteItemAsync(countKey(key));
}

export const secureStorage = {
  async getItem(rawKey: string): Promise<string | null> {
    const key = safe(rawKey);
    const n = Number((await SecureStore.getItemAsync(countKey(key))) ?? '0');
    if (!n) return null;
    const parts = await Promise.all(
      Array.from({ length: n }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
    );
    if (parts.some((p) => p === null)) return null;
    return parts.join('');
  },
  async setItem(rawKey: string, value: string): Promise<void> {
    const key = safe(rawKey);
    await removeChunks(key);
    const n = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < n; i += 1) {
      await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(countKey(key), String(n));
  },
  async removeItem(rawKey: string): Promise<void> {
    await removeChunks(safe(rawKey));
  },
};
