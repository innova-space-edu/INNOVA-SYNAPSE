import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const text = readFileSync(new URL('../src/lib/ai-edits.ts',import.meta.url),'utf8');
const output = ts.transpileModule(text,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const exports = {};
new Function('exports',output)(exports);
const {parseAIEditResponse,applyAITextEdits,sourceFingerprint,sanitizeAITextEdits} = exports;

test('model JSON proposes exact edits and preserves all other LaTeX lines',()=>{
  const before = '\\documentclass{article}\n\\begin{document}\nHola mundo\n\\end{document}\n';
  const raw = JSON.stringify({message:'Cambié el saludo.',edits:[{find:'Hola mundo',replace:'Hola universo'}]});
  const parsed = parseAIEditResponse(raw);
  assert.equal(parsed.content,'Cambié el saludo.');
  assert.equal(parsed.edits.length,1);
  assert.equal(applyAITextEdits(before,parsed.edits),
    '\\documentclass{article}\n\\begin{document}\nHola universo\n\\end{document}\n');
});

test('rejects absent, duplicated, oversized and unchanged proposal fragments',()=>{
  assert.throws(()=>applyAITextEdits('abc def',[{find:'missing',replace:'new'}]),/no coincide/);
  assert.throws(()=>applyAITextEdits('hello hello',[{find:'hello',replace:'world'}]),/varios fragmentos/);
  assert.deepEqual(sanitizeAITextEdits([{find:'a',replace:'b'}]),[]);
  assert.deepEqual(sanitizeAITextEdits(Array(13).fill({find:'hello',replace:'world'})),[]);
  assert.throws(()=>applyAITextEdits('abcd',[{find:'abcd',replace:'abcd'}]),/formato válido/);
});

test('assistant still answers ordinary questions without edits',()=>{
  assert.deepEqual(parseAIEditResponse('La ecuación es correcta.'),{content:'La ecuación es correcta.',edits:[]});
  assert.deepEqual(parseAIEditResponse('{"message":"Bien","edits":[]}'),{content:'Bien',edits:[]});
});

test('a stale file has a different fingerprint and must not receive old proposal',()=>{
  assert.notEqual(sourceFingerprint('Texto original'),sourceFingerprint('Texto editado'));
  assert.equal(sourceFingerprint('Texto original'),sourceFingerprint('Texto original'));
});

test('workspace previews and applies AI edits, stores snapshot and auto-compiles',()=>{
  const workspace=readFileSync(new URL('../src/components/workspace.tsx',import.meta.url),'utf8');
  assert.match(workspace,/sourceFingerprint\(file\.content\) !== review\.fingerprint/);
  assert.match(workspace,/applyAITextEdits\(file\.content, review\.edits\)/);
  assert.match(workspace,/await saveQueue\.current/);
  assert.match(workspace,/await saveSnapshot\(project\)/);
  assert.match(workspace,/lastPdf: undefined/);
  assert.match(workspace,/onReviewProposal=\{reviewAIProposal\}/);
  assert.match(workspace,/await compileProject\(revisedProject, false\)/);
});

test('AI endpoint requests exact edit instructions, not uncontrolled execution',()=>{
  const ai=readFileSync(new URL('../src/app/api/ai/route.ts',import.meta.url),'utf8');
  assert.match(ai,/parseAIEditResponse\(content\)/);
  assert.match(ai,/find.*fragmento exacto/i);
  assert.doesNotMatch(ai,/eval\(/);
});
