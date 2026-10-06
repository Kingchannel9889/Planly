/** Browser preview keeps the planner usable without pretending to send native reminders. */
import type { PlannerData } from '@/core/model';
export async function requestNotificationPermission() {
  return false;
}
export async function notificationPermission() {
  return false;
}
export async function syncNotifications(data: PlannerData, _reset = false) {
  return data;
}
export function watchNotificationTaps(_callback: (route: string, entryId?: string) => void) {
  return () => {};
}
