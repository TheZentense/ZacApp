const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// All backend and image calls are doubles. This runner never loads .env or a real Supabase client.
function loader(overrides = {}, globals = {}) {
  const cache = new Map();
  const nativeDoubles = {
    'react-native': { Platform: { OS: 'android' } },
    'expo-file-system': { File: class { constructor() { throw new Error('Local file access must be mocked'); } } },
    'expo-image-picker': {},
    'expo-image-manipulator': {},
    'expo-crypto': { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
    'expo-location': {
      Accuracy: { High: 5 },
      requestForegroundPermissionsAsync: async () => ({ granted: true }),
      getCurrentPositionAsync: async () => ({ coords: { latitude: 14.6349, longitude: -90.5069, accuracy: 10 } })
    }
  };
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
      if (Object.hasOwn(nativeDoubles, name)) return nativeDoubles[name];
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
        then(resolve, reject) {
          calls.push(query);
          return Promise.resolve().then(() => query.table === 'profiles' && query.fields === 'role, department_id'
            ? { data: options.profile ?? { role: 'ciudadano', department_id: null }, error: options.profileError ?? null }
            : resolveQuery(query)).then(resolve, reject);
        }
      };
      return chain;
    },
    storage: { from(bucket) { return {
      upload: async (storagePath, bytes, config) => { calls.push({ operation: 'upload', bucket, storagePath, size: bytes.byteLength, config }); return { error: null }; },
      createSignedUrl: async (storagePath, ttl) => { calls.push({ operation: 'sign', bucket, storagePath, ttl }); return { data: { signedUrl: 'https://example.invalid/signed-image' }, error: null }; },
      remove: async (storagePaths) => { calls.push({ operation: 'remove', bucket, storagePaths }); return { error: null }; }
    }; } },
    rpc: async (name, values) => {
      calls.push({ operation: 'rpc', name, values });
      if (options.rpc) return options.rpc(name, values);
      throw new Error('Unverified RPC must not execute');
    }
  };
  Object.assign(client.auth, options.auth);
  return { client, calls };
}

function reportsFixture(priority) {
  return { id: 'incident', code: 'ZAC-1', title: 'Reporte real', description: 'Detalle', address_reference: 'Zona', status: 'REGISTRADO', priority, assigned_to: null, created_at: '2026-10-15T12:00:00Z', updated_at: '2026-10-15T12:00:00Z', category: { name: 'Agua potable' } };
}

test('workflow permissions come from the verified database role, never the shared visual role', () => {
  const policy = loader()('src/services/sessionPolicy.ts');
  for (const role of ['coordinador', 'comunicacion', 'supervisor', 'employee', 'superadmin', null, undefined]) {
    const permissions = policy.workflowPermissionsFor(role);
    assert.equal(permissions.generalReports, false);
    assert.equal(permissions.departmentReports, false);
    assert.equal(policy.reportReadScopeFor(role), 'pending');
  }
  assert.equal(policy.reportReadScopeFor('administrador'), 'general');
  assert.equal(policy.reportReadScopeFor('mantenimiento'), 'department');
  assert.equal(policy.reportReadScopeFor('operador'), 'personal');
  assert.equal(policy.reportReadScopeFor('ciudadano'), 'citizen');
});

test('operator report, history and evidence reads are constrained to the authenticated assignee', async () => {
  const { client, calls } = clientDouble((query) => {
    if (query.table === 'incidents' && query.fields.includes('category:')) return { data: [reportsFixture(2)], error: null };
    if (query.table === 'incidents') return { data: { id: 'incident' }, error: null };
    return { data: [], error: null };
  }, { profile: { role: 'operador', department_id: 7 } });
  const reports = loader({ '@/lib/supabase': { supabase: client } })('src/services/reports.ts');
  await reports.listReports();
  await reports.listReportHistory('incident');
  await reports.listReportEvidence('incident');
  const incidentQueries = calls.filter((call) => call.table === 'incidents');
  assert.equal(incidentQueries.length, 3);
  assert.ok(incidentQueries.every((query) => query.filters.some(([key, value]) => key === 'assigned_to' && value === 'owner')));
});

