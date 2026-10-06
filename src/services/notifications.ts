/** OS-scheduled local notifications continue when JavaScript is not running. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { PlannerData } from '@/core/model';
import { planReminders, type Reminder } from '@/core/reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
const LEDGER = 'planly:notification-ledger:1';
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('planner', {
      name: 'Planner reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  return (await Notifications.requestPermissionsAsync()).granted;
}
export async function notificationPermission(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}
export async function syncNotifications(
  data: PlannerData,
  reset = false,
  scope = '',
): Promise<PlannerData> {
  const ledger = scope ? `${LEDGER}:${scope}` : LEDGER;
  const now = Date.now();
  const previous: Reminder[] = JSON.parse((await AsyncStorage.getItem(ledger)) ?? '[]');
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const pendingIds = new Set(pending.map((p) => p.identifier));
  const entries = data.entries.map((e) => {
    const history = { ...e.riskHistory };
    if (!reset)
      for (const r of previous) {
        // Android can defer alarms. Do not mark or cancel one still waiting in the OS queue.
        if (
          r.entryId === e.id &&
          r.deadline === e.deadline &&
          r.level &&
          r.at <= now &&
          (r.suppressed || !pendingIds.has(`planly:${r.id}`))
        )
          history[r.level] = new Date(r.at).toISOString();
      }
    return { ...e, riskHistory: history };
  });
  const next = { ...data, entries };
  const reminders = (
    (await notificationPermission()) ? planReminders(next, new Date(now)) : []
  ).map((r) => {
    const old = previous.find((p) => p.id === r.id);
    // Keep an already due alarm, or a prediction within binary-search rounding tolerance.
    if (
      !reset &&
      old &&
      r.level &&
      pendingIds.has(`planly:${r.id}`) &&
      old.body === r.body &&
      old.suppressed === r.suppressed &&
      (old.at <= now || Math.abs(old.at - r.at) < 60_000)
    )
      return { ...r, at: old.at };
    return r;
  });
  // Suppressed transitions stay in the ledger so waking does not replay stale individual alerts.
  const wanted = new Map(reminders.filter((r) => !r.suppressed).map((r) => [`planly:${r.id}`, r]));
  // Diff instead of cancel-all: unrelated reminders keep their identifiers and delivery times.
  for (const p of pending) {
    if (!p.identifier.startsWith('planly:')) continue;
    const old = previous.find((r) => `planly:${r.id}` === p.identifier),
      desired = wanted.get(p.identifier);
    if (!desired || JSON.stringify(old) !== JSON.stringify(desired))
      await Notifications.cancelScheduledNotificationAsync(p.identifier);
    else wanted.delete(p.identifier);
  }
  for (const [identifier, r] of wanted) {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: r.title,
        body: r.body,
        sound: 'default',
        data: { route: r.route, entryId: r.entryId ?? '' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(r.at),
        channelId: 'planner',
      },
    });
  }
  await AsyncStorage.setItem(ledger, JSON.stringify(reminders));
  return next;
}
export function watchNotificationTaps(
  callback: (route: string, entryId?: string) => void,
): () => void {
  const handle = (response: Notifications.NotificationResponse) => {
    const { route, entryId } = response.notification.request.content.data ?? {};
    if (typeof route === 'string')
      callback(route, typeof entryId === 'string' ? entryId : undefined);
    void Notifications.clearLastNotificationResponseAsync();
  };
  void Notifications.getLastNotificationResponseAsync().then((r) => {
    if (r) handle(r);
  });
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}
