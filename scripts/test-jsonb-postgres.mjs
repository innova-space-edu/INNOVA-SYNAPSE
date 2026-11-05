// PostgreSQL 17 integration check: ensure postgres.js binds objects as JSONB objects,
// never as JSONB string scalars. Uses ONLY an ephemeral temporary table.
import assert from 'node:assert/strict';
import postgres from 'postgres';

const url = process.env.SYNAPSE_JSONB_TEST_URL;
if (!url) throw new Error('SYNAPSE_JSONB_TEST_URL es obligatoria para esta prueba');
const sql = postgres(url, { max: 1, connect_timeout: 10 });
try {
  await sql.begin(async tx => {
    await tx`CREATE TEMP TABLE synapse_jsonb_test (id int PRIMARY KEY, value jsonb NOT NULL)`;
    const project = {
      id: '1aff4d06-7d68-463b-83b5-38d2aedeb574',
      name: 'Proyecto de prueba',
      mainFile: 'main.tex',
      files: [{ path: 'main.tex', content: 'Hola', encoding: 'utf8' }],
      createdAt: '2026-11-04T00:00:00.000Z',
      updatedAt: '2026-11-04T00:00:00.000Z'
    };
    const snapshot = { name: project.name, files: project.files, mainFile: project.mainFile };
    await tx`INSERT INTO synapse_jsonb_test (id, value) VALUES (1, ${tx.json(project)}::jsonb)`;
    await tx`INSERT INTO synapse_jsonb_test (id, value) VALUES (2, ${tx.json(snapshot)}::jsonb)`;
    const rows = await tx`SELECT id, value, jsonb_typeof(value) AS json_type FROM synapse_jsonb_test ORDER BY id`;
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.equal(row.json_type, 'object', `El registro ${row.id} se guardó como ${row.json_type}`);
      assert.ok(row.value && typeof row.value === 'object' && !Array.isArray(row.value));
      assert.equal(row.value.name, 'Proyecto de prueba');
      assert.equal(row.value.files[0].path, 'main.tex');
    }
    // Temporary table and transaction are discarded at the end of the check.
  });
  console.log('JSONB object roundtrip OK: project and snapshot');
} finally {
  await sql.end({ timeout: 5 });
}
