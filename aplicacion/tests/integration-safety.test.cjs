const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// All backend and image calls are doubles. This runner never loads .env or a real Supabase client.
function loader(overrides = {}, globals = {}) {
  const cache = new Map();
  let uuidSequence = 0;
  const nativeDoubles = {
    'expo-crypto': { randomUUID: () => `00000000-0000-4000-8000-${String(++uuidSequence).padStart(12, '0')}` },
    'react-native': { Platform: { OS: 'android' } },
    'expo-file-system': { File: class { constructor() { throw new Error('Local file access must be mocked'); } } },
    'expo-image-picker': {},
    'expo-image-manipulator': {}
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
      if (name.startsWith('@/')) {
        const modulePath = `src/${name.slice(2)}`;
        const tsxPath = path.resolve(__dirname, '..', `${modulePath}.tsx`);
        return load(fs.existsSync(tsxPath) ? `${modulePath}.tsx` : `${modulePath}.ts`);
      }
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
      upload: async (storagePath, bytes, config) => { calls.push({ operation: 'upload', bucket, storagePath, size: bytes.byteLength, config }); return options.upload ? options.upload(storagePath, bytes, config) : { error: null }; },
      createSignedUrl: async (storagePath, ttl) => { calls.push({ operation: 'sign', bucket, storagePath, ttl }); return { data: { signedUrl: 'https://example.invalid/signed-image' }, error: null }; },
      remove: async (paths) => {
        if (!options.remove) throw new Error('Unverified cleanup must not execute');
        calls.push({ operation: 'remove', bucket, paths: [...paths] });
        return options.remove(paths);
      }
    }; } },
    rpc: async (name, parameters) => {
      if (!options.rpc) throw new Error('Unverified RPC must not execute');
      calls.push({ operation: 'rpc', name, parameters });
      return options.rpc(name, parameters);
    }
  };
  Object.assign(client.auth, options.auth);
  return { client, calls };
}

function reportsFixture(priority) {
  return { id: 'incident', code: 'ZAC-1', title: 'Reporte real', description: 'Detalle', address_reference: 'Zona', status: 'REGISTRADO', priority, assigned_to: null, created_at: '2026-10-15T12:00:00Z', updated_at: '2026-10-15T12:00:00Z', category: { name: 'Agua potable' } };
}

function creationClientDouble(options = {}) {
  return clientDouble((query) => {
    assert.equal(query.table, 'categories', 'Creation must not access incident tables directly');
    assert.equal(query.operation, 'select');
    return { data: query.single ? { id: 1, department: { code: 'AGUA' } } : [{ id: 1, name: 'Agua potable' }], error: null };
  }, {
    remove: async () => ({ error: null }),
    rpc: async (name, parameters) => {
      assert.equal(name, 'create_incident_with_evidence');
      return { data: [{ id: parameters.p_incident_id, code: 'ZAC-2026-000003' }], error: null };
    },
    ...options
  });
}

function reportInput(count = 1) {
  return {
    categoryId: 1, description: '  Falla de prueba local  ', location: '  Ubicación local  ', latitude: 14.97, longitude: -89.53,
    evidence: Array.from({ length: count }, (_, index) => ({ uri: `file:///cache/photo-${index}.jpg`, mimeType: 'image/jpeg' }))
  };
}

class LocalPhotoDouble {
  exists = true;
  size = 64;
  async arrayBuffer() { return new ArrayBuffer(64); }
}

function reportsWithPhotos(client, File = LocalPhotoDouble) {
  return loader({ '@/lib/supabase': { supabase: client }, 'expo-file-system': { File } })('src/services/reports.ts');
}

