/** Versioned local domain. Completion, planning, and notification history are independent. */
export type Priority = 'High' | 'Medium' | 'Low';
export type Category = 'Work' | 'Study' | 'Personal' | 'Health' | 'Other';
export type Attention = 'Overdue' | 'Critical' | 'Urgent' | 'Important' | 'Normal';
export interface Entry {
  id: string;
  kind: 'task' | 'appointment';
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  estimatedMinutes: number;
  remainingMinutes: number;
  deadline?: string;
  plannedDate?: string;
  start?: string;
  end?: string;
  completedAt?: string;
  inProgress: boolean;
  /** End instant of the occurrence already acknowledged, not a global dismissal. */
  acknowledgedEnd?: string;
  /** Deadline-scoped consumed risk alerts (delivered or suppressed during quiet hours). */
  riskHistory: Partial<Record<'Urgent' | 'Critical', string>>;
  createdAt: string;
}
export interface Settings {
  name: string;
  /** Optional additions preserve compatibility with existing V1 backups. */
  email?: string;
  defaultPriority?: Priority;
  taskReminders?: boolean;
  appointmentReminders?: boolean;
  urgentAlerts?: boolean;
  criticalAlerts?: boolean;
  quietHours?: boolean;
  wake: string;
  sleep: string;
  review: string;
  defaultDuration: number;
  notifications: boolean;
  criticalDuringSleep: boolean;
  startReminders: boolean;
  riskReminders: boolean;
  reviewReminder: boolean;
  wakeSummary: boolean;
}
export interface PlannerData {
  version: 1;
  onboarded: boolean;
  entries: Entry[];
  settings: Settings;
  reviewedDate?: string;
}
export const defaults: Settings = {
  name: '',
  wake: '07:00',
  sleep: '23:00',
  review: '21:00',
  defaultDuration: 30,
  notifications: false,
  criticalDuringSleep: false,
  startReminders: true,
  riskReminders: true,
  reviewReminder: true,
  wakeSummary: true,
};
export const emptyData = (): PlannerData => ({
  version: 1,
  onboarded: false,
  entries: [],
  settings: { ...defaults },
});
export const categories: Category[] = ['Work', 'Study', 'Personal', 'Health', 'Other'];
export const priorities: Priority[] = ['High', 'Medium', 'Low'];
export function newEntry(duration = 30, priority: Priority = 'Medium'): Entry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    kind: 'task',
    title: '',
    description: '',
    category: 'Personal',
    priority,
    estimatedMinutes: duration,
    remainingMinutes: duration,
    inProgress: false,
    riskHistory: {},
    createdAt: new Date().toISOString(),
  };
}