test('citizen, operator and department reads include verified query restrictions', async () => {
  for (const role of ['ciudadano', 'operador', 'mantenimiento', 'administrador']) {
    const { client, calls } = clientDouble((query) => ({ data: query.fields.includes('category:') ? [reportsFixture(2)] : [], error: null }), { profile: { role, department_id: 7 } });
    const reports = loader({ '@/lib/supabase': { supabase: client } })('src/services/reports.ts');
    await reports.listReports();
    const queries = calls.filter((call) => call.table === 'incidents');
    assert.equal(queries.length, 1);
    for (const query of queries) {
      const expected = role === 'ciudadano' ? ['citizen_id', 'owner'] : role === 'operador' ? ['assigned_to', 'owner'] : role === 'mantenimiento' ? ['assigned_department_id', 7] : null;
      if (expected) assert.ok(query.filters.some(([key, value]) => key === expected[0] && value === expected[1]));
      else assert.equal(query.filters.length, 0);
    }
  }
});

test('unverified profiles or missing departments never fall back to a general report query', async () => {
  for (const options of [
    { profile: { role: 'mantenimiento', department_id: null } },
    { profile: { role: 'mantenimiento', department_id: 'Agua potable' } },
    { profile: { role: 'mantenimiento', department_id: -1 } },
    { profileError: { message: 'Profile denied' } },
    { profile: { role: 'supervisor', department_id: 7 } }
  ]) {
    const { client, calls } = clientDouble(() => { throw new Error('Unexpected report query'); }, options);
    const reports = loader({ '@/lib/supabase': { supabase: client } })('src/services/reports.ts');
    await assert.rejects(reports.listReports());
    assert.ok(!calls.some((call) => call.table === 'incidents'));
  }
});

test('state updates use the atomic RPC and never fall back to direct table updates', async () => {
  const { client, calls } = clientDouble();
  const reports = loader({ '@/lib/supabase': { supabase: client } })('src/services/reports.ts');
  await assert.rejects(reports.updateReportStatus('incident', 'POR_VERIFICAR', 'CERRADO', 'Cierre verificado'), /Unverified RPC/);
  assert.ok(!calls.some((call) => call.operation === 'update' || call.operation === 'insert'));
});

function workflowScreenHarness(databaseRole, incidents = [], visualRole, { isLoading = false, error = '', isPreview = false, width = 390 } = {}) {
  const slots = [];
  let index = 0;
  const jsx = (type, props) => ({ type, props });
  const role = visualRole ?? ({ administrador: 'superadmin', mantenimiento: 'maintenance', operador: 'employee', ciudadano: 'citizen' }[databaseRole] ?? 'employee');
  const components = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'Image', 'ActivityIndicator'].map((name) => [name, name]));
  const load = loader({
    react: {
      useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], (value) => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value; }]; },
      useMemo: (callback) => callback(), useEffect() {}, useRef: (current) => ({ current }), useCallback: (callback) => callback
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { ...components, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width }), StyleSheet: { create: (value) => value } },
    'expo-router': { Redirect: 'Redirect', router: {}, Tabs: { Screen: 'TabsScreen' } },
    '@/lib/supabase': { isSupabaseConfigured: true },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@/components/AppButton': { AppButton: 'AppButton' }, '@/components/IncidentCard': { IncidentCard: 'IncidentCard' },
    '@/components/EmptyState': { EmptyState: 'EmptyState' }, '@/components/DataState': { LoadingState: 'LoadingState', ErrorState: 'ErrorState' },
    '@/hooks/useReports': { useReports: () => ({ incidents, isLoading, error, reload() {}, isPreview }) },
    '@/services/reports': { listReportHistory() { assert.fail('Pending screens must not query history'); }, listReportEvidence() { assert.fail('Pending screens must not query evidence'); } },
    '@/context/SessionContext': { useSession: () => ({ role, databaseRole, userId: 'owner', department: 'Agua potable', departmentId: 7, isAuthenticated: true }) },
    '../../assets/images/zacapp-logo-dark.png': 0
  });
  return {
    render(file = 'app/(tabs)/reports.tsx') { index = 0; return load(file).default(); },
    renderExport(file, name, props) { index = 0; return load(file)[name](props); }
  };
}

