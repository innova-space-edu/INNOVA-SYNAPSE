import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import 'fake-indexeddb/auto';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const exports={};
new Function('exports','require',ts.transpileModule(readFileSync('src/lib/local-drafts.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,require);
const {writeLocalDraft,readLocalDraft,clearLocalDraft}=exports;
const project={id:crypto.randomUUID(),name:'Prueba',mainFile:'main.tex',files:[{path:'main.tex',content:'Cambios sin guardar',encoding:'utf8'}],updatedAt:'2026-11-05T00:00:01Z'};
test('failed-save copy survives reopening and is isolated by signed-in email',async()=>{
 await writeLocalDraft('owner@synapse.test',project,'4');
 assert.deepEqual((await readLocalDraft('owner@synapse.test',project.id)).project,project);
 assert.equal((await readLocalDraft('owner@synapse.test',project.id)).revision,'4');
 assert.equal(await readLocalDraft('other@synapse.test',project.id),undefined);
});
test('finishing an older save never erases newer local edits',async()=>{
 const newer={...project,updatedAt:'2026-11-05T00:00:02Z',name:'Nueva edición'};
 await writeLocalDraft('owner@synapse.test',newer,'4');
 await clearLocalDraft('owner@synapse.test',project.id,project.updatedAt);
 assert.equal((await readLocalDraft('owner@synapse.test',project.id)).project.name,'Nueva edición');
 await clearLocalDraft('owner@synapse.test',project.id,newer.updatedAt);
 assert.equal(await readLocalDraft('owner@synapse.test',project.id),undefined);
});
