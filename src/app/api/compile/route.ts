import { verifySynapseAdmin } from '@/lib/server/access';
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!await verifySynapseAdmin(req)) return NextResponse.json({error:'Acceso administrativo requerido'},{status:403});
  // MVP restricted to trusted/local environments; enforce auth + rate limits before publishing.
  const compiler = process.env.LATEX_COMPILER_URL;
  const token = process.env.LATEX_COMPILER_TOKEN;
  if (!compiler || !token) return NextResponse.json({ error: 'Compilador no configurado. Consulta README.md.', log: '' }, { status: 503 });
  try {
    const raw = await req.text();
    if (raw.length > 16 * 1024 * 1024) return NextResponse.json({ error: 'Proyecto demasiado grande', log: '' }, { status: 413 });
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object' || !('files' in body) || !Array.isArray(body.files) || body.files.length > 150)
      return NextResponse.json({ error: 'Proyecto inválido', log: '' }, { status: 400 });
    const result = await fetch(new URL('/compile', compiler), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: raw,
      cache: 'no-store',
      signal: AbortSignal.timeout(65000)
    });
    const json = await result.json();
    return NextResponse.json(json, { status: result.status });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al compilar', log: '' }, { status: 502 });
  }
}
