import { NextResponse } from 'next/server';
import { verifySynapseAdmin } from '@/lib/server/access';
import { db } from '@/lib/server/database';
import { logProjectDatabaseFailure } from '@/lib/server/db-diagnostics';
import { parseProject, validUuid } from '@/lib/server/validate';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(req:Request,context:Context){
 const admin=await verifySynapseAdmin(req);
 if(!admin) return NextResponse.json({error:'Acceso denegado'},{status:403});
 const {id}=await context.params;
 if(!validUuid(id)) return NextResponse.json({error:'Id inválido'},{status:400});
 try {
  const rows=await db()`SELECT document FROM synapse_projects WHERE id=${id}::uuid AND owner_email=${admin.email} LIMIT 1`;
  if(!rows.length) return NextResponse.json({error:'Proyecto no encontrado (404)'},{status:404});
  return NextResponse.json(rows[0].document,{headers:{'Cache-Control':'no-store'}});
 } catch (error) { logProjectDatabaseFailure('read', error); return NextResponse.json({error:'Error al leer proyecto'},{status:503}); }
}
export async function PUT(req:Request,context:Context){
 const admin=await verifySynapseAdmin(req);
 if(!admin) return NextResponse.json({error:'Acceso denegado'},{status:403});
 const {id}=await context.params;
 if(!validUuid(id)) return NextResponse.json({error:'Id inválido'},{status:400});
 let parsed;
 try {
  const raw=await req.text();
  if(raw.length>34_000_000) return NextResponse.json({error:'Proyecto demasiado grande'},{status:413});
  parsed=parseProject(JSON.parse(raw));
  if(parsed.id!==id) throw new Error('Id de proyecto inconsistente');
 } catch(error) {return NextResponse.json({error:error instanceof Error?error.message:'JSON inválido'},{status:400});}
 try {
  const sql = db();
  const rows=await sql`
   INSERT INTO synapse_projects (id,owner_email,document)
   VALUES (${id}::uuid,${admin.email},${sql.json(parsed)}::jsonb)
   ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document,updated_at=now()
   WHERE synapse_projects.owner_email=EXCLUDED.owner_email RETURNING id
  `;
  if(!rows.length) return NextResponse.json({error:'Proyecto no autorizado'},{status:403});
  return NextResponse.json({ok:true});
 } catch (error) { logProjectDatabaseFailure('save', error); return NextResponse.json({error:'No se pudo guardar en el servidor. Exporta una copia ZIP.'},{status:503}); }
}
export async function DELETE(req:Request,context:Context){
 const admin=await verifySynapseAdmin(req);
 if(!admin) return NextResponse.json({error:'Acceso denegado'},{status:403});
 const {id}=await context.params;
 if(!validUuid(id)) return NextResponse.json({error:'Id inválido'},{status:400});
 try {
  const result=await db()`DELETE FROM synapse_projects WHERE id=${id}::uuid AND owner_email=${admin.email} RETURNING id`;
  if(!result.length) return NextResponse.json({error:'Proyecto no encontrado (404)'},{status:404});
  return NextResponse.json({ok:true});
 } catch (error) { logProjectDatabaseFailure('delete', error); return NextResponse.json({error:'No se pudo eliminar el proyecto'},{status:503}); }
}