test('creation uploads one to five JPEGs before a single atomic RPC without direct inserts or client identity fields', async () => {
  for (const count of [1, 5]) {
    const { client, calls } = creationClientDouble();
    const result = await reportsWithPhotos(client).createReport(reportInput(count));
    const uploads = calls.filter((call) => call.operation === 'upload');
    const rpcs = calls.filter((call) => call.operation === 'rpc');
    assert.equal(uploads.length, count);
    assert.equal(rpcs.length, 1);
    assert.equal(calls.at(-1), rpcs[0]);
    const { name, parameters } = rpcs[0];
    assert.equal(name, 'create_incident_with_evidence');
    assert.equal(result.id, parameters.p_incident_id);
    assert.equal(result.code, 'ZAC-2026-000003');
    assert.match(result.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.deepEqual(JSON.parse(JSON.stringify(parameters)), {
      p_incident_id: result.id, p_category_id: 1, p_description: 'Falla de prueba local', p_address_reference: 'Ubicación local',
      p_latitude: 14.97, p_longitude: -89.53, p_storage_paths: uploads.map((upload) => upload.storagePath), p_mime_type: 'image/jpeg',
      p_reporter_name: null, p_reporter_email: null
    });
    for (const [index, upload] of uploads.entries()) {
      assert.match(upload.storagePath, /^reportes\/AGUA\/categoria-1\/\d{4}\/\d{2}\//);
      const filename = index === 0 ? 'evidencia-inicial.jpg' : `evidencia-adicional-${String(index + 1).padStart(2, '0')}.jpg`;
      assert.ok(upload.storagePath.endsWith(`/${result.id}/ciudadano-owner/${filename}`));
      assert.equal(upload.bucket, 'incidente-evidencia');
      assert.equal(upload.size, 64);
      assert.equal(upload.config.contentType, 'image/jpeg');
      assert.equal(upload.config.upsert, false);
    }
    const category = calls.find((call) => call.table === 'categories');
    assert.ok(category.filters.some(([key, value]) => key === 'id' && value === 1));
    assert.ok(category.filters.some(([key, value]) => key === 'active' && value === true));
    assert.ok(!calls.some((call) => ['insert', 'update', 'remove', 'sign'].includes(call.operation)));
  }
});

test('guest creation accepts one to three JPEGs, identifies the reporter and uses an isolated storage path', async () => {
  const { client, calls } = creationClientDouble({
    auth: { getUser: async () => ({ data: { user: { id: 'guest-id', is_anonymous: true } }, error: null }) }
  });
  const input = { ...reportInput(3), reporterName: '  Ana Invitada  ', reporterEmail: '  ANA@EXAMPLE.COM  ' };
  const result = await reportsWithPhotos(client).createReport(input);
  const uploads = calls.filter((call) => call.operation === 'upload');
  assert.equal(uploads.length, 3);
  assert.ok(uploads.every((upload) => upload.storagePath.includes(`/${result.id}/invitado-guest-id/`)));
  const rpc = calls.find((call) => call.operation === 'rpc');
  assert.equal(rpc.parameters.p_reporter_name, 'Ana Invitada');
  assert.equal(rpc.parameters.p_reporter_email, 'ana@example.com');
});

test('guest creation rejects a fourth photo before reading files, uploading or calling the RPC', async () => {
  const { client, calls } = creationClientDouble({
    auth: { getUser: async () => ({ data: { user: { id: 'guest-id', is_anonymous: true } }, error: null }) }
  });
  await assert.rejects(
    reportsWithPhotos(client).createReport({ ...reportInput(4), reporterName: 'Ana Invitada', reporterEmail: 'ana@example.com' }),
    /una y tres fotografías JPEG/
  );
  assert.equal(calls.length, 0);
});

test('creation rejects unauthenticated users and invalid evidence before storage or RPC', async () => {
  for (const scenario of ['anonymous', 'auth-error', 'empty', 'too-many', 'non-jpeg']) {
    const { client, calls } = creationClientDouble({ auth: {
      getUser: async () => ({ data: { user: scenario === 'anonymous' ? null : { id: 'owner' } }, error: scenario === 'auth-error' ? { message: 'Expired session' } : null })
    } });
    const input = reportInput(scenario === 'empty' ? 0 : scenario === 'too-many' ? 6 : 1);
    if (scenario === 'non-jpeg') input.evidence[0].mimeType = 'image/png';
    await assert.rejects(reportsWithPhotos(client).createReport(input), /Inicia sesión|una y cinco fotografías JPEG/);
    assert.equal(calls.length, 0);
  }
});

test('partial creation failures remove only uploaded photos and never call the creation RPC', async () => {
  for (const failure of ['read', 'upload']) {
    let reads = 0;
    let uploads = 0;
    const { client, calls } = creationClientDouble({ upload: async () => ({ error: ++uploads === 2 && failure === 'upload' ? { message: 'Upload denied' } : null }) });
    const reports = reportsWithPhotos(client, class extends LocalPhotoDouble {
      async arrayBuffer() { if (++reads === 2 && failure === 'read') throw new Error('Photo unavailable'); return super.arrayBuffer(); }
    });
    await assert.rejects(reports.createReport(reportInput(3)), (error) => /leer la fotografía|Upload denied/.test(error.message));
    const uploaded = calls.filter((call) => call.operation === 'upload');
    const cleanup = calls.filter((call) => call.operation === 'remove');
    assert.equal(uploaded.length, failure === 'read' ? 1 : 2);
    assert.equal(cleanup.length, 1);
    assert.equal(cleanup[0].bucket, 'incidente-evidencia');
    assert.deepEqual(cleanup[0].paths, [uploaded[0].storagePath]);
    assert.ok(!calls.some((call) => ['rpc', 'insert', 'update'].includes(call.operation)));
  }
});

test('creation RPC errors or empty results clean every uploaded photo without falling back to inserts', async () => {
  for (const response of [{ data: null, error: { message: 'Creation denied' } }, { data: [], error: null }]) {
    const { client, calls } = creationClientDouble({ rpc: async () => response });
    await assert.rejects(reportsWithPhotos(client).createReport(reportInput(2)), /Creation denied|No fue posible registrar/);
    assert.equal(calls.filter((call) => call.operation === 'rpc').length, 1);
    const cleanup = calls.filter((call) => call.operation === 'remove');
    assert.equal(cleanup.length, 1);
    assert.deepEqual(cleanup[0].paths, calls.filter((call) => call.operation === 'upload').map((call) => call.storagePath));
    assert.equal(calls.at(-1), cleanup[0]);
    assert.ok(!calls.some((call) => call.operation === 'insert' || call.operation === 'update'));
  }
});

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

test('operator cannot read another assignee history or photos even in the same department', async () => {
  for (const userId of ['operator-a', 'operator-b']) {
    const { client, calls } = clientDouble((query) => {
      assert.equal(query.table, 'incidents');
      assert.ok(query.filters.some(([key, value]) => key === 'assigned_to' && value === userId));
      assert.ok(query.filters.some(([key, value]) => key === 'id' && value === 'other-task'));
      return { data: null, error: null };
    }, {
      profile: { role: 'operador', department_id: 7 },
      auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) }
    });
    const reports = reportsWithPhotos(client);
    await assert.rejects(reports.listReportHistory('other-task'), /no está disponible/);
    await assert.rejects(reports.listReportEvidence('other-task'), /no está disponible/);
    assert.ok(calls.filter((call) => call.table === 'profiles').every((call) => call.filters.some(([key, value]) => key === 'id' && value === userId)));
    assert.ok(!calls.some((call) => call.operation === 'sign' || call.table === 'incident_history' || call.table === 'incident_evidence'));
  }
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

test('assignment submits department, assignee, priority and note through one RPC without partial writes', async () => {
  const { client, calls } = clientDouble(undefined, { rpc: async () => ({ data: '2026-10-23T16:00:00Z', error: null }) });
  const reports = reportsWithPhotos(client);
  await reports.updateReportManagement({
    incidentId: 'new-report', previousStatus: 'VALIDADO', departmentId: 7,
    assignedToId: 'employee-7', priority: 'ALTA', note: '  Reparar luminaria  '
  });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{
    operation: 'rpc', name: 'assign_incident', parameters: {
      p_incident_id: 'new-report', p_previous_status: 'VALIDADO', p_department_id: 7,
      p_assigned_to: 'employee-7', p_priority: 'ALTA', p_note: 'Reparar luminaria'
    }
  }]);
  for (const status of ['REGISTRADO', 'EN_ATENCION', 'CERRADO']) {
    await assert.rejects(reports.updateReportManagement({ incidentId: 'old', previousStatus: status, departmentId: 7, assignedToId: 'employee-7', priority: 'ALTA', note: 'Intento' }), /valida/);
  }
  await assert.rejects(reports.updateReportStatus('new-report', 'VALIDADO', 'ASIGNADO', 'Intento'), /asignación operativa/);
  assert.equal(calls.length, 1);
});

test('assignment rejects a concurrent change without attempting a direct update', async () => {
  const { client, calls } = clientDouble(undefined, { rpc: async () => ({ data: null, error: { message: 'Incident status changed' } }) });
  await assert.rejects(reportsWithPhotos(client).updateReportManagement({
    incidentId: 'already-changed', previousStatus: 'VALIDADO', departmentId: 7,
    assignedToId: 'employee-7', priority: 'MEDIA', note: 'Asignar trabajo'
  }), /cambió desde otra sesión/);
  assert.ok(!calls.some((call) => ['update', 'insert'].includes(call.operation)));
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
    '@/components/OpenMapViewport': { OpenMapViewport: 'OpenMapViewport' },
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

test('administrator assignment form is available only for a validated unassigned report', () => {
  for (const [status, departmentId, assignedToId, visible] of [
    ['REGISTRADO', null, null, false],
    ['VALIDADO', null, null, true],
    ['VALIDADO', 7, 'existing-worker', false],
    ['EN_ATENCION', 7, 'existing-worker', false],
    ['CERRADO', 7, 'existing-worker', false]
  ]) {
    const harness = workflowScreenHarness('administrador', [{ ...reportsFixture('MEDIA'), status, departmentId, assignedToId }]);
    let tree = harness.render();
    nodes(tree).find((node) => node.type === 'IncidentCard').props.onPress();
    tree = harness.render();
    assert.equal(nodes(tree).some((node) => node.props?.label === 'Asignar reporte'), visible);
    const labels = nodes(tree).map((node) => node.props?.children).filter((value) => typeof value === 'string');
    assert.equal(labels.includes('Asignado'), false);
  }
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
    '@/services/reports': { listReports: async () => { reads++; return [{ id: identity.databaseRole === 'operador' ? 'personal-report' : 'administrative-report' }]; } }
  })('src/hooks/useReports.ts').useReports;
  const render = () => { index = 0; return hook(); };
  render(); const blur = focus(); await new Promise(setImmediate);
  assert.equal(render().incidents[0].id, 'administrative-report');
  identity = { userId: 'different-account', databaseRole: 'operador', departmentId: 7, isAuthenticated: true };
  assert.equal(render().incidents.length, 0);
  blur(); const nextBlur = focus(); await new Promise(setImmediate);
  assert.equal(render().incidents[0].id, 'personal-report');
  assert.equal(reads, 2);
  nextBlur();
});

