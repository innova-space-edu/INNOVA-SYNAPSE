import { openDB } from 'idb';
import type { SynapseProject } from './types';

const DB = 'innova-synapse-v1';
const STORE = 'projects';
function database() {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB no disponible en este navegador');
  return openDB(DB, 1, {
    upgrade(db) { if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }); }
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
