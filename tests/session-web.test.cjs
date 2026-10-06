const fs = require('node:fs');
const ts = require('typescript');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const source = ts.transpileModule(fs.readFileSync('src/services/session.web.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
class ApiError extends Error {
  constructor(status) {
    super('request failed');
    this.status = status;
  }
}
const account = {
  token: '',
  expiresAt: '2099-01-01T00:00:00Z',
  user: { id: 'alice', email: 'alice@example.com' },
};
function harness(api) {
  const exports = {};
  new Function('require', 'exports', source)((name) => {
    assert.equal(name, './api', 'Browser sessions must not access local planner storage');
    return { api, ApiError };
  }, exports);
  return exports;
}
test('browser reload restores the account using its cookie and a public identity guard', async () => {
  const h = harness(async (path) => {
    assert.equal(path, '/auth/session');
    return account;
  });
  assert.deepEqual(await h.readSession(), { ...account, token: 'alice' });
});
test('browser login verifies cookie acceptance before returning an authenticated session', async () => {
  const calls = [];
  const h = harness(async (...args) => {
    calls.push(args);
    return account;
  });
  assert.equal((await h.signIn(' alice@example.com ', '123456', false)).token, 'alice');
  assert.deepEqual(calls, [
    ['/auth/login', undefined, { email: 'alice@example.com', password: '123456' }],
    ['/auth/session'],
  ]);
  const blocked = harness(async (path) => {
    if (path === '/auth/session') throw new ApiError(401);
    return account;
  });
  await assert.rejects(
    blocked.signIn('alice@example.com', '123456', true),
    /blocked the sign-in cookie/,
  );
});
test('browser expiry signs out but a network failure remains an error, not a false logout', async () => {
  assert.equal(
    await harness(async () => {
      throw new ApiError(401);
    }).readSession(),
    null,
  );
  await assert.rejects(
    harness(async () => {
      throw new ApiError(0);
    }).readSession(),
  );
});
test('browser logout uses the account guard, tolerates expiry and allows retry after failure', async () => {
  const h = harness(async (...args) => {
    assert.deepEqual(args, ['/auth/logout', 'alice', {}, 'POST']);
  });
  await h.signOut(account);
  await harness(async () => {
    throw new ApiError(401);
  }).signOut(account);
  await assert.rejects(
    harness(async () => {
      throw new ApiError(0);
    }).signOut(account),
  );
});
