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
 return !origin || origin === new URL(req.url).origin;
}
export function validEmail(value: unknown): value is string {
 return typeof value === 'string' && value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}
