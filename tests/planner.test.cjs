// Compile only pure domain modules in memory; no native mocks or generated source files.
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { defaults, emptyData, newEntry } = require('../src/core/model.ts');
const {
  usableMinutes,
  risk,
  unfinished,
  moveToDay,
  unschedule,
  ranked,
  suggested,
  todayEntries,
  dayKey,
  conflicts,
  isQuiet,
} = require('../src/core/planner.ts');
const { validateBackup } = require('../src/core/backup.ts');
const { planReminders, riskInstant } = require('../src/core/reminders.ts');
const d = (text) => new Date(`2026-10-04T${text}:00`);
const task = (patch) => ({ ...newEntry(), title: 'Assignment', ...patch });
const meeting = (start, end) =>
  task({ kind: 'appointment', start: d(start).toISOString(), end: d(end).toISOString() });
const state = (entries, settings = {}) => ({
  ...emptyData(),
  onboarded: true,
  entries,
  settings: { ...defaults, notifications: true, ...settings },
});
test('new settings preserve old backups and validate optional additions', () => {
  const old = state([task()]);
  assert.deepEqual(validateBackup(JSON.stringify(old)), old);
  const updated = state([], {
    email: 'alex@example.com',
    defaultPriority: 'High',
    taskReminders: false,
    appointmentReminders: true,
    urgentAlerts: false,
    criticalAlerts: true,
    quietHours: false,
  });
  assert.deepEqual(validateBackup(JSON.stringify(updated)), updated);
  for (const settings of [
    { email: 'invalid' },
    { defaultPriority: 'Critical' },
    { quietHours: 'yes' },
    { taskReminders: 1 },
  ])
    assert.throws(() => validateBackup(JSON.stringify(state([], settings))));
});
test('default priority applies only to new tasks', () => {
  assert.equal(newEntry(30, 'High').priority, 'High');
  assert.equal(newEntry().priority, 'Medium');
});
test('task and appointment reminders can be controlled independently', () => {
  const t = task({ start: d('12:00').toISOString() }),
    a = meeting('13:00', '14:00');
  const reminders = planReminders(
    state([t, a], { taskReminders: false, appointmentReminders: true }),
    d('09:00'),
  );
  assert.ok(!reminders.some((r) => r.entryId === t.id));
  assert.ok(reminders.some((r) => r.entryId === a.id));
});
test('urgent and critical alerts use their separate preferences', () => {
  const t = task({ remainingMinutes: 60, deadline: d('12:00').toISOString() });
  const reminders = planReminders(
    state([t], { urgentAlerts: false, criticalAlerts: true }),
    d('09:00'),
  );
  assert.ok(!reminders.some((r) => r.level === 'Urgent'));
  assert.ok(reminders.some((r) => r.level === 'Critical'));
});
test('disabling quiet hours does not make sleep available for planning', () => {
  const s = { ...defaults, quietHours: false };
  assert.equal(isQuiet(d('23:30'), s), false);
  assert.equal(usableMinutes(d('22:00'), new Date('2026-10-05T08:00:00'), [], s), 120);
});
test('overlapping commitments are counted once', () =>
  assert.equal(
    usableMinutes(
      d('09:00'),
      d('13:00'),
      [meeting('10:00', '12:00'), meeting('11:00', '12:30')],
      defaults,
    ),
    90,
  ));
test('sleep and meetings union correctly across midnight', () => {
  const start = d('22:00'),
    until = new Date('2026-10-05T08:00:00');
  const appointment = task({
    kind: 'appointment',
    start: d('22:30').toISOString(),
    end: new Date('2026-10-05T07:30:00').toISOString(),
  });
  assert.equal(usableMinutes(start, until, [appointment], defaults), 60);
});
test('available time adds disconnected gaps', () =>
  assert.equal(
    usableMinutes(
      d('09:00'),
      d('13:00'),
      [
        meeting('09:30', '10:00'),
        meeting('10:30', '11:00'),
        meeting('11:30', '12:00'),
        meeting('12:30', '13:00'),
      ],
      defaults,
    ),
    120,
  ));
