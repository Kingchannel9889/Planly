/** Predict local reminders from the same rules used by the UI, without background JS. */
import type { PlannerData, Entry } from './model';
import { addDays, atTime, dayKey, isQuiet, MINUTE, risk, usableMinutes } from './planner';
export interface Reminder {
  id: string;
  at: number;
  title: string;
  body: string;
  entryId?: string;
  route: 'task' | 'review' | 'today';
  level?: 'Urgent' | 'Critical';
  deadline?: string;
  suppressed?: boolean;
}
export function riskInstant(
  e: Entry,
  data: PlannerData,
  now: Date,
  level: 'Urgent' | 'Critical',
): number | undefined {
  if (!e.deadline || Date.parse(e.deadline) < +now) return;
  const end = new Date(e.deadline),
    threshold = e.remainingMinutes * (level === 'Urgent' ? 2 : 1) + 30;
  let low = +now,
    high = +end;
  if (usableMinutes(now, end, data.entries, data.settings) <= threshold) return +now + 1500;
  // Usable time is monotonic. Binary search finds the transition even across blocked periods.
  while (high - low > MINUTE) {
    const mid = Math.floor((low + high) / 2);
    if (usableMinutes(new Date(mid), end, data.entries, data.settings) <= threshold) high = mid;
    else low = mid;
  }
  return high;
}
export function planReminders(data: PlannerData, now: Date): Reminder[] {
  const s = data.settings,
    result: Reminder[] = [];
  if (!s.notifications || !data.onboarded) return result;
  for (const e of data.entries) {
    if (e.completedAt) continue;
    const startEnabled =
      e.kind === 'task'
        ? (s.taskReminders ?? s.startReminders)
        : (s.appointmentReminders ?? s.startReminders);
    if (e.start && startEnabled) {
      const at = Date.parse(e.start) - 10 * MINUTE;
      if (at > +now && !isQuiet(new Date(at), s))
        result.push({
          id: `start:${e.id}:${e.start}`,
          at,
          title: 'Starting in 10 minutes',
          body: e.title,
          route: 'task',
          entryId: e.id,
        });
    }
    if (e.kind !== 'task') continue;
    for (const level of ['Urgent', 'Critical'] as const) {
      if (
        !(level === 'Urgent'
          ? (s.urgentAlerts ?? s.riskReminders)
          : (s.criticalAlerts ?? s.riskReminders))
      )
        continue;
      if (e.riskHistory[level]) continue;
      // A newly created Critical task gets one actionable alert, not two simultaneous alerts.
      if (level === 'Urgent' && risk(e, data.entries, s, now).level === 'Critical') continue;
      const at = riskInstant(e, data, now, level);
      if (at)
        result.push({
          id: `risk:${e.id}:${level}:${e.deadline}`,
          at,
          title: `${level} task`,
          body: `${e.title} · ${e.remainingMinutes} min remaining`,
          route: 'task',
          entryId: e.id,
          level,
          deadline: e.deadline,
          suppressed: isQuiet(new Date(at), s) && !(level === 'Critical' && s.criticalDuringSleep),
        });
    }
  }
  // A bounded rolling window avoids OS queue limits. Every edit/resume refreshes predictions.
  for (let i = 0; i < 14; i++) {
    const day = addDays(now, i),
      wake = atTime(day, s.wake),
      review = atTime(day, s.review);
    if (s.reviewReminder && +review > +now && !isQuiet(review, s))
      result.push({
        id: `review:${dayKey(day)}`,
        at: +review,
        title: 'A calmer tomorrow starts tonight',
        body: 'Review unfinished work and prepare tomorrow’s plan.',
        route: 'review',
      });
    if (s.wakeSummary && +wake > +now) {
      const risky = data.entries.filter(
        (e) =>
          e.kind === 'task' &&
          !e.completedAt &&
          ['Urgent', 'Critical', 'Overdue'].includes(risk(e, data.entries, s, wake).level),
      );
      if (risky.length)
        result.push({
          id: `wake:${dayKey(day)}`,
          at: +wake,
          title: `${risky.length} task${risky.length === 1 ? '' : 's'} need your attention`,
          body: risky
            .slice(0, 3)
            .map((e) => e.title)
            .join(' · '),
          route: 'today',
        });
    }
  }
  return result.sort((a, b) => a.at - b.at).slice(0, 60);
}