test('Realtime reloads authorized report lists, scopes workers and removes old-session subscriptions', async () => {
  let identity = { userId: 'admin-a', databaseRole: 'administrador', departmentId: null, isAuthenticated: true };
  const slots = [];
  const channels = [];
  let index = 0;
  let focus;
  let reads = 0;
  let foreground;
  const removed = [];
  const client = {
    channel(name) {
      const channel = {
        name, bindings: [], on(type, config, listener) { this.bindings.push({ type, config, listener }); return this; },
        subscribe(listener) { this.status = listener; return this; }
      };
      channels.push(channel);
      return channel;
    },
    removeChannel: async (channel) => { removed.push(channel); }
  };
  const hook = loader({
    react: {
      useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], (value) => { slots[slot] = value; }]; },
      useRef(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = { current: initial }; return slots[slot]; },
      useCallback: (callback) => callback
    },
    'react-native': { AppState: { addEventListener: (_, listener) => { foreground = listener; return { remove() { foreground = null; } }; } } },
    'expo-router': { useFocusEffect: (callback) => { focus = callback; } },
    '@/lib/supabase': { isSupabaseConfigured: true, supabase: client },
    '@/context/SessionContext': { useSession: () => identity },
    '@/services/reports': { listReports: async () => { reads++; return [{ id: identity.userId }]; } }
  }, { setInterval: () => 1, clearInterval: () => {} })('src/hooks/useReports.ts').useReports;
  const render = () => { index = 0; return hook(); };
  render(); const blurAdmin = focus(); await new Promise(setImmediate);
  assert.equal(channels[0].bindings[0].config.filter, undefined);
  assert.deepEqual(channels[0].bindings.map((binding) => binding.config.event), ['INSERT', 'UPDATE']);
  channels[0].status('SUBSCRIBED'); await new Promise(setImmediate);
  channels[0].bindings[0].listener(); await new Promise(setImmediate);
  assert.equal(reads, 3);
  foreground('active'); await new Promise(setImmediate);
  assert.equal(reads, 4);
  blurAdmin();
  assert.deepEqual(removed, [channels[0]]);
  channels[0].status('SUBSCRIBED');
  channels[0].bindings[0].listener();
  await new Promise(setImmediate);
  assert.equal(reads, 4);

  identity = { userId: 'worker-b', databaseRole: 'operador', departmentId: 7, isAuthenticated: true };
  assert.equal(render().incidents.length, 0);
  const blurWorker = focus(); await new Promise(setImmediate);
  assert.equal(channels[1].bindings[0].config.filter, 'assigned_to=eq.worker-b');
  assert.ok(channels[1].bindings.every((binding) => binding.config.filter === 'assigned_to=eq.worker-b'));
  assert.equal(render().incidents[0].id, 'worker-b');
  blurWorker();
  assert.deepEqual(removed, channels);
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

test('a missing or unrelated profile never derives a visual administrator role from email', () => {
  const policy = loader()('src/services/sessionPolicy.ts');
  for (const role of [null, undefined, 'superadmin@example.invalid', 'admin', {}, 'INACTIVO']) assert.equal(policy.visualRoleFor(role), 'citizen');
  assert.equal(policy.visualRoleFor('mantenimiento'), 'maintenance');
  assert.equal(policy.visualRoleFor('administrador'), 'superadmin');
  assert.equal(policy.visualRoleFor('supervisor'), 'admin');
});

test('invisible staff incidents block evidence before local reads or uploads', async () => {
  const { client, calls } = clientDouble(() => ({ data: null, error: null }), { profile: { role: 'operador', department_id: 7 } });
  const reports = loader({
    '@/lib/supabase': { supabase: client },
    'expo-file-system': { File: class { constructor() { assert.fail('Invisible incidents must not read images'); } } }
  }, { fetch: () => { assert.fail('Invisible incidents must not fetch images'); } })('src/services/reports.ts');
  await assert.rejects(reports.uploadReportEvidence('another-users-task', { uri: 'local://image', mimeType: 'image/jpeg' }), /no está disponible/);
  assert.ok(!calls.some((call) => call.operation === 'upload' || call.operation === 'insert'));
});

