import type { SynapseProject } from '../types';

const filePattern = /\.(tex|bib|sty|cls|bst|png|jpe?g|pdf|eps|txt|keep)$/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validUuid(value: string): boolean { return uuidPattern.test(value); }
function validFile(path: string): boolean {
  return path.length > 0 && path.length <= 260 && !path.startsWith('/') && !path.includes('\\') &&
    path.split('/').every(piece => piece && piece !== '.' && piece !== '..' && (!piece.startsWith('.') || piece === '.keep')) &&
    filePattern.test(path);
}
export function parseProject(value: unknown): SynapseProject {
  if (!value || typeof value !== 'object') throw new Error('Proyecto inválido');
  const p = value as Partial<SynapseProject>;
  if (typeof p.id !== 'string' || !validUuid(p.id) || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 200 ||
      typeof p.mainFile !== 'string' || !Array.isArray(p.files) || p.files.length > 150 || p.files.length < 1 ||
      typeof p.createdAt !== 'string' || typeof p.updatedAt !== 'string' ||
      p.files.some(f => !f || !validFile(f.path) || typeof f.content !== 'string' || f.content.length > 8_000_000 ||
        !['utf8','base64'].includes(f.encoding)) ||
      !p.files.some(f => f.path === p.mainFile && f.path.endsWith('.tex')) ||
      (p.lastPdf !== undefined && (typeof p.lastPdf !== 'string' || p.lastPdf.length > 22_000_000)) ||
      (p.lastLog !== undefined && (typeof p.lastLog !== 'string' || p.lastLog.length > 50_000)) ||
      (p.chats !== undefined && (!Array.isArray(p.chats) || p.chats.length > 100 ||
        p.chats.some(m => !['user','assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 32_000)))
  ) throw new Error('El proyecto tiene campos no válidos o excede los límites permitidos');
  return p as SynapseProject;
}
