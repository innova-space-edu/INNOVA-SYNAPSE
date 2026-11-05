import type { SynapseProject, ProjectSnapshot } from './types';
import { isUsableProject } from './project-list';

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...options, cache: 'no-store', credentials: 'same-origin',
    headers: { 'Content-Type':'application/json', ...options?.headers } });
  if (!res.ok) {
    let message = 'Error del servidor SYNAPSE ('+res.status+')';
    try { const data = await res.json(); if (typeof data.error === 'string') message = data.error; } catch {}
    throw new Error(message);
  }
  return await res.json() as T;
}
export async function listProjects(): Promise<SynapseProject[]> {
  return api<SynapseProject[]>('/api/projects');
}
export async function loadProject(id: string): Promise<SynapseProject | undefined> {
  try {
    const result = await api<unknown>('/api/projects/' + encodeURIComponent(id));
    if (!isUsableProject(result) || result.id !== id) {
      throw new Error('La API devolvió un proyecto incompleto o con identificador distinto. Sus datos no se modificaron.');
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('(404)')) return undefined;
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
  await api('/api/projects/' + encodeURIComponent(project.id),
    { method: 'PUT', body: JSON.stringify(project) });
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
