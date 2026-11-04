import JSZip from 'jszip';
import type { SynapseProject, SynapseFile } from './types';
import { newProject } from './templates';

const permitted = /\.(tex|bib|sty|cls|bst|png|jpe?g|pdf|eps|txt|keep)$/i;
const binary = /\.(png|jpe?g|pdf|eps)$/i;
const MAX_FILES = 150;
const MAX_FILE = 5 * 1024 * 1024;
const MAX_TOTAL = 25 * 1024 * 1024;
export function safePath(path: string): boolean {
  return path.length <= 260 && !path.startsWith('/') && !path.includes('\\')
    && !path.split('/').some(p => p === '..' || p === '' || p === '.' || (p.startsWith('.') && p !== '.keep'))
    && !/^[A-Za-z]:/.test(path);
}
function toBase64(data: Uint8Array): string {
  let s = ''; const n = 8192;
  for (let i = 0; i < data.length; i += n) s += String.fromCharCode(...data.slice(i, i + n));
  return btoa(s);
}
function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  const raw = atob(s);
  return Uint8Array.from(raw, ch => ch.charCodeAt(0));
}
export async function importProjectZip(file: File): Promise<SynapseProject> {
  if (file.size > MAX_TOTAL) throw new Error('El ZIP supera el límite de 25 MB.');
  const zip = await JSZip.loadAsync(file);
  const members = Object.values(zip.files).filter(v => !v.dir && !v.name.startsWith('__MACOSX/'));
  if (members.length > MAX_FILES) throw new Error('Demasiados archivos en el ZIP.');
  let total = 0;
  const files: SynapseFile[] = [];
  for (const member of members) {
    if (!safePath(member.name) || !permitted.test(member.name)) continue;
    const size = (member as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    if (size > MAX_FILE) throw new Error('Archivo excede 5 MB: ' + member.name);
    total += size;
    if (total > MAX_TOTAL) throw new Error('El ZIP descomprimido supera 25 MB.');
    const content = binary.test(member.name)
      ? toBase64(await member.async('uint8array'))
      : await member.async('string');
    if (content.length > MAX_FILE * (binary.test(member.name) ? 1.5 : 1)) throw new Error('Archivo descomprimido excede 5 MB: '+ member.name);
    files.push({ path: member.name, content, encoding: binary.test(member.name) ? 'base64' : 'utf8' });
  }
  if (!files.some(f => f.path.endsWith('.tex'))) throw new Error('El archivo no contiene ningún .tex');
  const project = newProject(file.name.replace(/\.zip$/i, ''));
  project.files = files;
  project.mainFile = files.find(f => f.path === 'main.tex')?.path || files.find(f => f.path.endsWith('.tex'))!.path;
  return project;
}
export async function exportProjectZip(project: SynapseProject): Promise<void> {
  const zip = new JSZip();
  for (const f of project.files) {
    if (!safePath(f.path)) continue;
    zip.file(f.path, f.encoding === 'base64' ? fromBase64(f.content) : f.content);
  }
  const output = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(output);
  const link = document.createElement('a');
  link.href = url;
  link.download = project.name.replace(/[^a-z0-9_-]/gi, '_') + '.zip';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
