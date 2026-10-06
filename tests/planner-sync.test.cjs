const fs = require('node:fs');
const ts = require('typescript');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const source = ts.transpileModule(fs.readFileSync('src/services/planner-sync.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const account = { user: { id: 'alice' }, token: 'token' };
function setup(remote) {
  const storage = new Map(),
    writes = [],
    exports = {};
  new Function('require', 'exports', source)((name) => {
    if (name.includes('async-storage'))
      return {
        getItem: async (k) => storage.get(k) ?? null,
        setItem: async (k, v) => storage.set(k, v),
      };
    if (name.includes('model')) return { emptyData: () => ({ entries: [] }) };
    if (name.includes('backup')) return { validateBackup: JSON.parse };
    return {
      ApiError,
      api: async (_, __, body) => {
        if (body) {
          writes.push(body);
          return { revision: remote.revision + 1 };
        }
        return remote;
      },
    };
  }, exports);
  return { ...exports, storage, writes };
}
test('accounts have isolated persisted planners; no automatic legacy adoption', async () => {
  const h = setup({ revision: 0, data: null });
  h.storage.set('planly:data:1', JSON.stringify({ entries: ['legacy'] }));
  await h.persistPlanner('alice', { data: { entries: ['alice'] }, revision: 2, dirty: true });
  assert.deepEqual((await h.readPlanner('bob')).data.entries, []);
  assert.deepEqual((await h.readPlanner('alice')).data.entries, ['alice']);
  assert.deepEqual((await h.legacyPlanner()).entries, ['legacy']);
});
test('conflict preserves dirty local data until explicit choice', async () => {
  const h = setup({ revision: 3, data: { entries: ['server'] } });
  const cache = { revision: 2, dirty: true, data: { entries: ['local'] } };
  await assert.rejects(h.exchangePlanner(account, cache), (e) => e.status === 409);
  assert.equal(h.writes.length, 0);
  assert.equal(cache.dirty, true);
  assert.deepEqual((await h.exchangePlanner(account, cache, 'server')).data.entries, ['server']);
  await h.exchangePlanner(account, cache, 'device');
  assert.equal(h.writes[0].revision, 3);
});
test('lost PUT response is acknowledged despite JSONB key reordering', async () => {
  const h = setup({ revision: 4, data: { b: 2, a: 1 } });
  const result = await h.exchangePlanner(account, {
    revision: 3,
    dirty: true,
    data: { a: 1, b: 2, clearedDeadline: undefined },
  });
  assert.equal(result.dirty, false);
  assert.equal(result.revision, 4);
  assert.equal(h.writes.length, 0);
});