test('citizen evidence uses existing columns and preserves the incident when linking fails', async () => {
  const { client, calls } = clientDouble((query) => query.operation === 'insert'
    ? { data: null, error: { message: 'Link denied' } }
    : { data: { id: 'incident', citizen_id: 'owner', category_id: 1, category: { department: { code: 'AGUA' } } }, error: null },
  { remove: async () => ({ error: null }) });
  const reports = loader({
    '@/lib/supabase': { supabase: client },
    'expo-file-system': { File: class { exists = true; size = 64; async arrayBuffer() { return new ArrayBuffer(64); } } }
  })('src/services/reports.ts');
  await assert.rejects(reports.uploadReportEvidence('incident', { uri: 'local://image', mimeType: 'image/jpeg' }), (error) => error instanceof reports.EvidenceLinkError);
  const insert = calls.find((call) => call.operation === 'insert');
  assert.equal(insert.table, 'incident_evidence');
  assert.deepEqual(Object.keys(insert.values).sort(), ['evidence_kind', 'file_type', 'file_url', 'incident_id', 'mime_type', 'storage_path', 'uploaded_by']);
  assert.match(insert.values.storage_path, /^reportes\/AGUA\/categoria-1\/\d{4}\/\d{2}\/incident\/ciudadano-owner\/evidencia-[^/]+\.jpg$/);
  assert.equal(insert.values.incident_id, 'incident');
  assert.equal(insert.values.uploaded_by, 'owner');
  assert.equal(insert.values.evidence_kind, 'OTRA');
  assert.equal(insert.values.file_url, insert.values.storage_path);
  assert.equal(insert.values.mime_type, 'image/jpeg');
  assert.equal(insert.values.file_type, 'image/jpeg');
  const cleanup = calls.find((call) => call.operation === 'remove');
  assert.equal(cleanup.bucket, 'incidente-evidencia');
  assert.deepEqual(cleanup.paths, [insert.values.storage_path]);
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

test('valid legacy evidence receives a private URL lasting fifteen minutes', async () => {
  const { client, calls } = clientDouble((query) => query.table === 'incidents'
    ? { data: { id: 'incident' }, error: null }
    : { data: [{ id: 'photo', storage_path: 'owner/incident/photo.jpg', uploaded_by: 'owner', mime_type: 'image/jpeg', created_at: '2026-10-15T12:00:00Z' }], error: null });
  const reports = loader({ '@/lib/supabase': { supabase: client } })('src/services/reports.ts');
  assert.equal((await reports.listReportEvidence('incident')).length, 1);
  assert.equal(calls.find((call) => call.operation === 'sign').ttl, 900);
});

const evidenceIncidentId = '11111111-1111-4111-8111-111111111111';
const evidenceUploaderId = '22222222-2222-4222-8222-222222222222';
const otherEvidenceId = '33333333-3333-4333-8333-333333333333';
const organizedEvidencePath = `reportes/AGUA/categoria-1/2026/10/${evidenceIncidentId}/ciudadano-${evidenceUploaderId}/evidencia-inicial.jpg`;

function evidenceReadDouble(rows, options = {}, incidentId = evidenceIncidentId) {
  const { client, calls } = clientDouble((query) => {
    if (query.table === 'incidents') return { data: { id: incidentId }, error: null };
    assert.equal(query.table, 'incident_evidence');
    return { data: rows, error: null };
  }, options);
  return { calls, reports: reportsWithPhotos(client) };
}

function evidenceRow(storagePath, uploadedBy = evidenceUploaderId) {
  return { id: 'photo', storage_path: storagePath, uploaded_by: uploadedBy, mime_type: 'image/jpeg', created_at: '2026-10-15T12:00:00Z' };
}

test('organized citizen and staff evidence retain exact uploader provenance and fifteen-minute private URLs', async () => {
  for (const actor of ['ciudadano', 'personal']) {
    for (const filename of ['evidencia-inicial.jpg', 'evidencia-adicional-02.jpg', `evidencia-1790000000000-${otherEvidenceId}.jpg`]) {
      const storagePath = `reportes/AGUA_POTABLE-2/categoria-123/2025/12/${evidenceIncidentId}/${actor}-${evidenceUploaderId}/${filename}`;
      // An administrator may view evidence uploaded by someone other than the current user.
      const { reports, calls } = evidenceReadDouble([evidenceRow(storagePath)], { profile: { role: 'administrador', department_id: null } });
      const result = await reports.listReportEvidence(evidenceIncidentId);
      assert.equal(result.length, 1);
      assert.equal(result[0].id, 'photo');
      assert.equal(result[0].url, 'https://example.invalid/signed-image');
      assert.equal(result[0].mimeType, 'image/jpeg');
      assert.deepEqual(calls.filter((call) => call.operation === 'sign'), [{ operation: 'sign', bucket: 'incidente-evidencia', storagePath, ttl: 900 }]);
      assert.ok(calls.find((call) => call.table === 'incident_evidence').filters.some(([key, value]) => key === 'incident_id' && value === evidenceIncidentId));
    }
  }
});

test('legacy and organized evidence can coexist on the same visible report', async () => {
  const paths = [
    `${evidenceUploaderId}/${evidenceIncidentId}/photo.jpg`,
    organizedEvidencePath,
    organizedEvidencePath.replace('ciudadano-', 'personal-')
  ];
  const { reports, calls } = evidenceReadDouble(paths.map((storagePath) => evidenceRow(storagePath)));
  assert.equal((await reports.listReportEvidence(evidenceIncidentId)).length, 3);
  const signed = calls.filter((call) => call.operation === 'sign');
  assert.deepEqual(signed.map((call) => call.storagePath), paths);
  assert.ok(signed.every((call) => call.ttl === 900 && call.bucket === 'incidente-evidencia'));
  assert.ok(calls.indexOf(calls.find((call) => call.table === 'incidents')) < calls.indexOf(calls.find((call) => call.table === 'incident_evidence')));
});

test('evidence validation rejects malformed, foreign and encoded paths before signing any URL', async () => {
  const legacy = `${evidenceUploaderId}/${evidenceIncidentId}/photo.jpg`;
  const invalidPaths = [
    undefined, null, 123, {}, '',
    `/${legacy}`, `${legacy}/`, `${legacy}/extra.jpg`,
    legacy.replace('/photo.jpg', '//photo.jpg'),
    legacy.replace(evidenceUploaderId, otherEvidenceId),
    legacy.replace(evidenceIncidentId, otherEvidenceId),
    legacy.replace('photo.jpg', '.'), legacy.replace('photo.jpg', '..'),
    legacy.replace('photo.jpg', '../photo.jpg'), legacy.replace('photo.jpg', './photo.jpg'),
    legacy.replace('photo.jpg', '%2e%2e'), legacy.replace('photo.jpg', '%252e%252e'),
    legacy.replace('photo.jpg', 'photo%2fother.jpg'), legacy.replace('photo.jpg', 'photo%5cother.jpg'),
    legacy.replace('photo.jpg', 'photo\\other.jpg'), legacy.replace('photo.jpg', 'photo.jpg?download=1'),
    legacy.replace('photo.jpg', 'photo.jpg#fragment'), legacy.replace('photo.jpg', 'photo\0.jpg'),
    legacy.replace('photo.jpg', 'photo.jpg\n'), legacy.replace('photo.jpg', 'https:photo.jpg'),
    `https://example.invalid/${legacy}`, ` ${legacy}`, `${legacy} `,
    organizedEvidencePath.replace('reportes/', 'reports/'),
    organizedEvidencePath.replace('/AGUA/', '//'), organizedEvidencePath.replace('/AGUA/', '/agua/'),
    organizedEvidencePath.replace('/AGUA/', '/../'), organizedEvidencePath.replace('/AGUA/', '/./'),
    organizedEvidencePath.replace('categoria-1', 'categoria-0'), organizedEvidencePath.replace('categoria-1', 'categoria--1'),
    organizedEvidencePath.replace('categoria-1', 'categoria-01'), organizedEvidencePath.replace('categoria-1', 'categoria-x'),
    organizedEvidencePath.replace('/2026/', '/26/'), organizedEvidencePath.replace('/2026/', '/0000/'),
    organizedEvidencePath.replace('/10/', '/00/'), organizedEvidencePath.replace('/10/', '/13/'),
    organizedEvidencePath.replace('/10/', '/1/'), organizedEvidencePath.replace('/10/', '//'),
    organizedEvidencePath.replace(evidenceIncidentId, otherEvidenceId),
    organizedEvidencePath.replace(evidenceUploaderId, otherEvidenceId),
    organizedEvidencePath.replace('ciudadano-', 'personal-').replace(evidenceUploaderId, otherEvidenceId),
    organizedEvidencePath.replace('ciudadano-', 'administrador-'),
    organizedEvidencePath.replace('ciudadano-', ''),
    organizedEvidencePath.replace(evidenceUploaderId, `${evidenceUploaderId}-extra`),
    organizedEvidencePath.replace('/evidencia-inicial.jpg', '//evidencia-inicial.jpg'),
    organizedEvidencePath.replace('/evidencia-inicial.jpg', '/..'),
    organizedEvidencePath.replace('/evidencia-inicial.jpg', '/%2E%2E'),
    organizedEvidencePath.replace('/evidencia-inicial.jpg', '/photo%252fother.jpg'),
    organizedEvidencePath.replace('/evidencia-inicial.jpg', '/photo\\other.jpg'),
    organizedEvidencePath.replace('/evidencia-inicial.jpg', '/photo.jpg\r\n'),
    organizedEvidencePath.replace('.jpg', '.png'), organizedEvidencePath.replace('.jpg', '.jpg/extra'),
    organizedEvidencePath.replace('evidencia-inicial.jpg', '')
  ];
  const scenarios = invalidPaths.map((storagePath) => ({ storagePath }));
  for (const uploadedBy of [undefined, null, '', 123, otherEvidenceId, `ciudadano-${evidenceUploaderId}`, `${evidenceUploaderId}/extra`]) {
    scenarios.push({ storagePath: legacy, uploadedBy }, { storagePath: organizedEvidencePath, uploadedBy });
  }
  scenarios.push(
    { storagePath: organizedEvidencePath.replace(evidenceIncidentId, 'not-a-uuid'), incidentId: 'not-a-uuid' },
    { storagePath: organizedEvidencePath.replace(evidenceUploaderId, 'not-a-uuid'), uploadedBy: 'not-a-uuid' }
  );
  for (const scenario of scenarios) {
    const uploadedBy = Object.hasOwn(scenario, 'uploadedBy') ? scenario.uploadedBy : evidenceUploaderId;
    const incidentId = scenario.incidentId ?? evidenceIncidentId;
    const invalidRow = { ...evidenceRow(scenario.storagePath), uploaded_by: uploadedBy };
    // A valid preceding row must not cause partial signing of a rejected response.
    const validLegacyPath = `${evidenceUploaderId}/${incidentId}/photo.jpg`;
    const { reports, calls } = evidenceReadDouble([evidenceRow(validLegacyPath), invalidRow], {}, incidentId);
    await assert.rejects(reports.listReportEvidence(incidentId), /ruta de evidencia/, JSON.stringify(scenario));
    assert.ok(!calls.some((call) => call.operation === 'sign'), JSON.stringify(scenario));
  }
});

test('incident visibility restrictions finish before reading evidence or signing either path format', async () => {
  for (const role of ['ciudadano', 'mantenimiento', 'administrador']) {
    const visibility = deferred();
    const { client, calls } = clientDouble((query) => {
      if (query.table === 'incidents') return visibility.promise;
      assert.fail('Evidence cannot be read before incident visibility is verified');
    }, { profile: { role, department_id: 7 } });
    const reports = reportsWithPhotos(client);
    const pending = reports.listReportEvidence(evidenceIncidentId);
    const rejected = assert.rejects(pending, /no está disponible/);
    await new Promise(setImmediate);
    const query = calls.find((call) => call.table === 'incidents');
    assert.ok(query.filters.some(([key, value]) => key === 'id' && value === evidenceIncidentId));
    if (role === 'ciudadano') assert.ok(query.filters.some(([key, value]) => key === 'citizen_id' && value === 'owner'));
    if (role === 'mantenimiento') assert.ok(query.filters.some(([key, value]) => key === 'assigned_department_id' && value === 7));
    assert.ok(!calls.some((call) => call.table === 'incident_evidence' || call.operation === 'sign'));
    visibility.resolve({ data: null, error: null });
    await rejected;
    assert.ok(!calls.some((call) => call.table === 'incident_evidence' || call.operation === 'sign'));
  }
});

test('paths generated during multi-photo creation can be read without rewriting the stored keys', async () => {
  const { client, calls } = creationClientDouble({ auth: {
    getUser: async () => ({ data: { user: { id: evidenceUploaderId } }, error: null })
  } });
  const incident = await reportsWithPhotos(client).createReport(reportInput(5));
  const storagePaths = calls.find((call) => call.operation === 'rpc').parameters.p_storage_paths;
  const reading = evidenceReadDouble(Array.from(storagePaths, (storagePath) => evidenceRow(storagePath)), {}, incident.id);
  assert.equal((await reading.reports.listReportEvidence(incident.id)).length, 5);
  const signed = reading.calls.filter((call) => call.operation === 'sign');
  assert.deepEqual(signed.map((call) => call.storagePath), Array.from(storagePaths));
  assert.ok(signed.every((call) => call.ttl === 900 && call.bucket === 'incidente-evidencia'));
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
  for (const [width, height] of [[800, 600], [600, 800], [1600, 1200], [1200, 1600], [2400, 1800], [1800, 2400], [2400, 2400]]) {
    const resized = [];
    const saved = [];
    const image = { width, height, saveAsync: async (options) => { saved.push(options); return { uri: 'local://optimized' }; } };
    const module = loader({
      'expo-image-picker': {},
      'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: () => ({ renderAsync: async () => image, resize: (size) => resized.push(size) }) } }
    })('src/services/evidenceImages.ts');
    const result = await module.optimizeEvidence('local://source');
    assert.equal(result.mimeType, 'image/jpeg');
    assert.equal(result.uri, 'local://optimized');
    assert.equal(resized.length, Math.max(width, height) > 1600 ? 1 : 0);
    if (resized.length) {
      assert.equal(resized[0].width, width >= height ? 1600 : null);
      assert.equal(resized[0].height, width >= height ? null : 1600);
    }
    assert.equal(saved.length, 1);
    assert.equal(saved[0].compress, 0.72);
    assert.equal(saved[0].format, 'jpeg');
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

function reportScreenHarness(client, File, options = {}) {
  const slots = [];
  const effects = [];
  const alerts = [];
  const locationCalls = [];
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
    'react-native': { ...native, Platform: { OS: 'android' }, Alert: { alert: (...args) => alerts.push(args) }, StyleSheet: { create: (value) => value } },
    'expo-file-system': { File },
    'expo-router': { Redirect: 'Redirect', router: {} },
    'expo-camera': { CameraView: 'CameraView', useCameraPermissions: () => [{ granted: true }, async () => ({ granted: true })] },
    'expo-location': {
      Accuracy: { High: 'high' },
      requestForegroundPermissionsAsync: async () => { locationCalls.push('permission'); return { granted: options.locationGranted ?? true }; },
      getCurrentPositionAsync: async (config) => {
        locationCalls.push(config);
        if (options.locationError) throw new Error('GPS unavailable');
        return { coords: { latitude: 14.97, longitude: -89.53, accuracy: 12 } };
      }
    },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@/components/AppButton': { AppButton: 'AppButton' },
    '@/components/DataState': { ErrorState: 'ErrorState', LoadingState: 'LoadingState' },
    '@/lib/supabase': { supabase: client, isSupabaseConfigured: true },
    '@/context/SessionContext': { useSession: () => ({ role: 'citizen', fullName: 'Ciudadano local', email: 'citizen@example.invalid', isAuthenticated: true, isLoading: false, isPasswordRecovery: false, ...options.session }) },
    'expo-image-picker': { launchImageLibraryAsync: options.pickImages ?? (async () => ({ canceled: false, assets: [{ uri: 'file:///cache/source.jpg' }] })) },
    'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: () => ({ renderAsync: async () => ({ width: 800, height: 600, saveAsync: async () => ({ uri: 'file:///cache/photo.jpg' }) }) }) } }
  });
  const screen = load('app/report/new.tsx').default;
  return { alerts, locationCalls, render() { index = 0; return screen(); }, mount() { return effects.splice(0).map((effect) => effect()); } };
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}

function pressLocation(tree) {
  return nodes(tree).find((node) => node.type === 'Pressable' && nodes(node).some((child) => child.props?.children === 'Obtener ubicación GPS')).props.onPress();
}

async function fillReportForm(harness) {
  harness.render(); harness.mount(); await new Promise(setImmediate);
  const tree = harness.render();
  const inputs = nodes(tree).filter((node) => node.type === 'TextInput');
  inputs[0].props.onChangeText('Falla de prueba local');
  inputs[1].props.onChangeText('Ubicación local');
  return harness.render();
}

test('the screen requires GPS and a photo, and denied or failed location never creates a report', async () => {
  for (const scenario of ['missing-gps', 'denied', 'unavailable', 'missing-photo']) {
    const { client, calls } = creationClientDouble();
    const harness = reportScreenHarness(client, LocalPhotoDouble, { locationGranted: scenario !== 'denied', locationError: scenario === 'unavailable' });
    let tree = await fillReportForm(harness);
    if (scenario !== 'missing-gps') await pressLocation(tree);
    tree = harness.render();
    const button = nodes(tree).find((node) => node.props?.label === 'Enviar reporte');
    assert.equal(button.props.disabled, true);
    await button.props.onPress(); // Validate the guard even for an already queued callback.
    const titles = harness.alerts.map(([title]) => title);
    assert.equal(titles.at(-1), scenario === 'missing-photo' ? 'Fotografía requerida' : 'GPS requerido');
    if (scenario === 'denied') {
      assert.ok(titles.includes('Permiso requerido'));
      assert.deepEqual(harness.locationCalls, ['permission']);
    } else if (scenario === 'unavailable') {
      assert.ok(titles.includes('No fue posible obtener la ubicación'));
    }
    if (scenario === 'missing-photo' || scenario === 'unavailable') {
      assert.equal(harness.locationCalls[0], 'permission');
      assert.equal(harness.locationCalls[1].accuracy, 'high');
    }
    assert.ok(!calls.some((call) => ['upload', 'rpc', 'insert', 'update'].includes(call.operation)));
  }
});

test('the gallery honors the remaining five-photo limit and the screen sends all selected evidence together', async () => {
  const { client, calls } = creationClientDouble();
  const selections = [];
  const harness = reportScreenHarness(client, LocalPhotoDouble, {
    pickImages: async (config) => {
      selections.push(config);
      return { canceled: false, assets: Array.from({ length: selections.length === 1 ? 2 : 5 }, (_, index) => ({ uri: `file:///cache/source-${index}.jpg` })) };
    }
  });
  let tree = await fillReportForm(harness);
  await pressLocation(tree);
  for (let selection = 0; selection < 2; selection++) {
    tree = harness.render();
    await nodes(tree).find((node) => node.type === 'Pressable' && nodes(node).some((child) => child.props?.children === 'Elegir de galería')).props.onPress();
  }
  assert.deepEqual(selections.map((config) => config.selectionLimit), [5, 3]);
  assert.ok(selections.every((config) => config.allowsMultipleSelection && !config.allowsEditing));
  tree = harness.render();
  assert.equal(nodes(tree).filter((node) => node.props?.accessibilityLabel?.startsWith('Quitar fotografía')).length, 5);
  assert.ok(!nodes(tree).some((node) => node.props?.children === 'Elegir de galería'));
  const button = nodes(tree).find((node) => node.props?.label === 'Enviar reporte');
  assert.equal(button.props.disabled, false);
  await button.props.onPress();
  assert.equal(calls.filter((call) => call.operation === 'upload').length, 5);
  const rpcs = calls.filter((call) => call.operation === 'rpc');
  assert.equal(rpcs.length, 1);
  assert.equal(rpcs[0].parameters.p_storage_paths.length, 5);
  assert.deepEqual(harness.alerts, []);
});

test('the guest report screen requests contact data and limits evidence selection to three photos', async () => {
  const { client, calls } = creationClientDouble({
    auth: { getUser: async () => ({ data: { user: { id: 'guest-id', is_anonymous: true } }, error: null }) }
  });
  const selections = [];
  const harness = reportScreenHarness(client, LocalPhotoDouble, {
    session: { isGuest: true, fullName: 'Ciudadano invitado', email: '' },
    pickImages: async (config) => {
      selections.push(config);
      return { canceled: false, assets: Array.from({ length: 3 }, (_, index) => ({ uri: `file:///cache/guest-${index}.jpg` })) };
    }
  });
  harness.render(); harness.mount(); await new Promise(setImmediate);
  let tree = harness.render();
  const inputs = nodes(tree).filter((node) => node.type === 'TextInput');
  inputs[0].props.onChangeText('Ana Invitada');
  inputs[1].props.onChangeText('ANA@EXAMPLE.COM');
  inputs[2].props.onChangeText('Falla de prueba invitada');
  inputs[3].props.onChangeText('Ubicación de prueba');
  await pressLocation(harness.render());
  tree = harness.render();
  await nodes(tree).find((node) => node.type === 'Pressable' && nodes(node).some((child) => child.props?.children === 'Elegir de galería')).props.onPress();
  assert.equal(selections[0].selectionLimit, 3);
  tree = harness.render();
  assert.equal(nodes(tree).filter((node) => node.props?.accessibilityLabel?.startsWith('Quitar fotografía')).length, 3);
  assert.ok(nodes(tree).some((node) => Array.isArray(node.props?.children) && node.props.children.join('') === '3/3'));
  const submit = nodes(tree).find((node) => node.props?.label === 'Enviar reporte');
  assert.equal(submit.props.disabled, false);
  await submit.props.onPress();
  const rpc = calls.find((call) => call.operation === 'rpc');
  assert.equal(rpc.parameters.p_reporter_name, 'Ana Invitada');
  assert.equal(rpc.parameters.p_reporter_email, 'ana@example.com');
  assert.ok(calls.filter((call) => call.operation === 'upload').every((call) => call.storagePath.includes('/invitado-guest-id/')));
});

test('the screen retries creation after a failed photo read and blocks overlapping or queued submits', async () => {
  const { client, calls } = creationClientDouble();
  let reads = 0;
  const pendingRead = deferred();
  const harness = reportScreenHarness(client, class {
    exists = true; size = 64;
    async arrayBuffer() { if (++reads === 1) throw new Error('Local read failed'); return pendingRead.promise; }
  });
  harness.render(); harness.mount(); await new Promise(setImmediate);
  let tree = harness.render();
  const camera = nodes(tree).find((node) => node.type === 'CameraView');
  assert.equal(camera.props.children, undefined);
  const cameraContainer = nodes(tree).find((node) => Array.isArray(node.props?.children) && node.props.children.includes(camera));
  assert.equal(cameraContainer.props.children[1].props.style.position, 'absolute');
  const inputs = nodes(tree).filter((node) => node.type === 'TextInput');
  inputs[0].props.onChangeText('Falla de prueba local'); inputs[1].props.onChangeText('Ubicación local');
  const gallery = nodes(tree).find((node) => node.type === 'Pressable' && nodes(node).some((child) => child.props?.children === 'Elegir de galería'));
  await gallery.props.onPress();
  await pressLocation(tree);
  tree = harness.render();
  assert.equal(nodes(tree).find((node) => node.props?.label === 'Enviar reporte').props.disabled, false);
  const submit = nodes(tree).find((node) => node.props?.label === 'Enviar reporte').props.onPress;
  const firstSubmission = submit(); await submit(); await firstSubmission;
  assert.equal(harness.alerts.length, 1);
  assert.equal(harness.alerts[0][0], 'No fue posible registrar el reporte');
  assert.ok(!calls.some((call) => call.operation === 'rpc' || call.operation === 'upload'));
  tree = harness.render();
  assert.ok(!nodes(tree).some((node) => node.props?.children === 'REPORTE REGISTRADO'));
  const retry = nodes(tree).find((node) => node.props?.label === 'Enviar reporte').props.onPress;
  const retrying = retry(); await retry(); await new Promise(setImmediate);
  assert.equal(reads, 2);
  assert.ok(nodes(harness.render()).some((node) => node.props?.label === 'Subiendo 1 fotografía...' && node.props.disabled));
  pendingRead.resolve(new ArrayBuffer(64)); await retrying;
  await submit(); await retry(); // Queued callbacks must not create another report after success.
  tree = harness.render();
  assert.ok(nodes(tree).some((node) => node.props?.children === 'ZAC-2026-000003'));
  assert.ok(!nodes(tree).some((node) => node.props?.label === 'Enviar reporte'));
  assert.equal(reads, 2);
  assert.ok(!calls.some((call) => call.operation === 'insert' || call.operation === 'update'));
  const rpcs = calls.filter((call) => call.operation === 'rpc');
  assert.equal(rpcs.length, 1);
  assert.equal(rpcs[0].name, 'create_incident_with_evidence');
  assert.equal(rpcs[0].parameters.p_latitude, 14.97);
  assert.equal(rpcs[0].parameters.p_longitude, -89.53);
  assert.equal(rpcs[0].parameters.p_category_id, 1);
  assert.equal(rpcs[0].parameters.p_description, 'Falla de prueba local');
  assert.equal(rpcs[0].parameters.p_address_reference, 'Ubicación local');
  assert.equal(calls.filter((call) => call.operation === 'upload').length, 1);
  const upload = calls.find((call) => call.operation === 'upload');
  assert.equal(upload.bucket, 'incidente-evidencia');
  assert.ok(upload.storagePath.endsWith(`/${rpcs[0].parameters.p_incident_id}/ciudadano-owner/evidencia-inicial.jpg`));
  assert.deepEqual(Array.from(rpcs[0].parameters.p_storage_paths), [upload.storagePath]);
  assert.equal(upload.config.contentType, 'image/jpeg');
  assert.equal(upload.config.upsert, false);
  assert.equal(harness.alerts.length, 1);
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

test('mobile session protection returns to profile, confirms sign out and expires after ten background minutes', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'src/components/SessionSecurityController.tsx'), 'utf8');
  assert.match(source, /10 \* 60 \* 1000/);
  assert.match(source, /nextState === 'background'/);
  assert.match(source, /nextState === 'active'/);
  assert.match(source, /isAuthenticated \|\| isGuest/);
  assert.match(source, /const guestExitPath = '\/report\/new'/);
  assert.match(source, /const accountExitPath = '\/profile'/);
  assert.match(source, /isGuest \? 'Salir del modo invitado' : 'Cerrar sesión'/);
  assert.match(source, /perderás el acceso a los reportes vinculados/i);
  assert.match(source, /text: 'No'/);
  assert.match(source, /text: 'Sí'/);
});

test('the session provider exposes an anonymous identity as an authenticated citizen guest', async () => {
  const { client } = clientDouble(() => ({ data: { full_name: 'Ciudadano invitado', role: 'ciudadano', department_id: null, department: null }, error: null }));
  client.auth.getSession = async () => ({ data: { session: { user: { id: 'guest-id', email: null, is_anonymous: true, user_metadata: {} } } }, error: null });
  client.auth.onAuthStateChange = () => ({ data: { subscription: { unsubscribe() {} } } });
  const harness = sessionHarness(client);
  harness.render();
  const cleanups = harness.mount();
  await new Promise(setImmediate);
  const session = harness.render();
  assert.equal(session.isAuthenticated, true);
  assert.equal(session.isGuest, true);
  assert.equal(session.role, 'citizen');
  assert.equal(session.userId, 'guest-id');
  assert.equal(session.email, '');
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

test('two operators in the same department receive only their assigned incidents and private evidence', async () => {
  const incidents = [
    { ...reportsFixture('MEDIA'), id: 'task-a', assigned_to: 'operator-a', assigned_department_id: 7 },
    { ...reportsFixture('ALTA'), id: 'task-b', assigned_to: 'operator-b', assigned_department_id: 7 },
    { ...reportsFixture('BAJA'), id: 'unassigned', assigned_to: null, assigned_department_id: 7 }
  ];
  for (const [userId, taskId] of [['operator-a', 'task-a'], ['operator-b', 'task-b']]) {
    const { client, calls } = clientDouble((query) => {
      if (query.table === 'incidents') {
        const visible = incidents.filter((row) => query.filters.every(([key, value]) => row[key] === value));
        return { data: query.single ? visible[0] ?? null : visible, error: null };
      }
      if (query.table === 'incident_history') return { data: [], error: null };
      assert.equal(query.table, 'incident_evidence');
      return { data: [evidenceRow(`citizen/${taskId}/photo.jpg`, 'citizen')], error: null };
    }, {
      profile: { role: 'operador', department_id: 7 },
      auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) }
    });
    const reports = reportsWithPhotos(client);
    assert.deepEqual(Array.from(await reports.listReports(), (row) => row.id), [taskId]);
    for (const denied of incidents.filter((row) => row.id !== taskId)) {
      await assert.rejects(reports.listReportHistory(denied.id), /no está disponible/);
      await assert.rejects(reports.listReportEvidence(denied.id), /no está disponible/);
    }
    assert.ok(!calls.some((call) => call.operation === 'sign' || call.table === 'incident_evidence' || call.table === 'incident_history'));
    await reports.listReportHistory(taskId);
    assert.equal((await reports.listReportEvidence(taskId)).length, 1);
    assert.deepEqual(calls.filter((call) => call.operation === 'sign'), [{
      operation: 'sign', bucket: 'incidente-evidencia', storagePath: `citizen/${taskId}/photo.jpg`, ttl: 900
    }]);
  }
});

test('operator screens offer only attention and verification transitions without assignment or closure controls', () => {
  for (const [status, expected] of [['ASIGNADO', 'En atención'], ['EN_ATENCION', 'Por verificar'], ['POR_VERIFICAR', null]]) {
    const harness = workflowScreenHarness('operador', [{ ...reportsFixture('MEDIA'), status, assignedToId: 'owner' }], 'superadmin');
    let tree = harness.render();
    nodes(tree).find((node) => node.type === 'IncidentCard').props.onPress();
    tree = harness.render();
    const labels = nodes(tree).map((node) => node.props?.children).filter((value) => typeof value === 'string');
    for (const transition of ['En atención', 'Por verificar', 'En revisión', 'Validado', 'Rechazado', 'Resuelto']) {
      assert.equal(labels.includes(transition), transition === expected);
    }
    assert.ok(!nodes(tree).some((node) => node.props?.label === 'Guardar asignación'));
    assert.equal(nodes(tree).some((node) => node.props?.label === 'Confirmar cambio'), Boolean(expected));
  }
});

test('operator state changes use the server RPC and propagate access and transition denials without direct writes', async () => {
  for (const [previous, next] of [['ASIGNADO', 'EN_ATENCION'], ['EN_ATENCION', 'POR_VERIFICAR']]) {
    const { client, calls } = clientDouble(undefined, { rpc: async () => ({ data: '2026-10-15T12:00:00Z', error: null }) });
    const result = await reportsWithPhotos(client).updateReportStatus('personal-task', previous, next, '  Avance verificado  ');
    assert.equal(result.historyRecorded, true);
    const rpc = calls.find((call) => call.operation === 'rpc');
    assert.equal(rpc.name, 'transition_incident');
    assert.equal(rpc.parameters.p_incident_id, 'personal-task');
    assert.equal(rpc.parameters.p_previous_status, previous);
    assert.equal(rpc.parameters.p_new_status, next);
    assert.equal(rpc.parameters.p_note, 'Avance verificado');
    assert.ok(!calls.some((call) => call.operation === 'insert' || call.operation === 'update'));
  }
  for (const message of ['Incident access denied', 'Transition not allowed', 'Incident status changed']) {
    const { client, calls } = clientDouble(undefined, { rpc: async () => ({ data: null, error: { message } }) });
    await assert.rejects(reportsWithPhotos(client).updateReportStatus('other-task', 'POR_VERIFICAR', 'CERRADO', 'Intento no permitido'));
    assert.equal(calls.filter((call) => call.operation === 'rpc').length, 1);
    assert.ok(!calls.some((call) => call.operation === 'insert' || call.operation === 'update'));
  }
});

test('operator dashboard presents the enabled personal workflow without pending messages', () => {
  const incident = { ...reportsFixture(2), assignedToId: 'owner', status: 'ASIGNADO' };
  const tree = workflowScreenHarness('operador', [incident]).render('app/(tabs)/index.tsx');
  const labels = nodes(tree).flatMap((node) => [node.props?.label, node.props?.title, typeof node.props?.children === 'string' ? node.props.children : '']).join(' ');
  assert.match(labels, /Trabajo asignado a tu cuenta/);
  assert.match(labels, /Actividad de mis tareas/);
  assert.doesNotMatch(labels, /pendiente de habilitación|Consulta personal pendiente/);
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

// Source-level audit of ordered repository migrations, not a live PostgreSQL test.
function effectiveIncidentPolicies() {
  const directory = path.resolve(__dirname, '..', 'supabase/migrations');
  const policies = new Map();
  for (const file of fs.readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(directory, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
    assert.doesNotMatch(sql, /\balter\s+policy\b/i, 'Extend the source audit before using ALTER POLICY');
    const statements = /\b(create\s+policy|drop\s+policy(?:\s+if\s+exists)?)\s+(?:"([^"]+)"|([a-z_][a-z0-9_]*))\s+on\s+((?:public|storage)\.[a-z_][a-z0-9_]*)([^;]*);/gi;
    for (const match of sql.matchAll(statements)) {
      const name = match[2] ?? match[3];
      const table = match[4].toLowerCase();
      const key = `${table}:${name}`;
      if (/^drop/i.test(match[1])) policies.delete(key);
      else policies.set(key, {
        name, table, file, sql: match[0].replace(/\s+/g, ' ').trim(),
        command: match[5].match(/\bfor\s+(all|select|insert|update|delete)\b/i)?.[1].toLowerCase() ?? 'all'
      });
    }
  }
  return policies;
}

test('effective citizen SELECT and INSERT policies require current citizen role, active account and exact ownership', () => {
  const policies = effectiveIncidentPolicies();
  const requirements = [
    "(select private.current_user_role()) = 'ciudadano'",
    '(select private.current_user_is_active())',
    'citizen_id = (select auth.uid())'
  ];
  for (const [name, command] of [['citizens read own incidents', 'select'], ['citizens create own incidents', 'insert']]) {
    const policy = policies.get(`public.incidents:${name}`);
    assert.ok(policy);
    assert.equal(policy.file, '202610170003_restrict_citizen_incident_policies.sql');
    assert.equal(policy.command, command);
    assert.match(policy.sql, /to authenticated/);
    const expression = policy.sql.match(/(?:using|with check) \( (.*) \);$/)?.[1];
    const expected = command === 'select' ? requirements : [
      ...requirements, "status = 'REGISTRADO'", 'assigned_department_id is null', 'assigned_to is null'
    ];
    // Exact AND conditions also reject an ownership-only OR branch or a role bypass.
    assert.equal(expression, expected.join(' and '));
  }
});

test('effective read policies have no surviving departmental or storage-owner bypass for operators', () => {
  const policies = effectiveIncidentPolicies();
  const tables = ['public.incidents', 'public.incident_history', 'public.incident_evidence', 'storage.objects'];
  const readers = [...policies.entries()].filter(([, policy]) => tables.includes(policy.table) && ['all', 'select'].includes(policy.command));
  assert.deepEqual(readers.map(([key]) => key).sort(), [
    'public.incidents:citizens read own incidents', 'public.incidents:staff read permitted incidents',
    'public.incident_history:incident history follows incident visibility',
    'public.incident_evidence:evidence follows incident visibility',
    'storage.objects:users read permitted incident evidence'
  ].sort());
  const creators = [...policies.values()].filter((policy) => policy.table === 'public.incidents' && ['all', 'insert'].includes(policy.command));
  assert.deepEqual(creators.map((policy) => policy.name).sort(), [
    'citizens create own incidents', 'guests use controlled incident creation'
  ]);
  const guestInsertGuard = policies.get('public.incidents:guests use controlled incident creation');
  assert.equal(guestInsertGuard.file, '20261024020928_guest_incident_submission_limits.sql');
  assert.match(guestInsertGuard.sql, /as restrictive for insert to authenticated/);
  assert.match(guestInsertGuard.sql, /is_anonymous.*false/);
  const staff = policies.get('public.incidents:staff read permitted incidents').sql;
  assert.match(staff, /current_user_is_active\(\)/);
  assert.ok(staff.includes("(select private.current_user_role()) = 'operador' and assigned_to = (select auth.uid())"));
  assert.deepEqual([...staff.matchAll(/current_user_role\(\)\) in \(([^)]+)\)/g)].map((match) => match[1]), [
    "'administrador', 'supervisor'", "'coordinador', 'comunicacion', 'mantenimiento'"
  ]);
  assert.match(staff, /coalesce\( assigned_department_id, .*current_department_id\(\)/);
  for (const [key, policy] of readers) {
    assert.match(policy.sql, /to authenticated/);
    assert.doesNotMatch(policy.sql, /current_user_role\(\)\) <> 'ciudadano'/);
    if (key.startsWith('public.incident_history:') || key.startsWith('public.incident_evidence:')) {
      assert.match(policy.sql, /current_user_is_active\(\)/);
      assert.match(policy.sql, /current_user_can_read_incident\(incident_id\)/);
    }
  }
  const storage = policies.get('storage.objects:users read permitted incident evidence').sql;
  assert.match(storage, /bucket_id = 'incidente-evidencia'/);
  assert.match(storage, /e\.storage_path = name and \(select private\.current_user_can_read_incident\(e\.incident_id\)\)/);
  assert.doesNotMatch(storage, /storage\.foldername|owner_id/);
});

test('guest migration enforces server-side identity, cooldown, daily quota and private evidence ownership', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '..', 'supabase/migrations/20261024020928_guest_incident_submission_limits.sql'), 'utf8');
  assert.match(sql, /auth\.jwt\(\) ->> 'is_anonymous'/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /interval '15 minutes'/);
  assert.match(sql, /interval '24 hours'/);
  assert.match(sql, /\) >= 5 then raise exception 'Guest daily report limit reached'/);
  assert.match(sql, /if evidence_count > 3 then raise exception 'Guest evidence limit exceeded'/);
  assert.match(sql, /p\.status = 'ACTIVO' and p\.role = 'ciudadano'/);
  assert.match(sql, /o\.owner_id = current_user_id::text/);
  assert.match(sql, /then 'invitado-' \|\| \(select auth\.uid\(\)\)::text/);
  assert.match(sql, /revoke all on function public\.create_incident_with_evidence[\s\S]*from public, anon/);
  assert.match(sql, /grant execute on function public\.create_incident_with_evidence[\s\S]*to authenticated/);
});