test('risk boundaries and overdue remain distinct', () => {
  const t = task({ remainingMinutes: 60, deadline: d('12:00').toISOString() });
  assert.equal(risk(t, [], defaults, d('09:29')).level, 'Normal');
  assert.equal(risk(t, [], defaults, d('09:30')).level, 'Urgent');
  assert.equal(risk(t, [], defaults, d('10:30')).level, 'Critical');
  assert.equal(risk(t, [], defaults, d('12:00')).level, 'Critical');
  assert.equal(risk(t, [], defaults, d('12:01')).level, 'Overdue');
});
test('high priority without deadline is Important', () =>
  assert.equal(risk(task({ priority: 'High' }), [], defaults, d('12:00')).level, 'Important'));
test('fixed appointments and completed tasks do not acquire active risk', () => {
  for (const extra of [{ kind: 'appointment' }, { completedAt: d('08:00').toISOString() }])
    assert.equal(
      risk(task({ deadline: d('07:00').toISOString(), ...extra }), [], defaults, d('09:00')).level,
      'Normal',
    );
});
test('unfinished is independent of deadline risk and dismissal', () => {
  const t = task({
    end: d('09:00').toISOString(),
    acknowledgedEnd: d('09:00').toISOString(),
    deadline: d('20:00').toISOString(),
  });
  assert.equal(unfinished(t, d('10:00')), true);
  assert.equal(risk(t, [], defaults, d('10:00')).level, 'Normal');
  assert.equal(unfinished({ ...t, completedAt: d('10:00').toISOString() }, d('10:00')), false);
});
test('postponing preserves deadline, estimates, and block length', () => {
  const t = task({
    start: d('09:00').toISOString(),
    end: d('10:00').toISOString(),
    deadline: d('22:00').toISOString(),
    remainingMinutes: 15,
  });
  const next = moveToDay(t, new Date('2026-10-05T00:00:00'));
  assert.equal(next.deadline, t.deadline);
  assert.equal(next.remainingMinutes, 15);
  assert.equal(Date.parse(next.end) - Date.parse(next.start), 3600000);
  assert.equal(dayKey(next.start), '2026-10-05');
});
test('unscheduling clears occurrence but preserves work and completion', () => {
  const t = task({
    start: d('09:00').toISOString(),
    end: d('10:00').toISOString(),
    plannedDate: '2026-10-04',
    deadline: d('22:00').toISOString(),
    acknowledgedEnd: d('10:00').toISOString(),
  });
  const next = unschedule(t);
  assert.equal(next.start, undefined);
  assert.equal(next.plannedDate, undefined);
  assert.equal(next.acknowledgedEnd, undefined);
  assert.equal(next.deadline, t.deadline);
});
test('Critical work precedes Overdue in Suggested Next', () => {
  const old = task({ deadline: d('08:00').toISOString() }),
    rescue = task({ deadline: d('10:00').toISOString() });
  assert.equal(ranked([old, rescue], [old, rescue], defaults, d('09:30'))[0].id, rescue.id);
});
test('future planned normal task is hidden from suggestions until risky', () => {
  const future = task({ plannedDate: '2026-10-05' });
  assert.equal(suggested([future], defaults, d('12:00')), undefined);
  const risky = { ...future, deadline: d('12:30').toISOString() };
  assert.equal(suggested([risky], defaults, d('12:00')).id, risky.id);
  assert.equal(todayEntries([risky], defaults, d('12:00')).length, 1);
});
test('completed unscheduled work contributes to Today', () =>
  assert.equal(
    todayEntries([task({ completedAt: d('10:00').toISOString() })], defaults, d('11:00')).length,
    1,
  ));