test('mobile report navigation distinguishes department reports from personal tasks for all four roles', () => {
  for (const [role, label] of [['administrador', 'Reportes'], ['mantenimiento', 'Departamento'], ['operador', 'Mis tareas'], ['ciudadano', 'Mis reportes']]) {
    const tree = workflowScreenHarness(role, [], undefined, { width: 320 }).render('app/(tabs)/_layout.tsx');
    const reportsTab = nodes(tree).find((node) => node.props?.name === 'reports');
    assert.equal(reportsTab.props.options.tabBarLabel, label);
    assert.equal(tree.props.screenOptions.tabBarPosition, 'bottom');
  }
});

test('dashboard counters and closure percentage come only from the available incident rows', () => {
  const incidents = ['CERRADO', 'ASIGNADO', 'EN_ATENCION', 'POR_VERIFICAR'].map((status, index) => ({ ...reportsFixture(2), id: String(index), status }));
  const citizenTree = workflowScreenHarness('ciudadano', incidents).render('app/(tabs)/index.tsx');
  for (const label of ['En proceso: 3', 'Resueltos: 1', 'Total enviados: 4']) assert.ok(nodes(citizenTree).some((node) => node.props?.accessibilityLabel === label));
  assert.ok(nodes(citizenTree).some((node) => node.props?.children === '25%'));
  const departmentTree = workflowScreenHarness('mantenimiento', incidents).render('app/(tabs)/index.tsx');
  for (const label of ['Pendientes: 1', 'En atención: 2', 'Completadas: 1']) assert.ok(nodes(departmentTree).some((node) => node.props?.accessibilityLabel === label));
  assert.ok(nodes(departmentTree).some((node) => node.props?.children === 'Reportes recientes del departamento'));
  assert.ok(!nodes(departmentTree).some((node) => node.props?.children === 'Asignaciones recientes'));
});

test('loading, failed or preview queries never display zero counters or demonstration incident cards', () => {
  for (const state of [{ isLoading: true }, { error: 'Local query failed' }, { isPreview: true }]) {
    const tree = workflowScreenHarness('administrador', [reportsFixture(2)], undefined, state).render('app/(tabs)/index.tsx');
    const values = nodes(tree).filter((node) => node.props?.accessibilityLabel?.endsWith(': no disponible'));
    assert.equal(values.length, 3);
    assert.ok(values.every((node) => node.props.children === '—'));
    assert.equal(nodes(tree).filter((node) => node.type === 'IncidentCard').length, 0);
    assert.ok(!nodes(tree).some((node) => node.props?.title === 'Sin carga activa'));
  }
});

test('empty filtered report lists explain the result and restore all filters without writing data', () => {
  const incident = { ...reportsFixture(4), category: 'Agua potable', location: 'Zona real' };
  const harness = workflowScreenHarness('mantenimiento', [incident]);
  let tree = harness.render();
  nodes(tree).find((node) => node.type === 'TextInput').props.onChangeText('No existe este texto');
  tree = harness.render();
  assert.ok(nodes(tree).some((node) => node.type === 'EmptyState' && node.props.title === 'Sin coincidencias'));
  nodes(tree).find((node) => node.props?.label === 'Limpiar filtros').props.onPress();
  tree = harness.render();
  assert.equal(nodes(tree).filter((node) => node.type === 'IncidentCard').length, 1);
});

test('incident cards display real department and textual priority and tolerate an unavailable status', () => {
  const tree = workflowScreenHarness('mantenimiento').renderExport('src/components/IncidentCard.tsx', 'IncidentCard', {
    incident: { ...reportsFixture('URGENTE'), status: 'UNKNOWN', department: 'Agua potable', departmentId: 7 }
  });
  assert.ok(nodes(tree).some((node) => node.props?.children === 'Estado no disponible'));
  assert.ok(nodes(tree).some((node) => Array.isArray(node.props?.children) && node.props.children[0] === 'Departamento: ' && node.props.children[1] === 'Agua potable'));
  assert.ok(nodes(tree).some((node) => Array.isArray(node.props?.children) && node.props.children[0] === 'Prioridad: ' && node.props.children[1] === 'URGENTE'));
});

