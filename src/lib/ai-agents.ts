import type { AITextEdit } from './ai-edits';

export type AIAgentMode = 'edit' | 'latex' | 'review' | 'references';

export const AGENT_MODES: { id: AIAgentMode; label: string; description: string }[] = [
  { id: 'edit', label: 'Editar', description: 'Redacción y cambios precisos en el archivo activo' },
  { id: 'latex', label: 'LaTeX', description: 'Estructura, macros y errores de compilación' },
  { id: 'review', label: 'Revisar', description: 'Coherencia científica, precisión y metodología' },
  { id: 'references', label: 'Referencias', description: 'BibTeX, citas y consistencia bibliográfica' }
];

export function isAgentMode(value: unknown): value is AIAgentMode {
  return AGENT_MODES.some(mode => mode.id === value);
}

export function agentInstructions(mode: AIAgentMode): string {
  switch (mode) {
    case 'latex':
      return 'Prioriza sintaxis LaTeX, macros, paquetes y errores concretos del registro de compilación. Corrige solo los fragmentos responsables.';
    case 'review':
      return 'Evalúa claridad, diseño de investigación, consistencia metodológica y afirmaciones; diferencia observaciones de cambios propuestos. Nunca inventes resultados.';
    case 'references':
      return 'Revisa claves de citas, entradas BibTeX y coherencia de referencias del archivo activo. No inventes DOI, artículos ni citas que no estén verificadas.';
    default:
      return 'Prioriza la edición rápida, precisa y mínima que pidió la persona. No reescribas otras partes.';
  }
}

export type QuickProposal = { content: string; edits: AITextEdit[] };

/**
 * Immediate, local and deterministic automation for a safe, common edit.
 * No model invocation, API cost or extra latency; always requires confirmation
 * through the existing reviewed diff flow in the browser.
 */
export function quickYearProposal(prompt: string, source: string, mode: AIAgentMode): QuickProposal | null {
  if (mode !== 'edit') return null;
  const request = prompt.trim().match(
    /^(?:cambia|cambiar|reemplaza|reemplazar|modifica|modificar|actualiza|actualizar)\s+(?:el\s+)?año\s+(?:de\s+)?(20\d{2})\s+(?:a|por)\s+(20\d{2})[.!]?$/i
  );
  if (!request) return null;
  const [, oldYear, newYear] = request;
  if (oldYear === newYear) return { content: 'El año indicado ya coincide con el solicitado.', edits: [] };
  const edits: AITextEdit[] = [];
  const lines = source.split('\n');
  for (const line of lines) {
    const matches = [...line.matchAll(new RegExp('(?<!\\d)' + oldYear + '(?!\\d)', 'g'))];
    if (!matches.length) continue;
    if (matches.length > 1 || line.length > 15000 ||
        source.split(line).length !== 2 || line.length < 4) {
      return null; // Let a specialist model inspect ambiguous source.
    }
    edits.push({ find: line, replace: line.replace(new RegExp('(?<!\\d)' + oldYear + '(?!\\d)'), newYear) });
    if (edits.length > 12) return null;
  }
  if (!edits.length) return {
    content: 'El año ' + oldYear + ' no aparece en el archivo activo. Selecciona el archivo que contiene la fecha.',
    edits: []
  };
  return { content: 'Encontré ' + edits.length + ' línea(s) con el año ' + oldYear + '. Revisa cada cambio a ' + newYear + ' antes de aceptarlo; ninguna línea se modificó automáticamente.', edits };
}
