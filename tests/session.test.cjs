// Credential lifecycle cannot erase local planner data or accept the old local flag.
const fs = require('node:fs');
const ts = require('typescript');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const source = ts.transpileModule(fs.readFileSync('src/services/session.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
class ApiError extends Error {
  constructor(status) {
    super('request failed');
    this.status = status;
  }
}
const account = {
  token: 'opaque-token',
  expiresAt: '2099-01-01T00:00:00Z',
  user: { id: 'alice', email: 'alice@example.com' },
};
function harness(initial, failure) {
  const storage = new Map([
    ['planner', 'untouched'],
    ['old-local-session', 'active'],
  ]);
  let credential = initial ? JSON.stringify(initial) : null;
  const exports = {};
  new Function('require', 'exports', source)(
    (name) =>
      name === './api'
        ? {
            ApiError,
            api: async () => {
              if (failure) throw failure;
              return account;
            },
          }
        : {
            readCredential: async () => credential,
            writeCredential: async (value) => {
              credential = value;
            },
            removeCredential: async () => {
              credential = null;
            },
          },
    exports,
  );
  return { ...exports, storage, credential: () => credential };
}
test('old local active flag cannot authenticate; login then logout preserves planner bytes', async () => {
  const h = harness();
  assert.equal(await h.readSession(), null);
  await h.signIn('alice@example.com', 'long passphrase', false);
  assert.deepEqual(await h.readSession(), account);
  await h.signOut(account);
  assert.equal(h.credential(), null);
  assert.equal(h.storage.get('planner'), 'untouched');
});
test('server rejection and token expiry sign out; transient offline state retains valid local access', async () => {
  assert.equal(await harness(account, new ApiError(401)).readSession(), null);
  assert.equal(
    await harness({ ...account, expiresAt: '2000-01-01T00:00:00Z' }).readSession(),
    null,
  );
  assert.deepEqual(await harness(account, new ApiError(0)).readSession(), account);
});
test('failed online revocation retains credentials so logout can be retried', async () => {
  const h = harness(account, new ApiError(0));
  await assert.rejects(h.signOut(account));
  assert.ok(h.credential());
  assert.equal(h.storage.get('planner'), 'untouched');
});
