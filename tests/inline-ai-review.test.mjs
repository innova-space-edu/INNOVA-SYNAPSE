import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ws = readFileSync(new URL('../src/components/workspace.tsx',import.meta.url),'utf8');
const cm = readFileSync(new URL('../src/components/latex-code-editor.tsx',import.meta.url),'utf8');
const chat = readFileSync(new URL('../src/components/ai-chat.tsx',import.meta.url),'utf8');
const css = readFileSync(new URL('../src/app/globals.css',import.meta.url),'utf8');

test('source editor can scroll vertically independent of PDF preview',()=>{
  assert.match(css,/\.code-panel\{height:100%;min-height:0;overflow:hidden\}/);
  assert.match(css,/\.editor-container\{height:0;min-height:0;flex:1 1 0/);
  assert.match(css,/overflow-y:scroll!important/);
  assert.match(ws,/reviewEdits=\{review\?\.filePath === activeFile \? review\.edits : \[\]\}/);
});

test('proposed changes overlay real CodeMirror code without changing the document',()=>{
  assert.match(cm,/Decoration\.mark\(\{ class: 'cm-ai-removal' \}\)/);
  assert.match(cm,/Decoration\.widget\(\{/);
  assert.match(cm,/className = 'cm-ai-addition'/);
  assert.match(cm,/code\.textContent = this\.replacement/);
  assert.match(cm,/EditorView\.scrollIntoView\(first, \{ y: 'center' \}\)/);
  assert.doesNotMatch(cm,/innerHTML/);
});

test('accept and reject are small buttons on code, not inside chat',()=>{
  assert.match(ws,/className="inline-ai-toolbar"/);
  assert.match(ws,/aria-label="Rechazar cambios propuestos"/);
  assert.match(ws,/aria-label="Aceptar cambios, guardar y compilar PDF"/);
  assert.match(ws,/onClick=\{rejectAIProposal\}/);
  assert.match(ws,/onClick=\{\(\)=>void applyAIProposal\(\)\}/);
  assert.doesNotMatch(chat,/ai-edit-diff/);
  assert.match(chat,/setOpen\(false\)/);
  assert.match(chat,/onReviewProposal\(updated\.length-1, answer\)/);
});

test('before an AI edit is accepted, a version is preserved, saved and then compiled',()=>{
  const approve = ws.slice(ws.indexOf('async function applyAIProposal()'), ws.indexOf('function createFile()'));
  assert.ok(approve.indexOf('await saveSnapshot(project)') < approve.indexOf('await saveProject(revisedProject)'));
  assert.ok(approve.indexOf('await saveProject(revisedProject)') < approve.indexOf('await compileProject(revisedProject, false)'));
  assert.match(ws,/body: JSON\.stringify\(\{ mainFile:target\.mainFile, files:target\.files \}\)/);
  assert.match(ws,/const compiled: SynapseProject =/);
  assert.match(ws,/await saveQueue\.current/);
});

test('assistant prompt has fixed height and small max expanded panel',()=>{
  assert.match(css,/\.code-panel \.assistant-expanded\{height:min\(238px,31dvh\)!important/);
  assert.match(css,/\.code-panel \.assistant-input textarea\{height:34px!important/);
  assert.match(css,/\.code-panel \.assistant-messages\{height:0;min-height:0;flex:1 1 0;overflow-y:auto/);
});
