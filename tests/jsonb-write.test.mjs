import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const projectApi = readFileSync(new URL('../src/app/api/projects/[id]/route.ts', import.meta.url), 'utf8');
const snapshotsApi = readFileSync(new URL('../src/app/api/projects/[id]/snapshots/route.ts', import.meta.url), 'utf8');

test('project inserts store parsed object, not double-stringified JSONB', () => {
  assert.match(projectApi, /\$\{sql\.json\(parsed\)\}::jsonb/);
  assert.doesNotMatch(projectApi, /JSON\.stringify\(parsed\)/);
  assert.match(projectApi, /INSERT INTO synapse_projects/);
});

test('snapshot inserts store input object, not double-stringified JSONB', () => {
  assert.match(snapshotsApi, /\$\{sql\.json\(input\)\}::jsonb/);
  assert.doesNotMatch(snapshotsApi, /JSON\.stringify\(input\)/);
  assert.match(snapshotsApi, /INSERT INTO synapse_snapshots/);
});
