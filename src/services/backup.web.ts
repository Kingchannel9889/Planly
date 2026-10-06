/** File download/upload fallback for the development browser. */
import * as DocumentPicker from 'expo-document-picker';
import { validateBackup } from '@/core/backup';
import type { PlannerData } from '@/core/model';
export async function exportBackup(data: PlannerData): Promise<void> {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'planly-backup.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function pickBackup(): Promise<PlannerData | undefined> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
  if (result.canceled) return;
  const asset = result.assets[0];
  if ((asset.size ?? 0) > 5_000_000) throw new Error('Backup is too large (maximum 5 MB).');
  return validateBackup(
    asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text(),
  );
}
