/** User-initiated import/export through the native document picker and share sheet. */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { validateBackup } from '@/core/backup';
import type { PlannerData } from '@/core/model';
export async function exportBackup(data: PlannerData): Promise<void> {
  const file = new File(Paths.cache, `planly-backup-${new Date().toISOString().slice(0, 10)}.json`);
  file.create({ overwrite: true });
  file.write(JSON.stringify(data, null, 2));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save Planly backup',
    UTI: 'public.json',
  });
}
export async function pickBackup(): Promise<PlannerData | undefined> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', 'application/octet-stream'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return;
  if ((result.assets[0].size ?? 0) > 5_000_000)
    throw new Error('Backup is too large (maximum 5 MB).');
  return validateBackup(await new File(result.assets[0].uri).text());
}
