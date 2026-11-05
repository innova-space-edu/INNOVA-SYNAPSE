import type { SynapseProject } from './types';

/**
 * Database responses are untrusted at runtime even when fetch is typed.
 * Never discard or rewrite incomplete records: only omit them from the
 * interactive listing and show the administrator a recovery warning.
 */
export function inspectProjectList(value: unknown): {
  projects: SynapseProject[];
  incompleteCount: number;
} {
  if (!Array.isArray(value)) {
    throw new Error('La API devolvió un formato de biblioteca inesperado');
  }

  const projects: SynapseProject[] = [];
  let incompleteCount = 0;

  for (const item of value) {
    if (!isUsableProject(item)) {
      incompleteCount += 1;
      continue;
    }
    projects.push(item);
  }

  return { projects, incompleteCount };
}

function isUsableProject(item: unknown): item is SynapseProject {
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
