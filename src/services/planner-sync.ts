import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyData, type PlannerData } from '@/core/model';
import { validateBackup } from '@/core/backup';
import { api, ApiError } from './api';
import type { AccountSession } from './session';
export interface PlannerCache {
  cached?: boolean;
  data: PlannerData;
  revision: number;
  dirty: boolean;
}
const key = (id: string) => `planly:account:${id}:planner:1`;
// PostgreSQL JSONB may reorder object keys; order must not create a false conflict.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export async function readPlanner(id: string): Promise<PlannerCache> {
  const raw = await AsyncStorage.getItem(key(id));
  if (!raw) return { data: emptyData(), revision: 0, dirty: false };
  const cache = JSON.parse(raw) as PlannerCache;
  if (!Number.isInteger(cache.revision) || cache.revision < 0 || typeof cache.dirty !== 'boolean')
    throw new Error('Invalid planner cache.');
  return { ...cache, cached: true, data: validateBackup(JSON.stringify(cache.data)) };
}
export async function persistPlanner(id: string, cache: PlannerCache) {
  await AsyncStorage.setItem(key(id), JSON.stringify(cache));
}
export async function exchangePlanner(
  account: AccountSession,
  cache: PlannerCache,
  choice?: 'device' | 'server',
): Promise<PlannerCache> {
  const remote = await api<{ data: PlannerData | null; revision: number }>(
    '/planner',
    account.token,
  );
  if (!Number.isInteger(remote.revision) || remote.revision < 0)
    throw new Error('Invalid server revision.');
  const remoteData = remote.data ? validateBackup(JSON.stringify(remote.data)) : null;
  if (choice === 'server') {
    if (!remoteData) throw new Error('There is no server copy to restore.');
    return { data: remoteData, revision: remote.revision, dirty: false };
  }
  if (cache.dirty || choice === 'device') {
    // A previous PUT may have committed while its response was lost.
    if (canonical(remoteData) === canonical(cache.data))
      return { ...cache, revision: remote.revision, dirty: false };
    if (choice !== 'device' && remote.revision !== cache.revision)
      throw new ApiError(409, 'Another device changed your planner. Choose which copy to keep.');
    const result = await api<{ revision: number }>(
      '/planner',
      account.token,
      { revision: remote.revision, data: cache.data },
      'PUT',
    );
    return { ...cache, revision: result.revision, dirty: false };
  }
  return remoteData ? { data: remoteData, revision: remote.revision, dirty: false } : cache;
}
export async function legacyPlanner() {
  const raw = await AsyncStorage.getItem('planly:data:1');
  return raw ? validateBackup(raw) : null;
}
