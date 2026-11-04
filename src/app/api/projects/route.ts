import { NextResponse } from 'next/server';
import { verifySynapseAdmin } from '@/lib/server/access';
import { db } from '@/lib/server/database';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
 const admin=await verifySynapseAdmin(req);
 if(!admin) return NextResponse.json({error:'Acceso denegado'},{status:403});
 try {
  const rows=await db()`SELECT document FROM synapse_projects WHERE owner_email=${admin.email} ORDER BY updated_at DESC LIMIT 500`;
  return NextResponse.json(rows.map(r=>r.document),{headers:{'Cache-Control':'no-store'}});
 } catch { return NextResponse.json({error:'No se pudo consultar la base de datos SYNAPSE'},{status:503}); }
}