test('overlap and sleep warnings do not mutate the plan', () => {
  const t = task({
    start: d('22:30').toISOString(),
    end: new Date('2026-10-05T00:30:00').toISOString(),
  });
  assert.equal(conflicts(t, [meeting('22:00', '23:00')], defaults).length, 2);
});
test('quiet hours include bedtime and exclude wake time', () => {
  assert.equal(isQuiet(d('23:00'), defaults), true);
  assert.equal(isQuiet(d('07:00'), defaults), false);
});
test('valid backup round trips without changing independent states', () => {
  const value = state([
    task({ deadline: d('20:00').toISOString(), riskHistory: { Urgent: d('10:00').toISOString() } }),
    meeting('15:00', '16:00'),
  ]);
  assert.deepEqual(validateBackup(JSON.stringify(value)), value);
});
test('backup rejects duplicates, unknown versions, invalid intervals, and broken settings', () => {
  const t = task();
  const valid = state([t]);
  for (const invalid of [
    { ...valid, version: 2 },
    { ...valid, entries: [t, t] },
    state([meeting('16:00', '15:00')]),
    { ...valid, settings: { ...defaults, sleep: '99:00' } },
    state([task({ plannedDate: '2026-02-31' })]),
    state([task({ inProgress: true }), task({ inProgress: true })]),
  ])
    assert.throws(() => validateBackup(JSON.stringify(invalid)));
});
test('risk transition prediction accounts for a blocked afternoon', () => {
  const t = task({ remainingMinutes: 60, deadline: d('17:00').toISOString() });
  const data = state([t, meeting('15:00', '16:00')]);
  const at = riskInstant(t, data, d('12:00'), 'Critical');
  assert.ok(at >= +d('14:30') && at <= +d('14:31'));
});
test('a newly critical task gets only one individual alert', () => {
  const t = task({ deadline: d('10:00').toISOString(), remainingMinutes: 60 });
  const reminders = planReminders(state([t]), d('09:00')).filter((r) => r.entryId === t.id);
  assert.deepEqual(
    reminders.map((r) => r.level),
    ['Critical'],
  );
});
test('risk history prevents repeat alerts after remaining-work edits', () => {
  const t = task({
    deadline: d('11:00').toISOString(),
    remainingMinutes: 90,
    riskHistory: { Critical: d('08:00').toISOString(), Urgent: d('07:00').toISOString() },
  });
  assert.equal(planReminders(state([t]), d('09:00')).filter((r) => r.entryId === t.id).length, 0);
});
test('quiet critical alerts are suppressed and a wake summary is planned', () => {
  const t = task({ deadline: new Date('2026-10-05T07:30:00').toISOString(), remainingMinutes: 60 });
  const reminders = planReminders(state([t]), d('23:30'));
  assert.equal(reminders.find((r) => r.level === 'Critical').suppressed, true);
  assert.ok(reminders.some((r) => r.id === 'wake:2026-10-05'));
  assert.equal(
    planReminders(state([t], { criticalDuringSleep: true }), d('23:30')).find(
      (r) => r.level === 'Critical',
    ).suppressed,
    false,
  );
});
test('disabled notifications and completed tasks schedule nothing task-specific', () => {
  const t = task({ deadline: d('10:00').toISOString(), completedAt: d('08:00').toISOString() });
  assert.equal(planReminders(state([t], { notifications: false }), d('09:00')).length, 0);
  assert.equal(planReminders(state([t]), d('09:00')).filter((r) => r.entryId).length, 0);
});
test('OS queue is bounded and chronological', () => {
  const tasks = Array.from({ length: 100 }, (_, i) =>
    task({ start: new Date(+d('12:00') + i * 60000).toISOString() }),
  );
  const reminders = planReminders(state(tasks), d('09:00'));
  assert.equal(reminders.length, 60);
  assert.ok(reminders.every((r, i) => !i || r.at >= reminders[i - 1].at));
});
