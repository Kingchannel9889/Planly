// Exercise the actual providers with deterministic hooks and in-memory device storage.
const fs = require('node:fs');
const ts = require('typescript');
const { test } = require('node:test');
const assert = require('node:assert/strict');
function compile(file, dependencies) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', 'setInterval', 'clearInterval', source)(
    (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    exports,
    () => 1,
    () => {},
  );
  return exports;
}
function hooks() {
  const slots = [],
    effects = [];
  let cursor = 0,
    mounted = false;
  return {
    react: {
      createContext: () => ({ Provider: 'provider' }),
      useContext: () => {},
      useState: (initial) => {
        const i = cursor++;
        if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
        return [
          slots[i],
          (value) => {
            slots[i] = typeof value === 'function' ? value(slots[i]) : value;
          },
        ];
      },
      useRef: (value) => {
        const i = cursor++;
        if (!(i in slots)) slots[i] = { current: value };
        return slots[i];
      },
      useCallback: (fn) => fn,
      useEffect: (fn) => {
        if (!mounted) effects.push(fn);
      },
    },
    render: (component) => {
      cursor = 0;
      return component({ children: null }).props.value;
    },
    mount: async () => {
      mounted = true;
      effects.forEach((fn) => fn());
      await new Promise(setImmediate);
    },
  };
}
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const mode = { LOCAL_ONLY: true, LOCAL_PLANNER_ID: 'device-only' };
const forbidden = async () => {
  throw new Error('Local mode must not call account services');
};

test('local launch is ready without reading credentials, signing in, or cancelling reminders', async () => {
  const h = hooks();
  const { SessionProvider } = compile('src/store/session-store.tsx', {
    react: h.react,
    'react/jsx-runtime': jsx,
    '@/core/app-mode': mode,
    '@/services/session': { readSession: forbidden, signIn: forbidden, signOut: forbidden },
    '@/services/account-reminders': { stopAccountReminders: forbidden },
    '@/services/credentials': { removeCredential: forbidden },
  });
  let session = h.render(SessionProvider);
  assert.equal(session.active, true);
  assert.equal(session.ready, true);
  assert.equal(session.account, null);
  await h.mount();
  await session.expire();
  session = h.render(SessionProvider);
  assert.equal(session.active, true);
  assert.equal(session.error, '');
});

test('local planner opens offline, saves, survives restart, and preserves account storage', async () => {
  const storage = new Map([['alice', 'existing account bytes']]);
  const emptyData = () => ({ version: 1, onboarded: false, entries: [], settings: {} });
  let failWrites = false;
  async function open() {
    const h = hooks();
    const { PlannerProvider } = compile('src/store/planner-store.tsx', {
      react: h.react,
      'react/jsx-runtime': jsx,
      '@/core/app-mode': mode,
      'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
      '@/core/model': { emptyData },
      './session-store': { useSession: () => ({ account: null, expire: forbidden }) },
      '@/services/api': { ApiError: Error },
      '@/services/account-reminders': {
        startAccountReminders() {},
        accountReminders: async (_, data) => data,
      },
      '@/services/planner-sync': {
        readPlanner: async (id) =>
          storage.has(id)
            ? JSON.parse(storage.get(id))
            : { data: emptyData(), revision: 0, dirty: false },
        persistPlanner: async (id, data) => {
          if (failWrites) throw new Error('Disk full');
          storage.set(id, JSON.stringify(data));
        },
        exchangePlanner: forbidden,
      },
    });
    const component = PlannerProvider({ children: null }).type;
    h.render(component);
    await h.mount();
    return () => h.render(component);
  }
  let current = await open();
  assert.equal(current().ready, true);
  await current().change((data) => ({ ...data, onboarded: true }));
  await current().save({
    id: 'local-task',
    title: 'Offline task',
    riskHistory: {},
    inProgress: false,
  });
  await current().sync();
  assert.equal(current().syncStatus, 'Saved on this device');
  current = await open();
  assert.equal(current().data.onboarded, true);
  assert.equal(current().data.entries[0].title, 'Offline task');
  failWrites = true;
  await assert.rejects(current().remove('local-task'), /Disk full/);
  assert.equal(current().data.entries.length, 1);
  assert.equal(storage.get('alice'), 'existing account bytes');
});

test('local edition blocks accidental API requests before fetching', async () => {
  const { api } = compile('src/services/api.ts', {
    './request-options': { requestOptions: {} },
    '@/core/app-mode': mode,
  });
  await assert.rejects(api('/auth/session'), /this device only/);
});
