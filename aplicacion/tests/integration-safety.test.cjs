const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// All backend and image calls are doubles. This runner never loads .env or a real Supabase client.
function loader(overrides = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    const absolute = path.resolve(__dirname, '..', file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} };
    cache.set(absolute, module);
    const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
    }).outputText;
    function localRequire(name) {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === '@/lib/supabase') throw new Error('Real Supabase is forbidden in local tests');
      if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
      throw new Error(`Unmocked dependency: ${name}`);
    }
    vm.runInNewContext(source, { require: localRequire, module, exports: module.exports, setTimeout, clearTimeout, URLSearchParams, ...globals }, { filename: absolute });
    return module.exports;
  }
  return load;
}

function clientDouble(resolveQuery = () => ({ data: [], error: null }), options = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => { calls.push({ operation: 'auth' }); return { data: { user: { id: 'owner' } }, error: null }; } },
    from(table) {
      const query = { table, filters: [], operation: 'select' };
      const chain = {
        select(fields) { query.fields = fields; return this; },
        eq(key, value) { query.filters.push([key, value]); return this; },
        neq(key, value) { query.filters.push([key, value]); return this; },
        order() { return this; },
        single() { query.single = true; return this; },
        insert(values) { query.operation = 'insert'; query.values = values; return this; },
        update(values) { query.operation = 'update'; query.values = values; return this; },
        then(resolve, reject) { calls.push(query); return Promise.resolve().then(() => resolveQuery(query)).then(resolve, reject); }
      };
      return chain;
    },
    storage: { from(bucket) { return {
      upload: async (storagePath, bytes, config) => { calls.push({ operation: 'upload', bucket, storagePath, size: bytes.byteLength, config }); return { error: null }; },
      createSignedUrl: async (storagePath, ttl) => { calls.push({ operation: 'sign', bucket, storagePath, ttl }); return { data: { signedUrl: 'https://example.invalid/signed-image' }, error: null }; },
      remove: async () => { throw new Error('Unverified cleanup must not execute'); }
    }; } },
    rpc: async () => { throw new Error('Unverified RPC must not execute'); }
  };
  Object.assign(client.auth, options.auth);
  return { client, calls };
}

function reportsFixture(priority) {
  return { id: 'incident', code: 'ZAC-1', title: 'Reporte real', description: 'Detalle', address_reference: 'Zona', status: 'REGISTRADO', priority, assigned_to: null, created_at: '2026-10-15T12:00:00Z', updated_at: '2026-10-15T12:00:00Z', category: { name: 'Agua potable' } };
}

test('real report reads retain numeric priorities and distinguish missing from invalid data', async () => {
  const values = [1, 2, 3, 4, undefined, null, 'MEDIA', '2', 0, 5, 1.5];
  const { client, calls } = clientDouble((query) => query.fields.includes('category:')
    ? { data: values.map(reportsFixture), error: null }
    : { data: null, error: { message: 'Optional relation is not installed' } });
  const reports = loader({ '@/lib/supabase': { supabase: client } })('src/services/reports.ts');
  const result = await reports.listReports();
  assert.deepEqual(Array.from(result, (row) => row.priority), [1, 2, 3, 4, undefined, null, null, null, null, null, null]);
  assert.equal(result[0].title, 'Reporte real');
  assert.ok(calls[0].fields.includes('priority'));
  assert.ok(!calls.some((query) => /difficulty|file_url|file_type/.test(query.fields ?? '')));
});

test('administrative writes stop before any backend call while capabilities are pending', async () => {
  const { client, calls } = clientDouble();
  const load = loader({ '@/lib/supabase': { supabase: client } });
  const users = load('src/services/users.ts');
  const catalogs = load('src/services/catalogs.ts');
  await assert.rejects(users.updateManagedUser({ id: 'account', role: 'ciudadano', status: 'ACTIVO', departmentId: null }), /Pendiente/);
  await assert.rejects(catalogs.updateCatalogItem('departments', 1, false), /Pendiente/);
  const capabilities = load('src/lib/backendCapabilities.ts');
  for (const key of Object.keys(capabilities.backendCapabilities)) assert.throws(() => capabilities.requireBackendCapability(key), /Pendiente/);
  assert.equal(calls.length, 0);
});

test('a missing or unrelated profile never derives a visual administrator role from email', () => {
  const policy = loader()('src/services/sessionPolicy.ts');
  for (const role of [null, undefined, 'superadmin@example.invalid', 'admin', {}, 'INACTIVO']) assert.equal(policy.visualRoleFor(role), 'citizen');
  assert.equal(policy.visualRoleFor('mantenimiento'), 'maintenance');
  assert.equal(policy.visualRoleFor('administrador'), 'superadmin');
  assert.equal(policy.visualRoleFor('supervisor'), 'admin');
});

