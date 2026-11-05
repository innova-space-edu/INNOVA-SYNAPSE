import { NextResponse } from 'next/server';
import { verifySynapseUser } from '@/lib/server/access';
import { db } from '@/lib/server/database';
import { sameOrigin } from '@/lib/server/collaboration';
import { validUuid } from '@/lib/server/validate';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const user=await verifySynapseUser(req);
 if(!user) return NextResponse.json({error:'Acceso denegado'},{status:403});
 try {
  const rows=await db()`SELECT m.id,m.project_id,m.role,p.owner_email,
    p.document->>'name' AS name,m.expires_at
   FROM synapse_members m JOIN synapse_projects p ON p.id=m.project_id
   WHERE m.email=${user.email} AND m.status='pending' AND m.expires_at>now()
   ORDER BY m.invited_at DESC LIMIT 100`;
  return NextResponse.json(rows,{headers:{'Cache-Control':'no-store'}});
 } catch {return NextResponse.json({error:'No se pudo consultar invitaciones'},{status:503});}
}
export async function POST(req:Request){
 if(!sameOrigin(req)) return NextResponse.json({error:'Origen inválido'},{status:403});
 const user=await verifySynapseUser(req);
 if(!user) return NextResponse.json({error:'Acceso denegado'},{status:403});
 let input;
 try {const raw=await req.text(); if(raw.length>1024) throw new Error(); input=JSON.parse(raw);} catch {return NextResponse.json({error:'Solicitud inválida'},{status:400});}
 if(!validUuid(input?.id || '') || !['accept','decline'].includes(input?.action)) return NextResponse.json({error:'Invitación inválida'},{status:400});
 try {
  const rows=input.action==='accept'
   ? await db()`UPDATE synapse_members SET status='accepted',accepted_at=now()
     WHERE id=${input.id}::uuid AND email=${user.email} AND status='pending' AND expires_at>now() RETURNING project_id`
   : await db()`DELETE FROM synapse_members WHERE id=${input.id}::uuid AND email=${user.email} AND status='pending' RETURNING project_id`;
  if(!rows.length) return NextResponse.json({error:'Invitación vencida, retirada o destinada a otro correo.'},{status:404});
  return NextResponse.json({ok:true,projectId:rows[0].project_id});
 } catch {return NextResponse.json({error:'No se pudo procesar la invitación'},{status:503});}
}
