import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { accessConfigured, verifySynapseUser } from './lib/server/access';

/**
 * Early deny gate; server-side API handlers independently verify authorization.
 * The Synapse origin must remain private (Cloudflare Tunnel or Tailscale).
 */
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/api/health') return NextResponse.next();
  const auth = await verifySynapseUser(request);
  if (!auth) {
    const configured = accessConfigured() ||
      (process.env.NODE_ENV !== 'production' && process.env.SYNAPSE_LOCAL_DEV === 'true');
    return new NextResponse(configured ? 'Acceso denegado. Inicia sesión desde Cloudflare Access con el correo invitado al proyecto.' :
      'INNOVA SYNAPSE no tiene configurado el acceso administrativo.', {
        status: configured ? 403 : 503,
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' }
      });
  }
  const headers = new Headers(request.headers);
  headers.delete('x-synapse-admin-email');
  headers.set('x-synapse-admin-email', auth.email);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'same-origin');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
