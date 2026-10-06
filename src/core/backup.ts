/** Validate the complete backup before replacing any stored data. No coercion of corrupt fields. */
import { categories, priorities, type Entry, type PlannerData } from './model';
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const clock = (v: unknown) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const instant = (v: unknown) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
const amount = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 525600;
export function validateBackup(raw: string): PlannerData {
  if (raw.length > 5_000_000) throw new Error('Backup is too large (maximum 5 MB).');
  const v: unknown = JSON.parse(raw);
  if (
    !object(v) ||
    v.version !== 1 ||
    typeof v.onboarded !== 'boolean' ||
    !Array.isArray(v.entries) ||
    !object(v.settings)
  )
    throw new Error('This is not a supported Planly backup.');
  const s = v.settings;
  if (
    s.email !== undefined &&
    (typeof s.email !== 'string' ||
      s.email.length > 254 ||
      (s.email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)))
  )
    throw new Error('Invalid profile email.');
  if (
    s.defaultPriority !== undefined &&
    !priorities.includes(s.defaultPriority as Entry['priority'])
  )
    throw new Error('Invalid default priority.');
  for (const key of [
    'taskReminders',
    'appointmentReminders',
    'urgentAlerts',
    'criticalAlerts',
    'quietHours',
  ]) {
    if (s[key] !== undefined && typeof s[key] !== 'boolean')
      throw new Error('Invalid notification preference.');
  }
  if (
    typeof s.name !== 'string' ||
    !clock(s.wake) ||
    !clock(s.sleep) ||
    s.wake === s.sleep ||
    !clock(s.review) ||
    !amount(s.defaultDuration)
  )
    throw new Error('Invalid settings in backup.');
  for (const key of [
    'notifications',
    'criticalDuringSleep',
    'startReminders',
    'riskReminders',
    'reviewReminder',
    'wakeSummary',
  ])
    if (typeof s[key] !== 'boolean') throw new Error('Invalid reminder preferences.');
  const ids = new Set<string>();
  let active = 0;
  for (const e of v.entries) {
    if (
      !object(e) ||
      typeof e.id !== 'string' ||
      !e.id ||
      ids.has(e.id) ||
      !['task', 'appointment'].includes(String(e.kind)) ||
      typeof e.title !== 'string' ||
      !e.title.trim() ||
      typeof e.description !== 'string' ||
      !categories.includes(e.category as Entry['category']) ||
      !priorities.includes(e.priority as Entry['priority']) ||
      !amount(e.estimatedMinutes) ||
      !amount(e.remainingMinutes) ||
      typeof e.inProgress !== 'boolean' ||
      !instant(e.createdAt) ||
      !object(e.riskHistory)
    )
      throw new Error('Backup contains an invalid or duplicate entry.');
    ids.add(e.id);
    for (const k of ['start', 'end', 'deadline', 'completedAt', 'acknowledgedEnd'])
      if (e[k] !== undefined && !instant(e[k])) throw new Error('Backup contains an invalid date.');
    if (
      e.plannedDate !== undefined &&
      (typeof e.plannedDate !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(e.plannedDate) ||
        new Date(`${e.plannedDate}T12:00:00Z`).toISOString().slice(0, 10) !== e.plannedDate)
    )
      throw new Error('Invalid planning date.');
    if (
      !!e.start !== !!e.end ||
      (e.start && Date.parse(String(e.end)) <= Date.parse(String(e.start)))
    )
      throw new Error('Invalid schedule block.');
    if (e.kind === 'appointment' && (!e.start || e.deadline || e.inProgress || e.completedAt))
      throw new Error('Invalid appointment.');
    if (e.inProgress && (e.completedAt || ++active > 1))
      throw new Error('Only one incomplete task can be in progress.');
    for (const [key, value] of Object.entries(e.riskHistory))
      if (!['Urgent', 'Critical'].includes(key) || !instant(value))
        throw new Error('Invalid notification history.');
  }
  if (
    v.reviewedDate !== undefined &&
    (typeof v.reviewedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.reviewedDate))
  )
    throw new Error('Invalid review date.');
  return v as unknown as PlannerData;
}
