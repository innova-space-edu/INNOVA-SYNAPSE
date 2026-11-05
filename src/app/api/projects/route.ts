import { NextResponse } from 'next/server';
import { verifySynapseUser } from '@/lib/server/access';
import { db } from '@/lib/server/database';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
 const user=await verifySynapseUser(req);
 if(!user) return NextResponse.json({error:'Acceso denegado'},{status:403});
 try {
  const rows=await db()`
   SELECT p.document,p.owner_email,p.revision,
    CASE WHEN p.owner_email=${user.email} THEN 'owner' ELSE m.role END AS role
   FROM synapse_projects p LEFT JOIN synapse_members m
    ON m.project_id=p.id AND m.email=${user.email} AND m.status='accepted'
   WHERE p.owner_email=${user.email} OR m.id IS NOT NULL
   ORDER BY p.updated_at DESC LIMIT 500`;
  return NextResponse.json(rows.map(r=>typeof r.document === 'object' && r.document
   ? {...r.document,_revision:String(r.revision),_access:r.role,_owner:r.owner_email} : r.document),
   {headers:{'Cache-Control':'no-store'}});
 } catch { return NextResponse.json({error:'No se pudo consultar proyectos. Comprueba la migración 003.'},{status:503}); }
}
