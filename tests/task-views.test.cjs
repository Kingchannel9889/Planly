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
const { defaults, newEntry } = require('../src/core/model.ts');
const { risk } = require('../src/core/planner.ts');
const { inTaskView, matchesAttention, matchesPriority } = require('../src/core/task-views.ts');
const now = new Date('2026-10-05T12:00:00');
test('chosen priority remains filterable independently of deadline risk', () => {
  const lowCritical = {
    ...newEntry(30, 'Low'),
    deadline: new Date(+now + 10 * 60000).toISOString(),
  };
  assert.equal(risk(lowCritical, [lowCritical], defaults, now).level, 'Critical');
  assert.equal(matchesPriority(lowCritical, 'Low'), true);
  assert.equal(matchesPriority(lowCritical, 'High'), false);
  assert.equal(
    matchesPriority({ ...newEntry(30, 'High'), completedAt: now.toISOString() }, 'High'),
    true,
  );
  assert.equal(matchesPriority({ ...newEntry(), kind: 'appointment' }, 'Medium'), false);
  assert.equal(matchesPriority({ ...newEntry(), kind: 'appointment' }, 'All'), true);
});
test('task views keep undated work discoverable and completed work separate', () => {
  const unscheduled = { ...newEntry(), title: 'Undated' };
  const today = { ...newEntry(), plannedDate: '2026-10-05' };
  const future = { ...newEntry(), plannedDate: '2026-10-06' };
  const done = { ...today, completedAt: now.toISOString() };
  const all = [unscheduled, today, future, done];
  const matches = (view) => all.filter((e) => inTaskView(e, view, all, defaults, now));
  assert.equal(matches('All').length, 4);
  assert.deepEqual(matches('Unscheduled'), [unscheduled]);
  assert.deepEqual(matches('Upcoming'), [future]);
  assert.deepEqual(matches('Today'), [today]);
  assert.deepEqual(matches('Completed'), [done]);
});
test('unscheduled future deadline remains visible in both appropriate views; attention can filter it', () => {
  const entry = { ...newEntry(), deadline: new Date('2026-10-06T18:00:00').toISOString() };
  assert.equal(inTaskView(entry, 'Upcoming', [entry], defaults, now), true);
  assert.equal(inTaskView(entry, 'Unscheduled', [entry], defaults, now), true);
  const overdue = { ...entry, deadline: new Date('2026-10-04T18:00:00').toISOString() };
  assert.equal(inTaskView(overdue, 'Today', [overdue], defaults, now), true);
  assert.equal(matchesAttention(overdue, 'Overdue', [overdue], defaults, now), true);
  assert.equal(matchesAttention(overdue, 'Appointments', [overdue], defaults, now), false);
});
