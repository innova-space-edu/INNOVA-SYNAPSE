import type { SynapseProject, ProjectSnapshot } from './types';
import { isUsableProject } from './project-list';

// Revisions advance only on explicit loads and our own successful writes.
const revisions = new Map<string,string>();
const writes = new Map<string,Promise<void>>();
export const projectRevision = (id: string) => revisions.get(id);
export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'ApiError'; }
}
export async function loadSession(): Promise<{email:string;canCreate:boolean}> { return api('/api/session'); }
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...options, cache: 'no-store', credentials: 'same-origin',
    headers: { 'Content-Type':'application/json', ...options?.headers } });
  if (!res.ok) {
    let message = 'Error del servidor SYNAPSE ('+res.status+')';
    try { const data = await res.json(); if (typeof data.error === 'string') message = data.error; } catch {}
    throw new ApiError(message, res.status);
  }
  return await res.json() as T;
}
export async function listProjects(): Promise<SynapseProject[]> {
  const projects = await api<SynapseProject[]>('/api/projects');
  for (const p of projects) if (p && typeof p === 'object' && p._revision) revisions.set(p.id,p._revision);
  return projects;
}
export async function loadProject(id: string): Promise<SynapseProject | undefined> {
  try {
    const result = await api<unknown>('/api/projects/' + encodeURIComponent(id));
    if (!isUsableProject(result) || result.id !== id) {
      throw new Error('La API devolvió un proyecto incompleto o con identificador distinto. Sus datos no se modificaron.');
    }
    if (result._revision) revisions.set(id,result._revision);
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}
/** Decode a legacy JSONB string for read-only export or explicit recovery as a new project. */
export async function loadLegacyProject(id: string): Promise<SynapseProject> {
  const raw = await api<unknown>('/api/projects/' + encodeURIComponent(id));
  if (typeof raw !== 'string') {
    throw new Error('El registro ya fue recuperado o no corresponde a un proyecto antiguo. Actualiza la biblioteca.');
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('El proyecto antiguo contiene JSON no recuperable automáticamente.');
  }
  if (!isUsableProject(decoded) || decoded.id !== id) {
    throw new Error('El registro no cumple los requisitos para recuperarlo de forma segura. Conserva sus datos y revisa el respaldo.');
  }
  return decoded;
}

export async function saveProject(project: SynapseProject): Promise<void> {
  const payload = JSON.stringify(project);
  const id = project.id;
  const next = (writes.get(id) || Promise.resolve()).catch(() => undefined).then(async () => {
    const revision = revisions.get(id);
    const result = await api<{revision:string}>('/api/projects/' + encodeURIComponent(id),
      { method: 'PUT', body: payload, headers: revision ? {'If-Match': revision} : {} });
    revisions.set(id,result.revision);
  });
  writes.set(id,next);
  try { await next; } finally { if (writes.get(id) === next) writes.delete(id); }
}
export async function deleteProject(id: string): Promise<void> {
  await api('/api/projects/' + encodeURIComponent(id), { method:'DELETE' });
}
/** Only removes a still-double-encoded record. A repaired project cannot be deleted here. */
export async function deleteLegacyProject(id: string): Promise<void> {
  await api('/api/projects/' + encodeURIComponent(id) + '?legacyOnly=1',
    { method:'DELETE' });
}

export async function listSnapshots(projectId: string): Promise<ProjectSnapshot[]> {
  return api<ProjectSnapshot[]>('/api/projects/' + encodeURIComponent(projectId) + '/snapshots');
}
export async function saveSnapshot(project: SynapseProject): Promise<ProjectSnapshot> {
  return api<ProjectSnapshot>('/api/projects/' + encodeURIComponent(project.id) + '/snapshots',
    { method:'POST', body: JSON.stringify({ name: project.name, mainFile: project.mainFile, files: project.files }) });
}
