// Integration fixture for db/002-repair-double-encoded-jsonb.sql.
// Never run against production: GitHub Actions only.
import assert from 'node:assert/strict';
import postgres from 'postgres';

if (process.env.CI !== 'true') throw new Error('Solo CI.');
const url = process.env.SYNAPSE_JSONB_TEST_URL;
if (!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname)) {
  throw new Error('La BD de pruebas debe estar en localhost.');
}
const mode = process.argv[2];
if (!['seed', 'verify'].includes(mode)) throw new Error('Uso: seed|verify');
const sql = postgres(url, { max: 1, connect_timeout: 10 });
const id = '1aff4d06-7d68-463b-83b5-38d2aedeb574';
const snapshotId = '4a640889-af3c-4431-8551-288638de9e72';
const project = {
  id, name:'Prueba de recuperación', mainFile:'main.tex',
  files:[{path:'main.tex',content:'\\\\documentclass{article}',encoding:'utf8'}],
  createdAt:'2026-11-04T00:00:00.000Z', updatedAt:'2026-11-04T00:00:00.000Z'
};
const snapshot = { name:project.name, mainFile:project.mainFile, files:project.files };
try {
  if (mode === 'seed') {
    await sql`CREATE TABLE IF NOT EXISTS synapse_projects (
      id uuid PRIMARY KEY, owner_email text NOT NULL, document jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS synapse_snapshots (
      id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES synapse_projects(id) ON DELETE CASCADE,
      owner_email text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`INSERT INTO synapse_projects (id, owner_email, document)
      VALUES (${id}::uuid, 'ci@example.test', ${sql.json(JSON.stringify(project))}::jsonb)`;
    await sql`INSERT INTO synapse_snapshots (id, project_id, owner_email, payload)
      VALUES (${snapshotId}::uuid, ${id}::uuid, 'ci@example.test', ${sql.json(JSON.stringify(snapshot))}::jsonb)`;
    const [a] = await sql`SELECT jsonb_typeof(document) AS t FROM synapse_projects WHERE id=${id}::uuid`;
    const [b] = await sql`SELECT jsonb_typeof(payload) AS t FROM synapse_snapshots WHERE id=${snapshotId}::uuid`;
    assert.equal(a.t, 'string');
    assert.equal(b.t, 'string');
    console.log('Seed OK: proyectos e instantáneas con doble serialización');
  } else {
    const [a] = await sql`SELECT jsonb_typeof(document) AS t, document FROM synapse_projects WHERE id=${id}::uuid`;
    const [b] = await sql`SELECT jsonb_typeof(payload) AS t, payload FROM synapse_snapshots WHERE id=${snapshotId}::uuid`;
    assert.equal(a.t, 'object');
    assert.equal(b.t, 'object');
    assert.deepEqual(a.document, project);
    assert.deepEqual(b.payload, snapshot);
    console.log('Migration OK: ambos documentos preservados como JSONB object');
  }
} finally {
  await sql.end({timeout:5});
}
