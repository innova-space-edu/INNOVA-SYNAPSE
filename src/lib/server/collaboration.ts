import { db } from './database';
export type ProjectRole = 'owner' | 'editor' | 'reader';
export async function projectRole(id: string, email: string): Promise<ProjectRole | null> {
 const rows = await db()`
  SELECT CASE WHEN p.owner_email=${email} THEN 'owner' ELSE m.role END AS role
  FROM synapse_projects p LEFT JOIN synapse_members m
    ON m.project_id=p.id AND m.email=${email} AND m.status='accepted'
  WHERE p.id=${id}::uuid AND (p.owner_email=${email} OR m.id IS NOT NULL)`;
 return rows[0]?.role as ProjectRole | null ?? null;
}
export function sameOrigin(req: Request) {
 const origin = req.headers.get('origin');
 if (!origin) return true; // Non-browser tools still require the signed Access JWT.
 try {
  const candidate = new URL(origin);
  if (candidate.origin !== origin) return false;
  // A tunnel may give Next.js an internal URL. Prefer the configured public origin.
  const configured = process.env.SYNAPSE_PUBLIC_URL?.trim();
  if (configured) return candidate.origin === new URL(configured).origin;
  if (candidate.origin === new URL(req.url).origin) return true;
  // Host is the original HTTP authority. Never accept X-Forwarded-Host as authority.
  const host = req.headers.get('host');
  const protocol = req.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  return protocol === 'https' && candidate.protocol === 'https:' && candidate.host === host;
 } catch { return false; }
}
export function validEmail(value: unknown): value is string {
 return typeof value === 'string' && value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}