test('operator screen displays assigned work without administrative controls', () => {
  const incident = { ...reportsFixture(2), assignedToId: 'owner', status: 'ASIGNADO' };
  const harness = workflowScreenHarness('operador', [incident], 'superadmin');
  let tree = harness.render('app/(tabs)/reports.tsx');
  const card = nodes(tree).find((node) => node.type === 'IncidentCard');
  assert.ok(card);
  card.props.onPress();
  tree = harness.render('app/(tabs)/reports.tsx');
  const labels = nodes(tree).flatMap((node) => [node.props?.label, node.props?.title, typeof node.props?.children === 'string' ? node.props.children : '']).join(' ');
  assert.match(labels, /En atención/);
  assert.match(labels, /Evidencia de atención/);
  assert.doesNotMatch(labels, /Guardar asignación|Usuarios y accesos|Cerrar reporte/);
});

test('maintenance views never expose administrative assignment controls', () => {
  const incidents = [
    { ...reportsFixture(1), id: 'one', assignedToId: null, status: 'ASIGNADO' },
    { ...reportsFixture(4), id: 'two', assignedToId: 'real-profile-id', status: 'POR_VERIFICAR' }
  ];
  const harness = workflowScreenHarness('mantenimiento', incidents);
  let tree = harness.render();
  const cards = nodes(tree).filter((node) => node.type === 'IncidentCard');
  assert.equal(cards.length, 2);
  cards[1].props.onPress(); tree = harness.render();
  const labels = nodes(tree).flatMap((node) => [node.props?.label, node.props?.title, typeof node.props?.children === 'string' ? node.props.children : '']).join(' ');
  assert.doesNotMatch(labels, /Guardar asignación|Usuarios y accesos/);
});

test('administrator receives only the next valid workflow transitions', () => {
  const harness = workflowScreenHarness('administrador', [reportsFixture(2)]);
  let tree = harness.render();
  nodes(tree).find((node) => node.type === 'IncidentCard').props.onPress();
  tree = harness.render();
  const labels = nodes(tree).map((node) => node.props?.children).filter((value) => typeof value === 'string');
  assert.ok(labels.includes('En revisión'));
  assert.ok(labels.includes('Rechazado'));
  assert.ok(!labels.includes('Resuelto'));
});

test('changing identity hides earlier results and reloads personal operator tasks', async () => {
  let identity = { userId: 'admin-account', databaseRole: 'administrador', departmentId: null, isAuthenticated: true };
  const slots = [];
  let index = 0;
  let focus;
  let reads = 0;
  const hook = loader({
    react: {
      useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], (value) => { slots[slot] = value; }]; },
      useRef(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = { current: initial }; return slots[slot]; },
      useCallback: (callback) => callback
    },
    'expo-router': { useFocusEffect: (callback) => { focus = callback; } },
    '@/lib/supabase': { isSupabaseConfigured: true },
    '@/context/SessionContext': { useSession: () => identity },
    '@/services/reports': { listReports: async () => { reads++; return [{ id: 'administrative-report' }]; } }
  })('src/hooks/useReports.ts').useReports;
  const render = () => { index = 0; return hook(); };
  render(); const blur = focus(); await new Promise(setImmediate);
  assert.equal(render().incidents[0].id, 'administrative-report');
  identity = { userId: 'different-account', databaseRole: 'operador', departmentId: 7, isAuthenticated: true };
  assert.equal(render().incidents.length, 0);
  blur(); const nextBlur = focus(); await new Promise(setImmediate);
  assert.equal(render().incidents[0].id, 'administrative-report');
  assert.equal(reads, 2);
  nextBlur();
});

test('real report reads retain schema priorities and normalize missing or invalid values', async () => {
  const values = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE', undefined, null, 2, '2', 0, 5, 1.5];
  const { client, calls } = clientDouble((query) => query.fields.includes('category:')
    ? { data: values.map(reportsFixture), error: null }
    : { data: null, error: { message: 'Optional relation is not installed' } });
  const reports = loader({ '@/lib/supabase': { supabase: client } })('src/services/reports.ts');
  const result = await reports.listReports();
  assert.deepEqual(Array.from(result, (row) => row.priority), ['BAJA', 'MEDIA', 'ALTA', 'URGENTE', 'MEDIA', 'MEDIA', 'MEDIA', 'MEDIA', 'MEDIA', 'MEDIA', 'MEDIA']);
  assert.equal(result[0].title, 'Reporte real');
  assert.ok(calls.find((call) => call.table === 'incidents').fields.includes('priority'));
  assert.ok(!calls.some((query) => /difficulty|file_url|file_type/.test(query.fields ?? '')));
});