test('staff evidence upload remains blocked before storage or image fetching', async () => {
  const { client, calls } = clientDouble(() => ({ data: { id: 'incident', citizen_id: 'someone-else' }, error: null }));
  const reports = loader({ '@/lib/supabase': { supabase: client } }, { fetch: () => { throw new Error('Image fetch must not execute'); } })('src/services/reports.ts');
  await assert.rejects(reports.uploadReportEvidence('incident', { uri: 'local://image', mimeType: 'image/jpeg' }), /Pendiente/);
  assert.ok(!calls.some((call) => call.operation === 'upload' || call.operation === 'insert'));
});

test('citizen evidence uses existing columns and preserves the incident when linking fails', async () => {
  const { client, calls } = clientDouble((query) => query.operation === 'insert'
    ? { data: null, error: { message: 'Link denied' } }
    : { data: { id: 'incident', citizen_id: 'owner' }, error: null });
  const reports = loader({ '@/lib/supabase': { supabase: client } }, { fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) }) })('src/services/reports.ts');
  await assert.rejects(reports.uploadReportEvidence('incident', { uri: 'local://image', mimeType: 'image/jpeg' }), (error) => error instanceof reports.EvidenceLinkError);
  const insert = calls.find((call) => call.operation === 'insert');
  assert.equal(insert.table, 'incident_evidence');
  assert.deepEqual(Object.keys(insert.values).sort(), ['incident_id', 'mime_type', 'storage_path', 'uploaded_by']);
  assert.ok(insert.values.storage_path.startsWith('owner/incident/'));
  assert.ok(!calls.some((call) => call.operation === 'update' || (call.operation === 'insert' && call.table === 'incidents')));
});

test('signed photographs must belong to a visible incident and its recorded uploader', async () => {
  const { client, calls } = clientDouble((query) => query.table === 'incidents'
    ? { data: { id: 'incident' }, error: null }
    : { data: [{ id: 'photo', storage_path: 'other/another-incident/photo.jpg', uploaded_by: 'owner', created_at: '2026-10-15T12:00:00Z' }], error: null });
  const reports = loader({ '@/lib/supabase': { supabase: client } })('src/services/reports.ts');
  await assert.rejects(reports.listReportEvidence('incident'), /ruta de evidencia/);
  assert.ok(!calls.some((call) => call.operation === 'sign'));
});

test('invisible incidents never generate signed storage URLs', async () => {
  const { client, calls } = clientDouble(() => ({ data: null, error: { message: 'not visible' } }));
  const reports = loader({ '@/lib/supabase': { supabase: client } })('src/services/reports.ts');
  await assert.rejects(reports.listReportEvidence('incident'), /no está disponible/);
  assert.ok(!calls.some((call) => call.operation === 'sign' || call.table === 'incident_evidence'));
});

