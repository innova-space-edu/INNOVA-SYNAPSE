import { openDB } from 'idb';
import type { SynapseProject, ProjectSnapshot } from './types';

const DB = 'innova-synapse-v1';
const STORE = 'projects';
const SNAPSHOTS = 'snapshots';
function database() {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB no disponible en este navegador');
  return openDB(DB, 2, {
    upgrade(db) { if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }); if (!db.objectStoreNames.contains(SNAPSHOTS)) db.createObjectStore(SNAPSHOTS, { keyPath: 'id' }); }
  });
}
export async function listProjects(): Promise<SynapseProject[]> {
  const db = await database();
  return (await db.getAll(STORE) as SynapseProject[])
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function loadProject(id: string): Promise<SynapseProject | undefined> {
  const db = await database();
  return db.get(STORE, id) as Promise<SynapseProject | undefined>;
}
export async function saveProject(project: SynapseProject): Promise<void> {
  const db = await database();
  await db.put(STORE, { ...project, updatedAt: new Date().toISOString() });
}
export async function deleteProject(id: string): Promise<void> {
  const db = await database();
  await db.delete(STORE, id);
}

export async function listSnapshots(projectId: string): Promise<ProjectSnapshot[]> {
  const db = await database();
  return (await db.getAll(SNAPSHOTS) as ProjectSnapshot[]).filter(s => s.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function saveSnapshot(project: SynapseProject): Promise<ProjectSnapshot> {
  const db = await database();
  const snapshot: ProjectSnapshot = { id: crypto.randomUUID(), projectId: project.id, name: project.name,
    createdAt: new Date().toISOString(), mainFile: project.mainFile, files: structuredClone(project.files) };
  await db.put(SNAPSHOTS, snapshot);
  const existing = await listSnapshots(project.id);
  for (const old of existing.slice(20)) await db.delete(SNAPSHOTS, old.id);
  return snapshot;
}
