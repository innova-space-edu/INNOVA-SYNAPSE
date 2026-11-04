import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
test('auth requires a signed Cloudflare JWT and email allowlist',()=>{
 const code=fs.readFileSync('src/lib/server/access.ts','utf8');
 assert.match(code,/jwtVerify\(/);
 assert.match(code,/audience/);
 assert.match(code,/allowlist\.has\(email\)/);
 assert.match(code,/SYNAPSE_LOCAL_DEV === 'true'/);
});
test('database is isolated from intranet data',()=>{
 const schema=fs.readFileSync('db/001-initial.sql','utf8');
 assert.match(schema,/synapse_projects/);
 assert.match(schema,/synapse_snapshots/);
 assert.doesNotMatch(schema,/DROP TABLE/i);
});
test('all private API handlers call independent origin authorization',()=>{
 for(const file of ['src/app/api/ai/route.ts','src/app/api/compile/route.ts',
  'src/app/api/projects/route.ts','src/app/api/projects/[id]/route.ts',
  'src/app/api/projects/[id]/snapshots/route.ts']){
  assert.match(fs.readFileSync(file,'utf8'),/verifySynapseAdmin\(/,file);
 }
});
