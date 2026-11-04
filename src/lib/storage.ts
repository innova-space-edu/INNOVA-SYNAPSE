import type { SynapseProject, ProjectSnapshot } from './types';

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
  try { return await api<SynapseProject>('/api/projects/' + encodeURIComponent(id)); }
  catch (error) { if (error instanceof Error && error.message.includes('404')) return undefined; throw error; }
}
export async function saveProject(project: SynapseProject): Promise<void> {
  await api('/api/projects/' + encodeURIComponent(project.id),
    { method: 'PUT', body: JSON.stringify(project) });
}
export async function deleteProject(id: string): Promise<void> {
  await api('/api/projects/' + encodeURIComponent(id), { method:'DELETE' });
}
export async function listSnapshots(projectId: string): Promise<ProjectSnapshot[]> {
  return api<ProjectSnapshot[]>('/api/projects/' + encodeURIComponent(projectId) + '/snapshots');
}
export async function saveSnapshot(project: SynapseProject): Promise<ProjectSnapshot> {
  return api<ProjectSnapshot>('/api/projects/' + encodeURIComponent(project.id) + '/snapshots',
    { method:'POST', body: JSON.stringify({ name: project.name, mainFile: project.mainFile, files: project.files }) });
}
