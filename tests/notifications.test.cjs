// Exercise the native scheduler adapter against an in-memory OS queue and storage ledger.
const fs = require('node:fs');
const ts = require('typescript');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const compile = (file) =>
  ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
require.extensions['.ts'] = (module, filename) => module._compile(compile(filename), filename);
const { emptyData, defaults, newEntry } = require('../src/core/model.ts');
const reminders = require('../src/core/reminders.ts');
function harness() {
  let now = +new Date('2026-10-04T09:00:00'),
    granted = true;
  const scheduled = new Map(),
    storage = new Map(),
    cancellations = [];
  class Clock extends Date {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }
    static now() {
      return now;
    }
  }
  const api = {
    setNotificationHandler() {},
    getPermissionsAsync: async () => ({ granted }),
    getAllScheduledNotificationsAsync: async () => [...scheduled.values()],
    cancelScheduledNotificationAsync: async (id) => {
      cancellations.push(id);
      scheduled.delete(id);
    },
    scheduleNotificationAsync: async (request) => {
      scheduled.set(request.identifier, request);
      return request.identifier;
    },
    SchedulableTriggerInputTypes: { DATE: 'date' },
  };
  const modules = {
    '@react-native-async-storage/async-storage': {
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => {
        storage.set(key, value);
      },
    },
    'expo-notifications': api,
    'react-native': { Platform: { OS: 'android' } },
    '@/core/reminders': reminders,
  };
  const exports = {};
  new Function(
    'require',
    'exports',
    'Date',
    compile(require.resolve('../src/services/notifications.ts')),
  )((name) => modules[name], exports, Clock);
  const task = {
    ...newEntry(60),
    title: 'Assignment',
    deadline: new Date(now + 60 * 60000).toISOString(),
  };
  const data = {
    ...emptyData(),
    onboarded: true,
    entries: [task],
    settings: { ...defaults, notifications: true, reviewReminder: false, wakeSummary: false },
  };
  return {
    ...exports,
    data,
    scheduled,
    cancellations,
    setNow: (value) => {
      now = value;
    },
    advance: (ms) => {
      now += ms;
    },
    deny: () => {
      granted = false;
    },
  };
}
test('delayed Android alarm is retained until the OS consumes it', async () => {
  const h = harness();
  let data = await h.syncNotifications(h.data);
  assert.equal(h.scheduled.size, 1);
  const [id, request] = [...h.scheduled][0];
  h.advance(120000);
  data = await h.syncNotifications(data);
  assert.equal(data.entries[0].riskHistory.Critical, undefined);
  assert.equal(h.scheduled.get(id).trigger.date.getTime(), request.trigger.date.getTime());
  assert.equal(h.cancellations.length, 0);
  h.scheduled.delete(id);
  data = await h.syncNotifications(data);
  assert.ok(data.entries[0].riskHistory.Critical);
  assert.equal(h.scheduled.size, 0);
});
test('completion removes an upcoming task reminder', async () => {
  const h = harness();
  const data = await h.syncNotifications(h.data);
  await h.syncNotifications({
    ...data,
    entries: data.entries.map((e) => ({ ...e, completedAt: '2026-10-04T09:00:01.000Z' })),
  });
  assert.equal(h.scheduled.size, 0);
});
test('denied permissions cancel owned reminders without deleting unrelated alarms', async () => {
  const h = harness();
  await h.syncNotifications(h.data);
  h.scheduled.set('unrelated', { identifier: 'unrelated' });
  h.deny();
  await h.syncNotifications(h.data);
  assert.deepEqual([...h.scheduled.keys()], ['unrelated']);
});
test('an explicit deadline edit gets fresh eligibility without inheriting the old ledger', async () => {
  const h = harness();
  await h.syncNotifications(h.data);
  h.scheduled.clear();
  h.advance(120000);
  const data = {
    ...h.data,
    entries: h.data.entries.map((e) => ({
      ...e,
      deadline: new Date(Date.parse(e.deadline) + 60000).toISOString(),
      riskHistory: {},
    })),
  };
  const result = await h.syncNotifications(data);
  assert.deepEqual(result.entries[0].riskHistory, {});
  assert.equal(h.scheduled.size, 1);
});
test('suppressed quiet alerts are consumed without individual replay at wake time', async () => {
  const h = harness();
  h.setNow(+new Date('2026-10-04T23:30:00'));
  let data = {
    ...h.data,
    entries: h.data.entries.map((e) => ({
      ...e,
      deadline: new Date('2026-10-05T07:30:00').toISOString(),
    })),
  };
  data = await h.syncNotifications(data);
  assert.equal(h.scheduled.size, 0);
  h.setNow(+new Date('2026-10-05T07:00:00'));
  data = await h.syncNotifications(data);
  assert.ok(data.entries[0].riskHistory.Critical);
  assert.equal(h.scheduled.size, 0);
});