test('only verified optional backend entry points are enabled', () => {
  const capabilities = loader()('src/lib/backendCapabilities.ts');
  assert.doesNotThrow(() => capabilities.requireBackendCapability('staffEvidence'));
  for (const key of Object.keys(capabilities.backendCapabilities).filter((key) => key !== 'staffEvidence')) {
    assert.throws(() => capabilities.requireBackendCapability(key), /Pendiente/);
  }
});

test('operator RLS migration isolates tasks, history, evidence and transitions by assignee', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '..', 'supabase/migrations/202610170002_enable_operator_personal_tasks.sql'), 'utf8');
  assert.match(sql, /p\.role = 'operador' and i\.assigned_to = p\.id/);
  assert.match(sql, /assigned_to = \(select auth\.uid\(\)\)/);
  assert.match(sql, /current_user_can_read_incident\(incident_id\)/);
  assert.match(sql, /incident_row\.assigned_to is distinct from actor_id/);
  assert.match(sql, /users read permitted incident evidence/);
  assert.doesNotMatch(sql, /current_user_role\(\) <> 'ciudadano'/);
});

test('a missing or unrelated profile never derives a visual administrator role from email', () => {
  const policy = loader()('src/services/sessionPolicy.ts');
  for (const role of [null, undefined, 'superadmin@example.invalid', 'admin', {}, 'INACTIVO']) assert.equal(policy.visualRoleFor(role), 'citizen');
  assert.equal(policy.visualRoleFor('mantenimiento'), 'maintenance');
  assert.equal(policy.visualRoleFor('administrador'), 'superadmin');
  assert.equal(policy.visualRoleFor('supervisor'), 'admin');
});