test('valid evidence receives a private URL lasting fifteen minutes', async () => {
  const { client, calls } = clientDouble((query) => query.table === 'incidents'
    ? { data: { id: 'incident' }, error: null }
    : { data: [{ id: 'photo', storage_path: 'owner/incident/photo.jpg', uploaded_by: 'owner', mime_type: 'image/jpeg', created_at: '2026-10-15T12:00:00Z' }], error: null });
  const reports = loader({ '@/lib/supabase': { supabase: client } })('src/services/reports.ts');
  assert.equal((await reports.listReportEvidence('incident')).length, 1);
  assert.equal(calls.find((call) => call.operation === 'sign').ttl, 900);
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('report reloads ignore older responses and responses arriving after blur', async () => {
  const pending = [];
  const states = [];
  let focus;
  const load = loader({
    react: { useState(initial) { const index = states.length; states.push(initial); return [initial, (value) => { states[index] = value; }]; }, useRef: (value) => ({ current: value }), useCallback: (callback) => callback },
    'expo-router': { useFocusEffect: (callback) => { focus = callback; } },
    '@/lib/supabase': { isSupabaseConfigured: true },
    '@/context/SessionContext': { useSession: () => ({ email: 'citizen@example.invalid', databaseRole: 'ciudadano', isAuthenticated: true }) },
    '@/services/reports': { listReports: () => { const item = deferred(); pending.push(item); return item.promise; } }
  });
  const hook = load('src/hooks/useReports.ts').useReports();
  const blur = focus();
  const reload = hook.reload();
  pending[1].resolve([{ id: 'latest' }]); await reload;
  pending[0].resolve([{ id: 'stale' }]); await new Promise(setImmediate);
  assert.equal(states[0][0].id, 'latest');
  const last = hook.reload(); blur(); pending[2].resolve([{ id: 'after-blur' }]); await last;
  assert.equal(states[0][0].id, 'latest');
});

test('photo optimization avoids enlarging small images and compresses large JPEGs', async () => {
  for (const width of [800, 2400]) {
    const resized = [];
    const saved = [];
    const image = { width, saveAsync: async (options) => { saved.push(options); return { uri: 'local://optimized' }; } };
    const module = loader({
      'expo-image-picker': {},
      'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: () => ({ renderAsync: async () => image, resize: (size) => resized.push(size) }) } }
    })('src/services/evidenceImages.ts');
    assert.equal((await module.optimizeEvidence('local://source')).mimeType, 'image/jpeg');
    assert.equal(resized.length, width > 1600 ? 1 : 0);
    if (width > 1600) assert.equal(resized[0].width, 1600);
    assert.equal(saved[0].compress, 0.72);
  }
});

function sessionHarness(client) {
  const slots = [];
  const effects = [];
  let index = 0;
  const react = {
    createContext: () => ({ Provider: 'SessionProviderDouble' }),
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = initial;
      return [slots[slot], (value) => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value; }];
    },
    useRef(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = { current: initial }; return slots[slot]; },
    useCallback: (callback) => callback,
    useMemo: (callback) => callback(),
    useEffect: (callback) => { effects.push(callback); }
  };
  const module = loader({
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { Platform: { OS: 'web' } },
    'expo-linking': { getInitialURL: async () => null, createURL: () => 'zacapp://reset-password', addEventListener: () => ({ remove() {} }) },
    '@/lib/supabase': { supabase: client, isSupabaseConfigured: true }
  })('src/context/SessionContext.tsx');
  return {
    render() { index = 0; return module.SessionProvider({ children: null }).props.value; },
    mount() { return effects.splice(0).map((effect) => effect()); }
  };
}

test('profile query failure leaves the actual session provider without administrative privileges', async () => {
  const { client } = clientDouble(() => ({ data: null, error: { message: 'Profile unavailable' } }));
  client.auth.getSession = async () => ({ data: { session: { user: { id: 'account', email: 'superadmin@example.invalid', user_metadata: { role: 'administrador' } } } }, error: null });
  client.auth.onAuthStateChange = () => ({ data: { subscription: { unsubscribe() {} } } });
  client.auth.updateUser = async () => { throw new Error('Normal sessions must not use recovery update'); };
  const harness = sessionHarness(client);
  harness.render();
  const cleanups = harness.mount();
  await new Promise(setImmediate);
  const session = harness.render();
  assert.equal(session.role, 'citizen');
  assert.equal(session.databaseRole, null);
  assert.ok(session.profileError);
  assert.equal(session.isLoading, false);
  assert.equal(session.isPasswordRecovery, false);
  await assert.rejects(session.completePasswordRecovery('x'.repeat(12)), /enlace de recuperación/);
  await assert.rejects(session.updateProfile('Nombre', ''), /Pendiente/);
  cleanups.forEach((cleanup) => cleanup?.());
});

test('a delayed administrative profile cannot replace a newer citizen identity', async () => {
  const oldProfile = deferred();
  const newProfile = deferred();
  let authListener;
  const { client } = clientDouble((query) => query.filters.some(([key, value]) => key === 'id' && value === 'old') ? oldProfile.promise : newProfile.promise);
  client.auth.getSession = async () => ({ data: { session: { user: { id: 'old', email: 'old@example.invalid' } } }, error: null });
  client.auth.onAuthStateChange = (listener) => { authListener = listener; return { data: { subscription: { unsubscribe() {} } } }; };
  const harness = sessionHarness(client);
  harness.render(); const cleanups = harness.mount();
  await new Promise(setImmediate);
  authListener('SIGNED_IN', { user: { id: 'new', email: 'new@example.invalid' } });
  await new Promise((resolve) => setTimeout(resolve, 5));
  newProfile.resolve({ data: { full_name: 'Nuevo', role: 'ciudadano', department: null }, error: null });
  await new Promise(setImmediate);
  oldProfile.resolve({ data: { full_name: 'Anterior', role: 'administrador', department: null }, error: null });
  await new Promise(setImmediate);
  const session = harness.render();
  assert.equal(session.email, 'new@example.invalid');
  assert.equal(session.fullName, 'Nuevo');
  assert.equal(session.role, 'citizen');
  assert.equal(session.databaseRole, 'ciudadano');
  cleanups.forEach((cleanup) => cleanup?.());
});
