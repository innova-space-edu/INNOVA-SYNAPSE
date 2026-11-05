import { NextResponse } from 'next/server';
import { verifySynapseUser, verifySynapseAdmin } from '@/lib/server/access';
export async function GET(req:Request) {
 const user=await verifySynapseUser(req);
 if(!user) return NextResponse.json({error:'Acceso denegado'},{status:403});
 return NextResponse.json({email:user.email,canCreate:Boolean(await verifySynapseAdmin(req))},{headers:{'Cache-Control':'no-store'}});
}
