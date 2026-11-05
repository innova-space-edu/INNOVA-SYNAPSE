import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/ai-agents.ts', import.meta.url),'utf8');
const output = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports = {};
new Function('exports',output)(exports);
const { quickYearProposal, isAgentMode, agentInstructions } = exports;

test('fast-path proposes reviewable year change without model call',()=>{
  const before = '\\fancyfoot{Concurso Postdoctorado 2027}\n\\title{Prueba}\n';
  const result = quickYearProposal('cambia el año de 2027 a 2026', before, 'edit');
  assert.ok(result);
  assert.equal(result.edits.length,1);
  assert.equal(result.edits[0].find,'\\fancyfoot{Concurso Postdoctorado 2027}');
  assert.equal(result.edits[0].replace,'\\fancyfoot{Concurso Postdoctorado 2026}');
  assert.equal(before.includes('2027'),true); // no mutation
});

test('specialists are restricted to four supported modes',()=>{
  for (const mode of ['edit','latex','review','references']) {
    assert.equal(isAgentMode(mode),true);
    assert.ok(agentInstructions(mode).length>15);
  }
  assert.equal(isAgentMode('terminal'),false);
  assert.equal(isAgentMode(null),false);
});

test('ambiguous/repeated date or too many matches delegate to model',()=>{
  assert.equal(quickYearProposal('cambia el año de 2027 a 2026','2027 2027', 'edit'),null);
  assert.equal(quickYearProposal('cambia el año de 2027 a 2026',Array(15).fill('line 2027').map((s,i)=>s+' '+i).join('\n'),'edit'),null);
  assert.equal(quickYearProposal('cambia el año de 2027 a 2026','unique 2027', 'review'),null);
});

test('no occurrence is reported instead of changing unrelated document',()=>{
  const r=quickYearProposal('cambia el año de 2027 a 2026','No contiene ninguna fecha','edit');
  assert.equal(r.edits.length,0);
  assert.match(r.content,/no aparece/);
});

test('browser LaTeX editor is lazy and its scroller has vertical overflow',()=>{
  const ws=readFileSync(new URL('../src/components/workspace.tsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/app/globals.css',import.meta.url),'utf8');
  assert.match(ws,/dynamic\(/);
  assert.match(ws,/LatexCodeEditor/);
  assert.doesNotMatch(ws, /import CodeMirror from/);
  assert.match(css,/\.editor-container \.cm-scroller\{[^}]*overflow-y:auto/);
  assert.match(css,/\.assistant-input textarea,\.assistant-expanded \.assistant-input textarea\{[^}]*height:36px/);
});

test('AI response and provider errors never assume provider returned JSON',()=>{
  const ai=readFileSync(new URL('../src/app/api/ai/route.ts',import.meta.url),'utf8');
  const chat=readFileSync(new URL('../src/components/ai-chat.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(ai,/await resp\.json\(\)/);
  assert.doesNotMatch(chat,/await response\.json\(\)/);
  assert.match(ai,/quickYearProposal\(/);
  assert.match(ai,/resp\.headers\.get\('content-type'\)/);
  assert.match(ai,/\[SYNAPSE_AI_UPSTREAM\]/);
  assert.match(chat,/slice\(0,16000\)/);
});
