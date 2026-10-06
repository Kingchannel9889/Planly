/** Pure date, risk, and planning rules; no UI or platform APIs. */
import type { Attention, Entry, Settings } from './model';
export const MINUTE = 60_000;
export function dayKey(value: Date | string): string {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function atTime(date: Date, clock: string): Date {
  const d = new Date(date);
  const [h, m] = clock.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
export function isQuiet(date: Date, settings: Settings): boolean {
  if (settings.quietHours === false) return false;
  const clock = date.getHours() * 60 + date.getMinutes();
  const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const sleep = minutes(settings.sleep),
    wake = minutes(settings.wake);
  return sleep > wake ? clock >= sleep || clock < wake : clock >= sleep && clock < wake;
}
/** Union blocked intervals so overlapping meetings and sleep are never double-counted. */
export function usableMinutes(
  from: Date,
  until: Date,
  entries: Entry[],
  settings: Settings,
): number {
  const a = from.getTime(),
    b = until.getTime();
  if (b <= a) return 0;
  const blocks: [number, number][] = entries
    .filter((e) => e.kind === 'appointment' && e.start && e.end)
    .map((e) => [Date.parse(e.start!), Date.parse(e.end!)]);
  // Calendar-day iteration preserves local sleep windows across daylight-saving changes.
  for (let d = addDays(from, -1); d.getTime() < b; d = addDays(d, 1)) {
    const sleep = atTime(d, settings.sleep),
      wake = atTime(d, settings.wake);
    if (wake <= sleep) wake.setDate(wake.getDate() + 1);
    blocks.push([sleep.getTime(), wake.getTime()]);
  }
  const clipped = blocks
    .map(([s, e]) => [Math.max(a, s), Math.min(b, e)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((x, y) => x[0] - y[0]);
  let blocked = 0,
    end = a;
  for (const [s, e] of clipped) {
    blocked += Math.max(0, e - Math.max(s, end));
    end = Math.max(end, e);
  }
  return Math.max(0, (b - a - blocked) / MINUTE);
}
export function risk(
  entry: Entry,
  entries: Entry[],
  settings: Settings,
  now = new Date(),
): { level: Attention; usable: number; spare: number } {
  const usable = entry.deadline
    ? usableMinutes(now, new Date(entry.deadline), entries, settings)
    : Infinity;
  const spare = usable - entry.remainingMinutes;
  let level: Attention = entry.priority === 'High' ? 'Important' : 'Normal';
  if (entry.kind === 'task' && !entry.completedAt && entry.deadline) {
    if (Date.parse(entry.deadline) < now.getTime()) level = 'Overdue';
    else if (usable <= entry.remainingMinutes + 30) level = 'Critical';
    else if (usable <= 2 * entry.remainingMinutes + 30) level = 'Urgent';
  }
  return { level, usable, spare };
}
export function unfinished(e: Entry, now = new Date()): boolean {
  return e.kind === 'task' && !e.completedAt && !!e.end && Date.parse(e.end) < now.getTime();
}
export const elevated = (level: Attention) => ['Critical', 'Urgent', 'Overdue'].includes(level);
export function plannedDay(e: Entry): string | undefined {
  return e.start ? dayKey(e.start) : e.plannedDate;
}
export function onDay(e: Entry, date: Date): boolean {
  const key = dayKey(date);
  if (plannedDay(e) === key || (e.deadline && dayKey(e.deadline) === key)) return true;
  if (e.start && e.end) {
    const start = atTime(date, '00:00'),
      end = addDays(start, 1);
    return Date.parse(e.start) < +end && Date.parse(e.end) > +start;
  }
  return false;
}
export function todayEntries(entries: Entry[], settings: Settings, now: Date): Entry[] {
  return entries.filter(
    (e) =>
      onDay(e, now) ||
      (e.completedAt && dayKey(e.completedAt) === dayKey(now)) ||
      (!e.completedAt &&
        e.kind === 'task' &&
        (unfinished(e, now) || elevated(risk(e, entries, settings, now).level))),
  );
}
/** Critical/Urgent work that can still be rescued precedes overdue work. */
export function ranked(entries: Entry[], all: Entry[], settings: Settings, now: Date): Entry[] {
  const order: Record<Attention, number> = {
    Critical: 0,
    Urgent: 1,
    Overdue: 2,
    Important: 3,
    Normal: 4,
  };
  const priority = { High: 0, Medium: 1, Low: 2 };
  return [...entries].sort((a, b) => {
    const x = risk(a, all, settings, now),
      y = risk(b, all, settings, now);
    return (
      order[x.level] - order[y.level] ||
      (x.spare === y.spare ? 0 : x.spare - y.spare) ||
      priority[a.priority] - priority[b.priority] ||
      (Date.parse(a.deadline ?? '') || Infinity) - (Date.parse(b.deadline ?? '') || Infinity) ||
      a.createdAt.localeCompare(b.createdAt)
    );
  });
}
export function suggested(entries: Entry[], settings: Settings, now: Date): Entry | undefined {
  return ranked(
    entries.filter(
      (e) =>
        e.kind === 'task' &&
        !e.completedAt &&
        !e.inProgress &&
        (!plannedDay(e) ||
          plannedDay(e)! <= dayKey(now) ||
          elevated(risk(e, entries, settings, now).level)),
    ),
    entries,
    settings,
    now,
  )[0];
}
export function conflicts(entry: Entry, entries: Entry[], settings: Settings): string[] {
  if (!entry.start || !entry.end) return [];
  const a = Date.parse(entry.start),
    b = Date.parse(entry.end);
  const warnings = entries
    .filter(
      (e) =>
        e.id !== entry.id &&
        !e.completedAt &&
        e.start &&
        e.end &&
        Date.parse(e.start) < b &&
        Date.parse(e.end) > a,
    )
    .map((e) => `Overlaps “${e.title}”`);
  if (usableMinutes(new Date(a), new Date(b), [], settings) < (b - a) / MINUTE)
    warnings.push('This time overlaps your sleep hours.');
  return warnings;
}
/** Moving a date never changes a deadline, estimate, or completion. */
export function moveToDay(entry: Entry, date: Date): Entry {
  const next = { ...entry, plannedDate: dayKey(date), acknowledgedEnd: undefined };
  if (entry.start && entry.end) {
    const start = new Date(entry.start),
      target = new Date(date);
    target.setHours(start.getHours(), start.getMinutes(), 0, 0);
    next.start = target.toISOString();
    next.end = new Date(+target + Date.parse(entry.end) - +start).toISOString();
  }
  return next;
}
export function unschedule(entry: Entry): Entry {
  return {
    ...entry,
    start: undefined,
    end: undefined,
    plannedDate: undefined,
    acknowledgedEnd: undefined,
  };
}
export function duration(minutes: number): string {
  if (!Number.isFinite(minutes)) return 'No deadline';
  const n = Math.max(0, Math.round(minutes));
  return n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ''}` : `${n}m`;
}
export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
