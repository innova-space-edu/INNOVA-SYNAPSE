import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/project-list.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
});
const exports = {};
new Function('exports', outputText)(exports);
const { inspectProjectList, isUsableProject } = exports;

const valid = {
  id: '1aff4d06-7d68-463b-83b5-38d2aedeb574',
  name: 'Investigación de prueba',
  mainFile: 'main.tex',
  createdAt: '2026-11-04T00:00:00Z',
  updatedAt: '2026-11-04T00:00:00Z',
  files: [{ path: 'main.tex', content: 'Prueba', encoding: 'utf8' }]
};

test('no descarta proyectos válidos ni modifica sus datos', () => {
  const data = [valid];
  const result = inspectProjectList(data);
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0], valid);
  assert.equal(result.incompleteCount, 0);
  assert.equal(data.length, 1);
});

test('aísla registros sin nombre y archivos corruptos sin lanzar errores', () => {
  const missingName = { ...valid, id: 'b17306dd-f8cd-4989-a19d-66fcf346a671', name: undefined };
  const wrongFiles = { ...valid, id: '1cc1435e-bead-4615-a649-b1d846a83fbc', files: [null] };
  const data = [missingName, valid, wrongFiles, null];
  const result = inspectProjectList(data);
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0], valid);
  assert.equal(result.incompleteCount, 3);
  assert.equal(data.length, 4);
});

test('rechaza respuestas de API que no sean listas', () => {
  assert.throws(() => inspectProjectList({ projects: [valid] }), /formato de biblioteca/);
  assert.throws(() => inspectProjectList(undefined), /formato de biblioteca/);
});

test('rechaza mensajes mal formados y evita errores del editor', () => {
  const broken = { ...valid, chats: [{ role: 'assistant' }] };
  const result = inspectProjectList([broken, valid]);
  assert.equal(result.incompleteCount, 1);
  assert.deepEqual(result.projects, [valid]);
});

test('no abre un proyecto con files ausente aunque el servidor devuelva 200', () => {
  const missing = { ...valid, files: undefined };
  const result = inspectProjectList([missing, valid]);
  assert.equal(isUsableProject(missing), false);
  assert.equal(result.projects.length, 1);
  assert.equal(result.incompleteCount, 1);
  assert.equal(isUsableProject(valid), true);
});

test('bloquea un registro que declara archivos no utilizables por el editor', () => {
  assert.equal(isUsableProject({ ...valid, files: [] }), false);
  assert.equal(isUsableProject({ ...valid, files: [undefined] }), false);
  assert.equal(isUsableProject({ ...valid, files: [{ path: 'main.tex', content: null, encoding: 'utf8' }] }), false);
  assert.equal(isUsableProject({ ...valid, mainFile: 'other.tex' }), false);
});

test('muestra resumen de proyectos con JSONB de formato antiguo sin repararlos', () => {
  const legacy = JSON.stringify(valid);
  const results = inspectProjectList([legacy, valid]);
  assert.equal(results.projects.length, 1);
  assert.equal(results.incompleteCount, 1);
  assert.equal(results.pending.length, 1);
  assert.equal(results.pending[0].name, valid.name);
  assert.equal(results.pending[0].id, valid.id);
  assert.equal(results.pending[0].fileCount, 1);
  assert.equal(results.pending[0].doubleEncoded, true);
  assert.equal(results.projects[0], valid);
  assert.equal(legacy, JSON.stringify(valid));
});

test('los registros corruptos solo muestran resumen genérico y no cierran la biblioteca', () => {
  const results = inspectProjectList(['{no-es-json}', null, 42, valid]);
  assert.equal(results.projects.length, 1);
  assert.equal(results.incompleteCount, 3);
  assert.equal(results.pending[0].name, 'Registro sin nombre visible');
  assert.equal(results.pending[0].doubleEncoded, false);
  assert.equal(results.pending[1].id, undefined);
});