test('staff evidence is uploaded and linked only after the incident is visible', async () => {
  const { client, calls } = clientDouble((query) => query.operation === 'insert'
    ? { data: null, error: null }
    : { data: { id: 'incident', citizen_id: 'someone-else', category_id: 1, category: { department: { code: 'AGUA' } } }, error: null });
  const reports = loader({
    '@/lib/supabase': { supabase: client },
    'expo-file-system': { File: class { exists = true; size = 64; async arrayBuffer() { return new ArrayBuffer(64); } } }
  })('src/services/reports.ts');
  await reports.uploadReportEvidence('incident', { uri: 'local://image', mimeType: 'image/jpeg' });
  assert.equal(calls.filter((call) => call.operation === 'upload').length, 1);
  const insert = calls.find((call) => call.operation === 'insert');
  assert.equal(insert.table, 'incident_evidence');
  assert.equal(insert.values.uploaded_by, 'owner');
  assert.equal(insert.values.evidence_kind, 'AVANCE');
  assert.match(insert.values.storage_path, /^reportes\/AGUA\/categoria-1\/\d{4}\/\d{2}\/incident\/personal-owner\//);
});

test('citizen evidence uses existing columns and preserves the incident when linking fails', async () => {
  const { client, calls } = clientDouble((query) => query.operation === 'insert'
    ? { data: null, error: { message: 'Link denied' } }
    : { data: { id: 'incident', citizen_id: 'owner', category_id: 1, category: { department: { code: 'AGUA' } } }, error: null });
  const reports = loader({
    '@/lib/supabase': { supabase: client },
    'expo-file-system': { File: class { exists = true; size = 64; async arrayBuffer() { return new ArrayBuffer(64); } } }
  })('src/services/reports.ts');
  await assert.rejects(reports.uploadReportEvidence('incident', { uri: 'local://image', mimeType: 'image/jpeg' }), (error) => error instanceof reports.EvidenceLinkError);
  const insert = calls.find((call) => call.operation === 'insert');
  assert.equal(insert.table, 'incident_evidence');
  assert.deepEqual(Object.keys(insert.values).sort(), ['evidence_kind', 'file_type', 'file_url', 'incident_id', 'mime_type', 'storage_path', 'uploaded_by']);
  assert.match(insert.values.storage_path, /^reportes\/.+\/categoria-/);
  assert.equal(calls.filter((call) => call.operation === 'remove').length, 1);
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
    '@/context/SessionContext': { useSession: () => ({ userId: 'owner', databaseRole: 'ciudadano', departmentId: null, isAuthenticated: true }) },
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
    const image = { width, height: 600, saveAsync: async (options) => { saved.push(options); return { uri: 'local://optimized' }; } };
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

test('native photographs use File.arrayBuffer and preserve binary JPEG bytes without fetch', async () => {
  for (const OS of ['android', 'ios']) {
    const expected = Uint8Array.from([255, 216, 0, 128, 255, 217]).buffer;
    const opened = [];
    const images = loader({
      'react-native': { Platform: { OS } },
      'expo-file-system': { File: class {
        exists = true; size = expected.byteLength;
        constructor(uri) { opened.push(uri); }
        async arrayBuffer() { return expected; }
      } }
    }, { fetch: () => { throw new Error('Native images must not use fetch'); } })('src/services/evidenceImages.ts');
    assert.equal(await images.readEvidenceBytes('file:///cache/evidence.jpg'), expected);
    assert.deepEqual(opened, ['file:///cache/evidence.jpg']);
  }
});

test('native evidence rejects missing, empty and oversized files, and rechecks actual bytes', async () => {
  const limit = 5 * 1024 * 1024;
  for (const scenario of [
    { exists: false, size: 64, actual: 64, reads: 0, error: /ya no está disponible/ },
    { exists: true, size: 0, actual: 0, reads: 0, error: /5 MB/ },
    { exists: true, size: limit + 1, actual: 64, reads: 0, error: /5 MB/ },
    { exists: true, size: 64, actual: limit + 1, reads: 1, error: /5 MB/ },
    { exists: true, size: 64, actual: 0, reads: 1, error: /5 MB/ },
    { exists: true, size: limit, actual: limit, reads: 1 }
  ]) {
    let reads = 0;
    const images = loader({ 'expo-file-system': { File: class {
      exists = scenario.exists; size = scenario.size;
      async arrayBuffer() { reads++; return new ArrayBuffer(scenario.actual); }
    } } })('src/services/evidenceImages.ts');
    if (scenario.error) await assert.rejects(images.readEvidenceBytes('file:///cache/photo.jpg'), scenario.error);
    else assert.equal((await images.readEvidenceBytes('file:///cache/photo.jpg')).byteLength, limit);
    assert.equal(reads, scenario.reads);
  }
});

test('web photographs retain the fetch path and enforce the same size limit', async () => {
  for (const size of [0, 64, 5 * 1024 * 1024 + 1]) {
    const images = loader({ 'react-native': { Platform: { OS: 'web' } } }, {
      fetch: async (uri) => { assert.equal(uri, 'blob:local-image'); return { ok: true, arrayBuffer: async () => new ArrayBuffer(size) }; }
    })('src/services/evidenceImages.ts');
    if (size === 64) assert.equal((await images.readEvidenceBytes('blob:local-image')).byteLength, 64);
    else await assert.rejects(images.readEvidenceBytes('blob:local-image'), /5 MB/);
  }
});

function reportScreenHarness(client, File) {
  const slots = [];
  const effects = [];
  let index = 0;
  const jsx = (type, props) => ({ type, props });
  const native = Object.fromEntries(['Image', 'Modal', 'Pressable', 'ScrollView', 'Text', 'TextInput', 'View'].map((name) => [name, name]));
  const load = loader({
    react: {
      useState(initial) {
        const slot = index++;
        if (!(slot in slots)) slots[slot] = initial;
        return [slots[slot], (value) => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value; }];
      },
      useRef(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = { current: initial }; return slots[slot]; },
      useCallback: (callback) => callback,
      useEffect(callback) { const slot = index++; if (!(slot in slots)) { slots[slot] = true; effects.push(callback); } }
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { ...native, Platform: { OS: 'android' }, Alert: { alert() { throw new Error('Unexpected alert'); } }, StyleSheet: { create: (value) => value } },
    'expo-file-system': { File },
    'expo-router': { Redirect: 'Redirect', router: {} },
    'expo-camera': { CameraView: 'CameraView', useCameraPermissions: () => [{ granted: true }, async () => ({ granted: true })] },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@/components/AppButton': { AppButton: 'AppButton' },
    '@/components/DataState': { ErrorState: 'ErrorState', LoadingState: 'LoadingState' },
    '@/lib/supabase': { supabase: client, isSupabaseConfigured: true },
    '@/context/SessionContext': { useSession: () => ({ role: 'citizen', email: 'ciudadano@zacapp.test', fullName: 'Ciudadano Prueba', isAuthenticated: true, isLoading: false, isPasswordRecovery: false }) },
    'expo-image-picker': { launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///cache/source.jpg' }] }) },
    'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: () => ({ renderAsync: async () => ({ width: 800, saveAsync: async () => ({ uri: 'file:///cache/photo.jpg' }) }) }) } }
  });
  const screen = load('app/report/new.tsx').default;
  return { render() { index = 0; return screen(); }, mount() { return effects.splice(0).map((effect) => effect()); } };
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}

test('the report screen submits atomically and blocks overlapping submissions', async () => {
  const { client, calls } = clientDouble((query) => {
    if (query.table === 'categories' && query.fields.includes('department:')) return { data: { id: 1, department: { code: 'AGUA' } }, error: null };
    if (query.table === 'categories') return { data: [{ id: 1, name: 'Agua potable' }], error: null };
    return { data: null, error: null };
  }, {
    rpc: async (name) => {
      assert.equal(name, 'create_incident_with_evidence');
      return { data: [{ id: 'new-incident', code: 'ZAC-2026-000003' }], error: null };
    }
  });
  const harness = reportScreenHarness(client, class {
    exists = true; size = 64;
    async arrayBuffer() { return new ArrayBuffer(64); }
  });
  harness.render(); harness.mount(); await new Promise(setImmediate);
  let tree = harness.render();
  const camera = nodes(tree).find((node) => node.type === 'CameraView');
  assert.equal(camera.props.children, undefined);
  const cameraContainer = nodes(tree).find((node) => Array.isArray(node.props?.children) && node.props.children.includes(camera));
  assert.equal(cameraContainer.props.children[1].props.style.position, 'absolute');
  const inputs = nodes(tree).filter((node) => node.type === 'TextInput');
  inputs[0].props.onChangeText('Falla de prueba local'); inputs[1].props.onChangeText('Ubicación local');
  const locationButton = nodes(tree).find((node) => node.type === 'Pressable' && nodes(node).some((child) => child.props?.children === 'Obtener ubicación GPS'));
  await locationButton.props.onPress();
  const gallery = nodes(tree).find((node) => node.type === 'Pressable' && nodes(node).some((child) => child.props?.children === 'Elegir de galería'));
  await gallery.props.onPress();
  tree = harness.render();
  const submit = nodes(tree).find((node) => node.props?.label === 'Enviar reporte').props.onPress;
  const firstSubmission = submit();
  await submit();
  await firstSubmission;
  tree = harness.render();
  assert.ok(nodes(tree).some((node) => node.props?.children === 'ZAC-2026-000003'));
  assert.equal(calls.filter((call) => call.operation === 'rpc').length, 1);
  assert.equal(calls.filter((call) => call.table === 'incidents' && call.operation === 'insert').length, 0);
  assert.equal(calls.filter((call) => call.table === 'incident_evidence' && call.operation === 'insert').length, 0);
  const upload = calls.find((call) => call.operation === 'upload');
  assert.equal(upload.bucket, 'incidente-evidencia');
  assert.match(upload.storagePath, /^reportes\/AGUA\/categoria-1\/\d{4}\/\d{2}\/00000000-0000-4000-8000-000000000001\/ciudadano-owner\/evidencia-inicial\.jpg$/);
  assert.equal(upload.config.contentType, 'image/jpeg');
  assert.equal(upload.config.upsert, false);
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
  await assert.rejects(session.updateProfile('Nombre', ''), /Unverified RPC/);
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
  newProfile.resolve({ data: { full_name: 'Nuevo', role: 'ciudadano', department_id: 7, department: { name: 'Área real' } }, error: null });
  await new Promise(setImmediate);
  oldProfile.resolve({ data: { full_name: 'Anterior', role: 'administrador', department: null }, error: null });
  await new Promise(setImmediate);
  const session = harness.render();
  assert.equal(session.email, 'new@example.invalid');
  assert.equal(session.fullName, 'Nuevo');
  assert.equal(session.role, 'citizen');
  assert.equal(session.databaseRole, 'ciudadano');
  assert.equal(session.userId, 'new');
  assert.equal(session.departmentId, 7);
  cleanups.forEach((cleanup) => cleanup?.());
});
