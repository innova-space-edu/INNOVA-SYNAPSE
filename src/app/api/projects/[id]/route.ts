import { NextResponse } from 'next/server';
import { verifySynapseUser, verifySynapseAdmin } from '@/lib/server/access';
import { db } from '@/lib/server/database';
import { parseProject, validUuid } from '@/lib/server/validate';
import { sameOrigin } from '@/lib/server/collaboration';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(req:Request,context:Context){
 const user=await verifySynapseUser(req);
 if(!user) return NextResponse.json({error:'Acceso denegado'},{status:403});
 const {id}=await context.params;
 if(!validUuid(id)) return NextResponse.json({error:'Id inválido'},{status:400});
 try {
  const rows=await db()`
   SELECT p.document,p.owner_email,p.revision,
    CASE WHEN p.owner_email=${user.email} THEN 'owner' ELSE m.role END AS role
   FROM synapse_projects p LEFT JOIN synapse_members m
    ON m.project_id=p.id AND m.email=${user.email} AND m.status='accepted'
   WHERE p.id=${id}::uuid AND (p.owner_email=${user.email} OR m.id IS NOT NULL)`;
  if(!rows.length) return NextResponse.json({error:'Proyecto no encontrado (404)'},{status:404});
  const row=rows[0];
  return NextResponse.json(typeof row.document === 'object' && row.document
   ? {...row.document,_revision:String(row.revision),_access:row.role,_owner:row.owner_email} : row.document,
   {headers:{'Cache-Control':'no-store'}});
 } catch { return NextResponse.json({error:'Error al leer proyecto. Comprueba la migración 003.'},{status:503}); }
}
export async function PUT(req:Request,context:Context){
 if(!sameOrigin(req)) return NextResponse.json({error:'Origen inválido'},{status:403});
 const user=await verifySynapseUser(req);
 if(!user) return NextResponse.json({error:'Acceso denegado'},{status:403});
 const {id}=await context.params;
 if(!validUuid(id)) return NextResponse.json({error:'Id inválido'},{status:400});
 let parsed;
 try {
  const raw=await req.text();
  if(raw.length>34_000_000) return NextResponse.json({error:'Proyecto demasiado grande'},{status:413});
  parsed=parseProject(JSON.parse(raw));
  if(parsed.id!==id) throw new Error('Id inconsistente');
  // These fields are server-owned and never persisted from the browser.
  delete parsed._revision; delete parsed._access; delete parsed._owner;
 } catch {return NextResponse.json({error:'Proyecto inválido'},{status:400});}
 const admin=await verifySynapseAdmin(req);
 try {
  const result=await db().begin(async sql=>{
   const rows=await sql`SELECT owner_email,revision FROM synapse_projects WHERE id=${id}::uuid FOR UPDATE`;
   if(!rows.length){
    if(!admin) return {status:403,error:'Solo el administrador puede crear proyectos.'};
    // Concurrent creation of the same id must never replace another project.
    const inserted=await sql`INSERT INTO synapse_projects(id,owner_email,document)
      VALUES (${id}::uuid,${user.email},${sql.json(parsed)}::jsonb)
      ON CONFLICT(id) DO NOTHING RETURNING revision`;
    return inserted.length ? {status:200,revision:String(inserted[0].revision)} :
      {status:409,error:'El proyecto ya existe. Recarga antes de guardar.'};
   }
   const owner=rows[0].owner_email===user.email;
   const members=owner ? [] : await sql`SELECT role FROM synapse_members
    WHERE project_id=${id}::uuid AND email=${user.email} AND status='accepted'`;
   if(!owner && members[0]?.role!=='editor') return {status:403,error:'No tienes permiso de edición.'};
   if(req.headers.get('if-match')!==String(rows[0].revision))
    return {status:409,error:'Otra sesión guardó una versión nueva. Exporta tus cambios como ZIP y carga la versión del servidor antes de continuar.'};
   const saved=await sql`UPDATE synapse_projects SET document=${sql.json(parsed)}::jsonb,
    revision=revision+1,updated_at=now() WHERE id=${id}::uuid RETURNING revision`;
   return {status:200,revision:String(saved[0].revision)};
  });
  return NextResponse.json(result,{status:result.status});
 } catch {return NextResponse.json({error:'No se pudo guardar. Exporta una copia ZIP.'},{status:503});}
}
export async function DELETE(req:Request,context:Context){
 if(!sameOrigin(req)) return NextResponse.json({error:'Origen inválido'},{status:403});
 const user=await verifySynapseUser(req);
 if(!user) return NextResponse.json({error:'Acceso denegado'},{status:403});
 const {id}=await context.params;
 if(!validUuid(id)) return NextResponse.json({error:'Id inválido'},{status:400});
 try {
  const legacyOnly = new URL(req.url).searchParams.get('legacyOnly') === '1';
  const sql=db();
  const result=legacyOnly
   ? await sql`DELETE FROM synapse_projects WHERE id=${id}::uuid AND owner_email=${user.email} AND jsonb_typeof(document) = 'string' RETURNING id`
   : await sql`DELETE FROM synapse_projects WHERE id=${id}::uuid AND owner_email=${user.email} RETURNING id`;
  if(!result.length) return NextResponse.json({error:legacyOnly?'El registro ya no está pendiente de recuperación; actualiza la biblioteca.':'Proyecto no encontrado (404)'},{status:legacyOnly?409:404});
  return NextResponse.json({ok:true});
 } catch {return NextResponse.json({error:'No se pudo eliminar el proyecto'},{status:503});}
}
