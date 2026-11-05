import type { SynapseProject } from './types';

export type PendingProject = {
  key: string;
  id?: string;
  name: string;
  fileCount?: number;
  updatedAt?: string;
  doubleEncoded: boolean;
};

/** Read-only preview of legacy JSONB strings. Never repair by overwriting in the browser. */
function pendingProject(value: unknown, index: number): PendingProject {
  let parsed: unknown = value;
  if (typeof value === 'string' && value.length <= 34_000_000) {
    try { parsed = JSON.parse(value) as unknown; } catch { /* Leave legacy data untouched. */ }
  }
  const obj = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown> : {};
  return {
    key: String(index),
    id: typeof obj.id === 'string' && /^[0-9a-f-]{36}$/i.test(obj.id) ? obj.id : undefined,
    name: typeof obj.name === 'string' && obj.name.trim()
      ? obj.name.slice(0, 200) : 'Registro sin nombre visible',
    fileCount: Array.isArray(obj.files) ? obj.files.length : undefined,
    updatedAt: typeof obj.updatedAt === 'string' && !Number.isNaN(Date.parse(obj.updatedAt))
      ? obj.updatedAt : undefined,
    doubleEncoded: typeof value === 'string' && isUsableProject(parsed)
  };
}


/**
 * Database responses are untrusted at runtime even when fetch is typed.
 * Never discard or rewrite incomplete records: only omit them from the
 * interactive listing and show the administrator a recovery warning.
 */
export function inspectProjectList(value: unknown): {
  projects: SynapseProject[];
  incompleteCount: number;
  pending: PendingProject[];
} {
  if (!Array.isArray(value)) {
    throw new Error('La API devolvió un formato de biblioteca inesperado');
  }

  const projects: SynapseProject[] = [];
  let incompleteCount = 0;
  const pending: PendingProject[] = [];

  for (const [index, item] of value.entries()) {
    if (!isUsableProject(item)) {
      incompleteCount += 1;
      pending.push(pendingProject(item, index));
      continue;
    }
    projects.push(item);
  }

  return { projects, incompleteCount, pending };
}

export function isUsableProject(item: unknown): item is SynapseProject {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;

  const project = item as Record<string, unknown>;
  if (typeof project.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(project.id) ||
      typeof project.name !== 'string' || !project.name.trim() ||
      typeof project.mainFile !== 'string' ||
      typeof project.createdAt !== 'string' ||
      typeof project.updatedAt !== 'string' ||
      !Array.isArray(project.files) || project.files.length === 0) return false;

  if (project.files.some(file => !file || typeof file !== 'object' ||
      typeof file.path !== 'string' || typeof file.content !== 'string' ||
      !['utf8', 'base64'].includes(file.encoding))) return false;

  if (!project.files.some(file => file.path === project.mainFile && file.path.endsWith('.tex'))) return false;

  if (project.chats !== undefined &&
      (!Array.isArray(project.chats) || project.chats.some(
        chat => !chat || typeof chat !== 'object' ||
          !['user', 'assistant'].includes(chat.role) || typeof chat.content !== 'string'
      ))) return false;

  return true;
}
