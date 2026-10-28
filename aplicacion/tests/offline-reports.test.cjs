const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('offline queue keeps report identity, user ownership and persistent evidence', () => {
  const source = read('src/services/offlineReports.ts');
  assert.match(source, /userId: string/);
  assert.match(source, /Paths\.document/);
  assert.match(source, /incidentId: reportId/);
  assert.match(source, /source\.copy\(destination/);
});

test('offline sync waits for connectivity and deletes local evidence only after success', () => {
  const source = read('src/services/offlineReports.ts');
  assert.match(source, /NetInfo\.fetch\(\)/);
  assert.match(source, /await createReport\(report\.payload\);\s*deleteEvidence\(report\)/);
});

test('registered retry uses a deterministic incident id and safe storage overwrite', () => {
  const source = read('src/services/reports.ts');
  assert.match(source, /requestedIncidentId \?\? Crypto\.randomUUID\(\)/);
  assert.match(source, /\.eq\('id', incidentId\)\s*\.maybeSingle\(\)/);
  assert.match(source, /upsert: Boolean\(requestedIncidentId && resumeOffline && !isGuest\)/);
  assert.match(source, /requestedIncidentId && resumeOffline && !isGuest/);
});

test('anonymous report flow is not placed in the offline queue', () => {
  const source = read('app/report/new.tsx');
  assert.match(source, /if \(!isGuest && Platform\.OS !== 'web' && userId\)/);
  assert.doesNotMatch(source, /queueOfflineReport\([^)]*turnstileToken/);
});
