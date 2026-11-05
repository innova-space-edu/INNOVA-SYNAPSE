import { NextResponse } from 'next/server';
import { verifySynapseUser } from '@/lib/server/access';
import { projectRole, sameOrigin } from '@/lib/server/collaboration';
import { db } from '@/lib/server/database';
import { parseProject, validUuid } from '@/lib/server/validate';
import type { SynapseProject } from '@/lib/types';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(req:Request,context:Context){
 const admin=await verifySynapseUser(req);
 if(!admin) return NextResponse.json({error:'Acceso denegado'},{status:403});
 const {id}=await context.params;
 if(!validUuid(id)) return NextResponse.json({error:'Id inválido'},{status:400});
 try {
  if(!await projectRole(id,admin.email)) return NextResponse.json({error:'Proyecto no autorizado'},{status:404});
  const rows=await db()`
   SELECT id, project_id, created_at, payload FROM synapse_snapshots
   WHERE project_id=${id}::uuid
   ORDER BY created_at DESC LIMIT 20`;
  return NextResponse.json(rows.map(r=>({...r.payload,id:r.id,projectId:r.project_id,createdAt:r.created_at})),{headers:{'Cache-Control':'no-store'}});
 } catch {return NextResponse.json({error:'No se pudo consultar versiones'},{status:503});}
}
export async function POST(req:Request,context:Context){
 if(!sameOrigin(req)) return NextResponse.json({error:'Origen inválido'},{status:403});
 const admin=await verifySynapseUser(req);
 if(!admin) return NextResponse.json({error:'Acceso denegado'},{status:403});
 const {id}=await context.params;
 if(!validUuid(id)) return NextResponse.json({error:'Id inválido'},{status:400});
 let input: Pick<SynapseProject, 'name' | 'mainFile' | 'files'>;
 try {
  const raw=await req.text();
  if(raw.length>20_000_000) return NextResponse.json({error:'Instantánea demasiado grande'},{status:413});
  const candidate: unknown = JSON.parse(raw);
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
    throw new Error('Instantánea inválida');
  const validated = parseProject({
    ...candidate,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  input = {name: validated.name, mainFile: validated.mainFile, files: validated.files};
 } catch {return NextResponse.json({error:'Instantánea inválida'},{status:400});}
 try {
  const sql=db();
  const role=await projectRole(id,admin.email);
  if(role!=='owner' && role!=='editor') return NextResponse.json({error:'Proyecto no autorizado'},{status:404});
  const snapshotId=crypto.randomUUID();
  await sql`INSERT INTO synapse_snapshots (id,project_id,owner_email,payload)
    VALUES (${snapshotId}::uuid,${id}::uuid,${admin.email},${sql.json(input)}::jsonb)`;
  await sql`DELETE FROM synapse_snapshots WHERE id IN (
    SELECT id FROM synapse_snapshots WHERE project_id=${id}::uuid
    ORDER BY created_at DESC,id DESC OFFSET 20
  )`;
  return NextResponse.json({id:snapshotId,projectId:id,createdAt:new Date().toISOString(),...input});
 } catch {return NextResponse.json({error:'Error al guardar instantánea'},{status:503});}
}
