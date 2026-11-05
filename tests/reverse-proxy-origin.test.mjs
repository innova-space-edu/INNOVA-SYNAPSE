import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const exports={};
const source=readFileSync('src/lib/server/collaboration.ts','utf8');
new Function('exports','require',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,()=>({}));
const {sameOrigin}=exports;
test('Cloudflare origin works when Next sees an internal URL, without trusting forwarded host',()=>{
 const previous=process.env.SYNAPSE_PUBLIC_URL;delete process.env.SYNAPSE_PUBLIC_URL;
 try{
  const request=headers=>new Request('http://0.0.0.0:3000/api/projects/test',{headers});
  assert.equal(sameOrigin(request({Origin:'https://synapse.innova-space-edu.cl',Host:'synapse.innova-space-edu.cl','X-Forwarded-Proto':'https'})),true);
  assert.equal(sameOrigin(request({Origin:'https://attacker.example',Host:'synapse.innova-space-edu.cl','X-Forwarded-Host':'attacker.example','X-Forwarded-Proto':'https'})),false);
  assert.equal(sameOrigin(request({Origin:'null'})),false);
  process.env.SYNAPSE_PUBLIC_URL='https://synapse.innova-space-edu.cl';
  assert.equal(sameOrigin(request({Origin:'https://synapse.innova-space-edu.cl'})),true);
  assert.equal(sameOrigin(request({Origin:'https://attacker.example',Host:'attacker.example','X-Forwarded-Proto':'https'})),false);
 }finally{if(previous===undefined)delete process.env.SYNAPSE_PUBLIC_URL;else process.env.SYNAPSE_PUBLIC_URL=previous;}
});
