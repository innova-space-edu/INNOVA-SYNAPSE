import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const apiRoute = readFileSync(new URL('../src/app/api/projects/[id]/route.ts', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/components/dashboard.tsx', import.meta.url), 'utf8');
const storage = readFileSync(new URL('../src/lib/storage.ts', import.meta.url), 'utf8');

test('delete from recovery view is scoped to owner and legacy JSONB strings only', () => {
  assert.match(apiRoute, /legacyOnly/);
  assert.match(apiRoute, /jsonb_typeof\(document\) = 'string'/);
  assert.match(apiRoute, /owner_email=\$\{user\.email\}/);
  assert.match(apiRoute, /status:legacyOnly\?409:404/);
  assert.match(storage, /\?legacyOnly=1/);
});

test('recovery is explicit copy with new ID and the old source remains intact', () => {
  assert.match(dashboard, /const legacy = await loadLegacyProject\(item\.id\)/);
  assert.match(dashboard, /id: crypto\.randomUUID\(\)/);
  assert.match(dashboard, /await saveProject\(recovered\)/);
  assert.doesNotMatch(dashboard.slice(dashboard.indexOf('async function recoverLegacy'),dashboard.indexOf('async function downloadLegacy')), /deleteLegacyProject/);
});

test('delete requires typing the full ID; recovery view provides ZIP first', () => {
  assert.match(dashboard, /accepted !== item\.id/);
  assert.match(dashboard, /window\.prompt\(/);
  assert.match(dashboard, /exportProjectZip\(await loadLegacyProject\(item\.id\)\)/);
  assert.match(dashboard, /await deleteLegacyProject\(item\.id\)/);
});
