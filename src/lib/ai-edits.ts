export type AITextEdit = { find: string; replace: string };

const MAX_EDITS = 12;
const MAX_FRAGMENT = 16000;

/** Return a short, deterministic fingerprint so an old proposal cannot edit newer text. */
export function sourceFingerprint(source: string): string {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0') + ':' + source.length;
}

export function isAITextEdit(value: unknown): value is AITextEdit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const edit = value as Record<string, unknown>;
  return typeof edit.find === 'string' && edit.find.length >= 4 &&
    edit.find.length <= MAX_FRAGMENT &&
    typeof edit.replace === 'string' && edit.replace.length <= MAX_FRAGMENT &&
    edit.find !== edit.replace;
}

export function sanitizeAITextEdits(value: unknown): AITextEdit[] {
  if (!Array.isArray(value) || value.length > MAX_EDITS) return [];
  return value.every(isAITextEdit) ? value : [];
}

export function applyAITextEdits(source: string, edits: AITextEdit[]): string {
  if (!Array.isArray(edits) || edits.length === 0 || edits.length > MAX_EDITS ||
      !edits.every(isAITextEdit)) {
    throw new Error('La propuesta de edición no tiene un formato válido.');
  }
  let result = source;
  for (const [index, edit] of edits.entries()) {
    const offset = result.indexOf(edit.find);
    if (offset < 0) {
      throw new Error('La modificación ' + (index + 1) + ' no coincide con el archivo actual. Solicita una nueva propuesta.');
    }
    if (result.indexOf(edit.find, offset + edit.find.length) >= 0) {
      throw new Error('La modificación ' + (index + 1) + ' coincide con varios fragmentos. No se aplicó ningún cambio.');
    }
    result = result.slice(0, offset) + edit.replace + result.slice(offset + edit.find.length);
    if (result.length > 8_000_000) throw new Error('La edición supera el tamaño admitido para un archivo.');
  }
  if (result === source) throw new Error('La propuesta no produce cambios en el documento.');
  return result;
}

/** LLM output is untrusted. For non-JSON responses, keep normal Q&A behavior. */
export function parseAIEditResponse(value: unknown): { content: string; edits: AITextEdit[] } {
  if (typeof value !== 'string') return { content: 'El modelo no devolvió texto.', edits: [] };
  const trimmed = value.trim();
  const fenced = trimmed.match(/^\x60\x60\x60(?:json)?\s*\n([\s\S]*?)\n\x60\x60\x60$/i);
  const json = fenced?.[1] || trimmed;
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      const content = typeof obj.message === 'string' ? obj.message.slice(0, 12000) :
        typeof obj.content === 'string' ? obj.content.slice(0, 12000) : '';
      const edits = sanitizeAITextEdits(obj.edits);
      return { content: content || (edits.length ? 'Propuesta de cambios para el archivo activo.' : 'Sin cambios propuestos.'), edits };
    }
  } catch { /* Provider returned an ordinary conversational answer. */ }
  return { content: value.slice(0, 12000), edits: [] };
}
