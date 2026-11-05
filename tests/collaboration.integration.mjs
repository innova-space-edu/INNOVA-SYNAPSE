import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import postgres from 'postgres';

test('live API enforces invitations, roles, revocation and concurrent-write conflicts', {timeout:180000}, async()=>{
 const database=process.env.SYNAPSE_JSONB_TEST_URL;
 assert.ok(database,'Use a dedicated disposable test database.');
 const sql=postgres(database,{max:2});
 const ids=[crypto.randomUUID(),crypto.randomUUID()];
 let server;
 let logs='';
 const origin='http://localhost:3430';
 async function api(path,method='GET',body,revision,extra={}){
  const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',
   ...(revision ? {'If-Match':revision}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();
  return {status:response.status,data};
 }
 const project=id=>({id,name:'Colaboración de prueba',mainFile:'main.tex',
  files:[{path:'main.tex',content:'Texto original',encoding:'utf8'}],
  createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
 try{
  await sql.unsafe(readFileSync('db/001-initial.sql','utf8'));
  await sql.unsafe(readFileSync('db/003-collaboration.sql','utf8'));
  await sql.unsafe(readFileSync('db/003-collaboration.sql','utf8'));
  for(const [index,id] of ids.entries())await sql`INSERT INTO synapse_projects(id,owner_email,document)
   VALUES(${id},${index?'foreign-owner@synapse.test':'local-admin@synapse.test'},${sql.json(project(id))}::jsonb)`;
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3430'],
   {env:{...process.env,NODE_ENV:'development',SYNAPSE_LOCAL_DEV:'true',SYNAPSE_DATABASE_URL:database,
    RESEND_API_KEY:'',SYNAPSE_MAIL_FROM:'',SYNAPSE_PUBLIC_URL:origin}});
  server.stdout.on('data',data=>{logs=(logs+data).slice(-12000);});
  server.stderr.on('data',data=>{logs=(logs+data).slice(-12000);});
  let ready=false;
  for(let i=0;i<160;i++){
   try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}
   if(server.exitCode!==null)throw new Error('Server exited: '+logs);
   await delay(500);
  }
  assert.ok(ready,logs);
  const own='/api/projects/'+ids[0], foreign='/api/projects/'+ids[1];
  assert.equal((await api(foreign)).status,404,'outsider cannot read');
  assert.equal((await api(foreign+'/snapshots')).status,404);
  const inviteId=crypto.randomUUID();
  await sql`INSERT INTO synapse_members(id,project_id,email,role)
   VALUES(${inviteId},${ids[1]},'local-admin@synapse.test','reader')`;
  assert.equal((await api(foreign)).status,404,'pending is not access');
  assert.equal((await api('/api/invitations')).data.some(x=>x.id===inviteId),true);
  assert.equal((await api('/api/invitations','POST',{id:inviteId,action:'accept'})).status,200);
  const read=await api(foreign);
  assert.equal(read.data._access,'reader');
  assert.equal((await api(foreign,'PUT',project(ids[1]),read.data._revision)).status,403);
  assert.equal((await api(foreign+'/sharing','POST',{email:'someone@synapse.test',role:'editor'})).status,403);
  assert.equal((await api(foreign,'DELETE')).status,404);
  assert.equal((await api(foreign+'/snapshots','POST',project(ids[1]))).status,404);
  assert.equal((await api('/api/ai','POST',{projectId:ids[1],provider:'gemini',prompt:'Hola'})).status,403);
  await sql`UPDATE synapse_members SET role='editor' WHERE id=${inviteId}`;
  const editable=await api(foreign);
  assert.equal(editable.data._access,'editor');
  const attempts=await Promise.all([
   api(foreign,'PUT',{...project(ids[1]),name:'Edición A'},editable.data._revision),
   api(foreign,'PUT',{...project(ids[1]),name:'Edición B'},editable.data._revision)
  ]);
  assert.deepEqual(attempts.map(x=>x.status).sort(),[200,409],'exactly one concurrent save wins');
  assert.equal((await api(foreign,'PUT',project(ids[1]))).status,409,'missing precondition cannot overwrite');
  const winner=await api(foreign);
  assert.ok(['Edición A','Edición B'].includes(winner.data.name));
  assert.equal((await api(foreign+'/snapshots','POST',project(ids[1]))).status,200);
  await sql`DELETE FROM synapse_members WHERE id=${inviteId}`;
  assert.equal((await api(foreign)).status,404,'revocation takes effect');
  assert.equal((await api(foreign,'PUT',project(ids[1]),winner.data._revision)).status,403);
  const invited=await api(own+'/sharing','POST',{email:'  Invited@Synapse.test ',role:'editor'});
  assert.equal(invited.status,200);
  assert.equal(invited.data.mailStatus,'not_configured','must not claim email was sent');
  const members=(await api(own+'/sharing')).data.members;
  const member=members.find(x=>x.email==='invited@synapse.test');
  assert.ok(member);
  assert.equal((await api('/api/invitations','POST',{id:member.id,action:'accept'})).status,404,'wrong email cannot accept');
  assert.equal((await api(own+'/sharing','POST',{email:'local-admin@synapse.test',role:'reader'})).status,400,'owner cannot be demoted');
  assert.equal((await api(own+'/sharing','POST',{email:'bad-email',role:'editor'})).status,400);
  assert.equal((await api(own,'PUT',project(ids[0]),'1',{Origin:'https://untrusted.example'})).status,403);
  assert.equal((await api(own+'/sharing?member='+member.id,'DELETE')).status,200);
  const expired=crypto.randomUUID();
  await sql`INSERT INTO synapse_members(id,project_id,email,role,expires_at)
   VALUES(${expired},${ids[1]},'local-admin@synapse.test','editor',now()-interval '1 day')`;
  assert.equal((await api('/api/invitations','POST',{id:expired,action:'accept'})).status,404);
  assert.equal((await api(foreign)).status,404);
 }catch(error){console.error(logs);throw error;}
 finally{
  if(server){server.kill('SIGTERM');await delay(500);if(server.exitCode===null)server.kill('SIGKILL');}
  await sql`DELETE FROM synapse_projects WHERE id IN (${ids[0]},${ids[1]})`;
  await sql.end();
 }
});
