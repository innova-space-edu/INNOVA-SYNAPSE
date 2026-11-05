import { createRemoteJWKSet, jwtVerify } from 'jose';

const accessIssuer = () => {
  const team = process.env.CF_ACCESS_TEAM_DOMAIN?.trim().replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
  if (!team || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team)) return null;
  return 'https://' + team;
};

const admins = () => new Set((process.env.SYNAPSE_ADMIN_EMAILS || '')
  .split(',').map(x => x.trim().toLowerCase()).filter(Boolean));

let cached: { issuer: string; jwks: ReturnType<typeof createRemoteJWKSet> } | null = null;
function keySet(issuer: string) {
  if (!cached || cached.issuer !== issuer) cached = {
    issuer, jwks: createRemoteJWKSet(new URL(issuer + '/cdn-cgi/access/certs'))
  };
  return cached.jwks;
}

export type VerifiedAdmin = { email: string; subject: string };
export function accessConfigured() {
  return Boolean(accessIssuer() && process.env.CF_ACCESS_AUD?.trim() && admins().size);
}

/** Cloudflare Access JWT is a *different* application session from the intranet login. */
export async function verifySynapseUser(request: Request): Promise<VerifiedAdmin | null> {
  // Strictly for localhost development; never accepted in production.
  if (process.env.NODE_ENV !== 'production' && process.env.SYNAPSE_LOCAL_DEV === 'true') {
    const hostname = new URL(request.url).hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1')
      return { email: 'local-admin@synapse.test', subject: 'local-development-only' };
  }
  const issuer = accessIssuer();
  const audience = process.env.CF_ACCESS_AUD?.trim();
  const allowlist = admins();
  if (!issuer || !audience || allowlist.size === 0) return null;
  const assertion = request.headers.get('cf-access-jwt-assertion');
  if (!assertion) return null;
  try {
    const { payload } = await jwtVerify(assertion, keySet(issuer), {
      issuer,
      audience,
      algorithms: ['RS256'],
      clockTolerance: 5
    });
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (!email || typeof payload.sub !== 'string' || !payload.sub) return null;
    return { email, subject: payload.sub };
  } catch {
    return null;
  }
}

export async function requireSynapseAdmin(request: Request): Promise<VerifiedAdmin> {
  const user = await verifySynapseAdmin(request);
  if (!user) throw new Error('SYNAPSE_UNAUTHORIZED');
  return user;
}

/** Administrator privileges never come from an invitation or a client header. */
export function isSynapseAdmin(email: string) { return admins().has(email); }
export async function verifySynapseAdmin(request: Request): Promise<VerifiedAdmin | null> {
  const user = await verifySynapseUser(request);
  if (!user) return null;
  if (process.env.NODE_ENV !== 'production' && user.subject === 'local-development-only') return user;
  return isSynapseAdmin(user.email) ? user : null;
}