test('registered clients retain the previous atomic creation RPC while the guest-aware signature is deployed', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '..', 'supabase/migrations/20261024164105_restore_registered_report_rpc_compatibility.sql'), 'utf8');
  assert.match(sql, /create or replace function public\.create_incident_with_evidence\([\s\S]*p_mime_type text\s*\)/);
  assert.match(sql, /p_storage_paths, p_mime_type, null, null/);
  assert.match(sql, /revoke all on function public\.create_incident_with_evidence[\s\S]*from public, anon/);
  assert.match(sql, /grant execute on function public\.create_incident_with_evidence[\s\S]*to authenticated/);
});

test('a former citizen loses access to old self-reported incidents after becoming an operator unless assigned', async () => {
  const profile = { role: 'ciudadano', department_id: 7 };
  const incidents = [
    { ...reportsFixture('MEDIA'), id: 'old-unassigned', citizen_id: 'owner', assigned_to: null, assigned_department_id: 7 },
    { ...reportsFixture('MEDIA'), id: 'old-assigned-to-colleague', citizen_id: 'owner', assigned_to: 'colleague', assigned_department_id: 7 },
    { ...reportsFixture('MEDIA'), id: 'current-personal-task', citizen_id: 'another-citizen', assigned_to: 'owner', assigned_department_id: 7 }
  ];
  const { client, calls } = clientDouble((query) => {
    if (query.table === 'incidents') {
      const rows = incidents.filter((row) => query.filters.every(([key, value]) => row[key] === value));
      return { data: query.single ? rows[0] ?? null : rows, error: null };
    }
    assert.equal(query.table, 'incident_history');
    return { data: [], error: null };
  }, { profile });
  const reports = reportsWithPhotos(client);
  assert.deepEqual(Array.from(await reports.listReports(), (row) => row.id), ['old-unassigned', 'old-assigned-to-colleague']);
  profile.role = 'operador';
  assert.deepEqual(Array.from(await reports.listReports(), (row) => row.id), ['current-personal-task']);
  calls.length = 0;
  for (const incidentId of ['old-unassigned', 'old-assigned-to-colleague']) {
    await assert.rejects(reports.listReportHistory(incidentId), /no está disponible/);
    await assert.rejects(reports.listReportEvidence(incidentId), /no está disponible/);
  }
  assert.ok(!calls.some((call) => call.table === 'incident_history' || call.table === 'incident_evidence' || call.operation === 'sign'));
  assert.deepEqual(Array.from(await reports.listReportHistory('current-personal-task')), []);
});

