import { openDB } from 'idb';
import type { SynapseProject } from './types';

export type LocalDraft = { project: SynapseProject; revision?: string; savedAt: string };
const database = () => openDB('synapse-local-drafts', 1, {
  upgrade(db) { db.createObjectStore('drafts'); }
});
const key = (email: string, id: string) => JSON.stringify([email.toLowerCase(), id]);

/** Private to the signed-in email and this browser; never uploaded automatically. */
export async function readLocalDraft(email: string, id: string): Promise<LocalDraft | undefined> {
  const db = await database();
  try { return await db.get('drafts', key(email, id)); } finally { db.close(); }
}
export async function writeLocalDraft(email: string, project: SynapseProject, revision?: string): Promise<void> {
  const db = await database();
  try {
    await db.put('drafts', { project, revision, savedAt: new Date().toISOString() }, key(email, project.id));
  } finally { db.close(); }
}
export async function clearLocalDraft(email: string, id: string, updatedAt?: string): Promise<void> {
  const db = await database();
  try {
    const tx = db.transaction('drafts', 'readwrite');
    const draft: LocalDraft | undefined = await tx.store.get(key(email, id));
    // A completed save must not erase a more recent edit waiting in IndexedDB.
    if (draft && (!updatedAt || draft.project.updatedAt === updatedAt)) await tx.store.delete(key(email, id));
    await tx.done;
  } finally { db.close(); }
}
export function sameProjectContent(a: SynapseProject, b: SynapseProject) {
  const content = (p: SynapseProject) => JSON.stringify([p.name,p.mainFile,p.files,p.chats || [],p.lastPdf,p.lastLog]);
  return content(a) === content(b);
}
