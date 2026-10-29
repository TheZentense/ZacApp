const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('VPS backup covers PostgreSQL and Storage and validates both archives', () => {
  const script = read('scripts/backup-vps.sh');
  assert.match(script, /pg_dump -U postgres -d postgres -Fc/);
  assert.match(script, /docker cp "\$storage_container:\/data\/\."/);
  assert.match(script, /pg_restore -f \/dev\/null/);
  assert.match(script, /tar -tzf/);
  assert.match(script, /sha256sum --check SHA256SUMS/);
  assert.match(script, /ZACAPP_BACKUP_RETENTION_DAYS:-7/);
  assert.match(script, /TZ=America\/Guatemala date \+%H/);
});

test('Windows backup pull validates remote names and checks every downloaded hash', () => {
  const script = read('scripts/pull-vps-backup.ps1');
  assert.match(script, /BatchMode=yes/);
  assert.match(script, /\^20\\d\{6\}T\\d\{6\}Z\$/);
  assert.match(script, /Get-FileHash -LiteralPath \$filePath -Algorithm SHA256/);
  assert.doesNotMatch(script, /Remove-Item/);
  assert.doesNotMatch(script, /password|private.?key/i);
});

test('security migration removes broad table grants and restores only the required API surface', () => {
  const sql = read('supabase/migrations/20261029011317_harden_public_table_grants.sql');
  const tables = ['assignments', 'categories', 'departments', 'incident_evidence', 'incident_history', 'incidents', 'profiles'];
  for (const table of tables) {
    assert.match(sql, new RegExp(`revoke all privileges on table public\\.${table} from anon, authenticated`, 'i'));
  }
  assert.doesNotMatch(sql, /grant\s+(delete|truncate)/i);
  assert.match(sql, /grant select \(id, name, active\) on table public\.categories to anon/i);
  assert.match(sql, /grant select, insert on table public\.incidents to authenticated/i);
  assert.match(sql, /grant select, insert on table public\.incident_evidence to authenticated/i);
  assert.match(sql, /revoke all on function private\.handle_new_user\(\) from public, anon, authenticated/i);
});