test('optional final staff evidence is uploaded and linked only after the incident is visible', async () => {
  const { client, calls } = clientDouble((query) => query.operation === 'insert'
    ? { data: null, error: null }
    : { data: { id: 'incident', citizen_id: 'someone-else', category_id: 1, category: { department: { code: 'AGUA' } } }, error: null });
  const reports = loader({
    '@/lib/supabase': { supabase: client },
    'expo-file-system': { File: class { exists = true; size = 64; async arrayBuffer() { return new ArrayBuffer(64); } } }
  })('src/services/reports.ts');
  await reports.uploadReportEvidence('incident', { uri: 'local://image', mimeType: 'image/jpeg' }, 'FINAL');
  assert.equal(calls.filter((call) => call.operation === 'upload').length, 1);
  const insert = calls.find((call) => call.operation === 'insert');
  assert.equal(insert.table, 'incident_evidence');
  assert.equal(insert.values.uploaded_by, 'owner');
  assert.equal(insert.values.evidence_kind, 'FINAL');
  assert.match(insert.values.storage_path, /^reportes\/AGUA\/categoria-1\/\d{4}\/\d{2}\/incident\/personal-owner\//);
});

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

test('Turnstile protects every public authentication entry without exposing its secret', () => {
  const read = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  const session = read('src/context/SessionContext.tsx');
  const login = read('app/login.tsx');
  const register = read('app/register.tsx');
  const recovery = read('app/forgot-password.tsx');
  const webChallenge = read('src/components/TurnstileChallenge.web.tsx');
  const nativeChallenge = read('src/components/TurnstileChallenge.tsx');
  const publicEnvironment = read('.env.example');

  assert.match(session, /signInWithPassword[\s\S]*captchaToken/);
  assert.match(session, /signInAnonymously\(\{ options \}\)/);
  assert.match(session, /signUp\([\s\S]*captchaToken/);
  assert.match(session, /resetPasswordForEmail[\s\S]*captchaToken/);
  assert.match(login, /action="zacapp_login"/);
  assert.match(register, /action="zacapp_registro"/);
  assert.match(recovery, /action="zacapp_recuperacion"/);
  assert.match(webChallenge, /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/);
  assert.match(nativeChallenge, /ReactNativeWebView\.postMessage/);
  assert.match(publicEnvironment, /EXPO_PUBLIC_TURNSTILE_SITE_KEY=/);
  assert.doesNotMatch(publicEnvironment, /TURNSTILE_SECRET/i);
});
