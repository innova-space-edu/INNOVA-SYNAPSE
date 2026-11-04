import { NextResponse } from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET() { return NextResponse.json({ok:true,service:'synapse'}, {headers:{'Cache-Control':'no-store'}}); }
