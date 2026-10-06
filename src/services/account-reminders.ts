import * as Notifications from 'expo-notifications';
import { syncNotifications } from './notifications';
import type { PlannerData } from '@/core/model';
let owner: string | null = null;
let queue: Promise<unknown> = Promise.resolve();
export function startAccountReminders(id: string) {
  owner = id;
}
export function accountReminders(
  id: string,
  data: PlannerData,
  reset = false,
): Promise<PlannerData> {
  const operation = queue.then(() => (owner === id ? syncNotifications(data, reset, id) : data));
  queue = operation.catch(() => {});
  return operation;
}
export async function stopAccountReminders() {
  owner = null;
  await queue;
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  for (const item of pending)
    if (item.identifier.startsWith('planly:'))
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
  const presented = await Notifications.getPresentedNotificationsAsync();
  for (const item of presented)
    if (item.request.identifier.startsWith('planly:'))
      await Notifications.dismissNotificationAsync(item.request.identifier);
}
