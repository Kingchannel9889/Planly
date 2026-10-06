import { priorities, type Entry, type Settings } from './model';
import { dayKey, onDay, risk, unfinished } from './planner';
export const taskViews = ['All', 'Today', 'Upcoming', 'Unscheduled', 'Completed'] as const;
export type TaskView = (typeof taskViews)[number];
export const priorityFilters = ['All', ...priorities] as const;
export type PriorityFilter = (typeof priorityFilters)[number];
export function matchesPriority(entry: Entry, priority: PriorityFilter) {
  return priority === 'All' || (entry.kind === 'task' && entry.priority === priority);
}
export const attentionFilters = ['Any', 'Overdue', 'Unfinished', 'Appointments'] as const;
export type AttentionFilter = (typeof attentionFilters)[number];

export function inTaskView(
  entry: Entry,
  view: TaskView,
  all: Entry[],
  settings: Settings,
  now: Date,
) {
  if (view === 'All') return true;
  if (view === 'Completed') return !!entry.completedAt;
  if (entry.completedAt) return false;
  if (view === 'Today')
    return (
      onDay(entry, now) ||
      (entry.kind === 'task' &&
        (unfinished(entry, now) ||
          ['Critical', 'Urgent', 'Overdue'].includes(risk(entry, all, settings, now).level)))
    );
  if (view === 'Unscheduled') return entry.kind === 'task' && !entry.plannedDate && !entry.start;
  const planned = entry.plannedDate ?? (entry.start ? dayKey(entry.start) : undefined);
  return planned ? planned > dayKey(now) : !!entry.deadline && dayKey(entry.deadline) > dayKey(now);
}
export function matchesAttention(
  entry: Entry,
  filter: AttentionFilter,
  all: Entry[],
  settings: Settings,
  now: Date,
) {
  if (filter === 'Any') return true;
  if (filter === 'Appointments') return entry.kind === 'appointment';
  if (filter === 'Unfinished') return unfinished(entry, now);
  return (
    entry.kind === 'task' && !entry.completedAt && risk(entry, all, settings, now).level === filter
  );
}
