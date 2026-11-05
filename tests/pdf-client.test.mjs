import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/pdf-client.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
});
const exports = {};
new Function('exports', outputText)(exports);
const { pdfBlobFromBase64 } = exports;
const valid = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF\n';

test('decodes compiler base64 as a real PDF Blob with original bytes', async () => {
  const value = Buffer.from(valid, 'binary').toString('base64');
  const blob = pdfBlobFromBase64(value);
  assert.equal(blob.type, 'application/pdf');
  assert.equal(blob.size, Buffer.byteLength(valid));
  assert.equal(Buffer.from(await blob.arrayBuffer()).toString(), valid);
});

test('fails closed for invalid PDF header, truncation and base64', () => {
  assert.throws(() => pdfBlobFromBase64(Buffer.from('Not PDF %%EOF').toString('base64')), /PDF completo/);
  assert.throws(() => pdfBlobFromBase64(Buffer.from('%PDF-1.4 incomplete').toString('base64')), /PDF completo/);
  assert.throws(() => pdfBlobFromBase64('NOT VALID BASE64'), /codificación inválida/);
  assert.throws(() => pdfBlobFromBase64(''), /vacío/);
});

test('workspace renders PDF using a revocable Blob, not a data URI', () => {
  const workspace = readFileSync(new URL('../src/components/workspace.tsx', import.meta.url), 'utf8');
  assert.match(workspace, /URL\.createObjectURL\(pdfBlob\)/);
  assert.match(workspace, /URL\.revokeObjectURL\(objectUrl\)/);
  assert.doesNotMatch(workspace, /data:application\/pdf;base64,/);
  assert.match(workspace, /pdfBlobFromBase64\(data\.pdf\)/);
  assert.match(workspace, /Abrir PDF/);
});
