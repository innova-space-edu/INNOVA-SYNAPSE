import { NextResponse } from 'next/server';
import { verifySynapseUser } from '@/lib/server/access';
import { db } from '@/lib/server/database';
import { projectRole, sameOrigin, validEmail } from '@/lib/server/collaboration';
import { validUuid } from '@/lib/server/validate';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(req:Request,context:Context){
 const user=await verifySynapseUser(req);
 const {id}=await context.params;
 if(!user || !validUuid(id)) return NextResponse.json({error:'Acceso denegado'},{status:403});
 try {
  const role=await projectRole(id,user.email);
  if(!role) return NextResponse.json({error:'Proyecto no encontrado'},{status:404});
  const members=role==='owner' ? await db()`SELECT id,email,role,status,expires_at FROM synapse_members WHERE project_id=${id}::uuid ORDER BY invited_at DESC` : [];
  return NextResponse.json({role,members},{headers:{'Cache-Control':'no-store'}});
 } catch { return NextResponse.json({error:'No se pudo consultar accesos. Comprueba la migración 003.'},{status:503}); }
}
export async function POST(req:Request,context:Context){
 if(!sameOrigin(req)) return NextResponse.json({error:'Origen inválido'},{status:403});
 const user=await verifySynapseUser(req);
 const {id}=await context.params;
 if(!user || !validUuid(id)) return NextResponse.json({error:'Acceso denegado'},{status:403});
 let input;
 try { const raw=await req.text(); if(raw.length>2048) throw new Error(); input=JSON.parse(raw); } catch {return NextResponse.json({error:'Solicitud inválida'},{status:400});}
 const email=typeof input?.email==='string' ? input.email.trim().toLowerCase() : '';
 if(!validEmail(email) || !['editor','reader'].includes(input?.role))
  return NextResponse.json({error:'Correo o permiso inválido'},{status:400});
 try {
  const result=await db().begin(async sql=>{
   const projects=await sql`SELECT owner_email,document FROM synapse_projects WHERE id=${id}::uuid FOR UPDATE`;
   if(projects[0]?.owner_email!==user.email) return {status:403,error:'Solo el propietario administra accesos.'};
   if(email===user.email) return {status:400,error:'El propietario ya tiene acceso completo.'};
   const previous=await sql`SELECT id,status,invited_at FROM synapse_members WHERE project_id=${id}::uuid AND email=${email}`;
   if(previous[0]?.status==='pending' && Date.now()-new Date(previous[0].invited_at).getTime()<60_000)
    return {status:429,error:'Espera un minuto antes de volver a invitar a este correo.'};
   const total=await sql`SELECT count(*)::int AS count FROM synapse_members WHERE project_id=${id}::uuid`;
   if(!previous.length && total[0].count>=100) return {status:400,error:'Máximo 100 colaboradores por proyecto.'};
   const members=await sql`INSERT INTO synapse_members(id,project_id,email,role)
    VALUES (${crypto.randomUUID()}::uuid,${id}::uuid,${email},${input.role})
    ON CONFLICT(project_id,email) DO UPDATE SET role=EXCLUDED.role,
     invited_at=CASE WHEN synapse_members.status='pending' THEN now() ELSE synapse_members.invited_at END,
     expires_at=CASE WHEN synapse_members.status='pending' THEN now()+interval '7 days' ELSE synapse_members.expires_at END
    RETURNING id,status`;
   return {status:200,id:String(members[0].id),pending:members[0].status==='pending',
    name:typeof projects[0].document?.name==='string'?projects[0].document.name:'Proyecto'};
  });
  if(result.status!==200) return NextResponse.json({error:result.error},{status:result.status});
  // The link is not a bearer credential: Access must verify the invited email.
  const origin=process.env.SYNAPSE_PUBLIC_URL || '';
  let url='';
  try { const base=new URL(origin); if(base.protocol==='https:') url=new URL('/?invitation='+result.id,base).href; } catch {}
  let mailStatus='not_configured';
  if(result.pending && url && process.env.RESEND_API_KEY && process.env.SYNAPSE_MAIL_FROM){
   try {
    const sent=await fetch('https://api.resend.com/emails',{
     method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json',
      'Idempotency-Key':'synapse-invite-'+result.id+'-'+Math.floor(Date.now()/60_000)},
     body:JSON.stringify({from:process.env.SYNAPSE_MAIL_FROM,to:[email],
      subject:'Invitación a colaborar en INNOVA SYNAPSE',
      text:user.email+' te invita a '+result.name+' como '+(input.role==='editor'?'editor':'lector')+
       '.\nInicia sesión con '+email+' y acepta la invitación (válida por 7 días):\n'+url}),
     signal:AbortSignal.timeout(10000)
    });
    mailStatus=sent.ok?'sent':'failed';
   } catch {mailStatus='failed';}
  }
  return NextResponse.json({ok:true,url,mailStatus,pending:result.pending});
 } catch {return NextResponse.json({error:'No se pudo guardar la invitación'},{status:503});}
}
export async function DELETE(req:Request,context:Context){
 if(!sameOrigin(req)) return NextResponse.json({error:'Origen inválido'},{status:403});
 const user=await verifySynapseUser(req);
 const {id}=await context.params;
 const member=new URL(req.url).searchParams.get('member') || '';
 if(!user || !validUuid(id) || !validUuid(member)) return NextResponse.json({error:'Solicitud inválida'},{status:400});
 try {
  const ok=await db().begin(async sql=>{
   const rows=await sql`SELECT owner_email FROM synapse_projects WHERE id=${id}::uuid FOR UPDATE`;
   if(rows[0]?.owner_email!==user.email) return false;
   await sql`DELETE FROM synapse_members WHERE project_id=${id}::uuid AND id=${member}::uuid`;
   return true;
  });
  return NextResponse.json(ok?{ok:true}:{error:'Solo el propietario administra accesos.'},{status:ok?200:403});
 } catch {return NextResponse.json({error:'No se pudo retirar el acceso'},{status:503});}
}
