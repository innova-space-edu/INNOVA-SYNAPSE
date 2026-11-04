import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export function GET() {
  return NextResponse.json({ ok: true, app: 'innova-synapse', compilerConfigured: Boolean(process.env.LATEX_COMPILER_URL) });
}
