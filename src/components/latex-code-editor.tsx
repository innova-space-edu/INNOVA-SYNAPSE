'use client';
import { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { type Range } from '@codemirror/state';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import type { AITextEdit } from '@/lib/ai-edits';

const NO_EDITS: AITextEdit[] = [];

// CodeMirror must measure and scroll its own scrollDOM, not a flex parent.
// Keep this theme stable across React renders to preserve scrollTop.
const scrollTheme = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': { overflow: 'auto', overflowAnchor: 'none' }
});

type Props = {
  value: string;
  onChange: (value: string) => void;
  editable: boolean;
  reviewEdits?: AITextEdit[];
};

/** A visual addition, not part of the document until the user accepts. */
class ProposedReplacement extends WidgetType {
  constructor(readonly replacement: string) { super(); }
  eq(other: ProposedReplacement) { return this.replacement === other.replacement; }
  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-ai-addition';
    container.setAttribute('aria-label', 'Texto propuesto por el asistente, pendiente de aprobación');
    const label = document.createElement('span');
    label.className = 'cm-ai-addition-label';
    label.textContent = '+ PROPUESTO';
    const code = document.createElement('pre');
    code.textContent = this.replacement || '(eliminar fragmento)';
    container.append(label, code);
    return container;
  }
  ignoreEvent() { return true; }
}

/** Visual-only diff markers; original text is never changed by this extension. */
function proposedDecorations(value: string, edits: AITextEdit[]): Range<Decoration>[] {
  const ranges: Range<Decoration>[] = [];
  for (const edit of edits) {
    if (!edit.find) continue;
    const from = value.indexOf(edit.find);
    if (from < 0 || value.indexOf(edit.find, from + edit.find.length) >= 0) continue;
    const to = from + edit.find.length;
    ranges.push(Decoration.mark({ class: 'cm-ai-removal' }).range(from, to));
    // Block widgets are anchored at the next line boundary, never mid-line.
    const nextNewline = value.indexOf('\n', to);
    const lineEnd = nextNewline < 0 ? value.length : nextNewline;
    ranges.push(Decoration.widget({
      widget: new ProposedReplacement(edit.replace), side: 1, block: true
    }).range(lineEnd));
  }
  return ranges;
}

export function LatexCodeEditor({ value, onChange, editable, reviewEdits = NO_EDITS }: Props) {
  const editorView = useRef<EditorView | null>(null);
  const syntax = useMemo(() => StreamLanguage.define(stex), []);
  // Stable decorations for ordinary typing: only reconfigure CodeMirror
  // when there is an active review or its reviewed source actually changes.
  const reviewed = reviewEdits.length ? reviewEdits : NO_EDITS;
  const reviewSource = reviewed.length ? value : '';
  const visualDiff = useMemo(() => EditorView.decorations.of(
    Decoration.set(proposedDecorations(reviewSource, reviewed), true)
  ), [reviewSource, reviewed]);
  const extensions = useMemo(() => [syntax, scrollTheme, visualDiff], [syntax, visualDiff]);

  useEffect(() => {
    if (!reviewed.length || !editorView.current) return;
    const first = reviewSource.indexOf(reviewed[0].find);
    if (first < 0) return;
    editorView.current.dispatch({
      effects: EditorView.scrollIntoView(first, { y: 'center' })
    });
  }, [reviewed, reviewSource]);

  return <CodeMirror
    value={value}
    height="100%"
    theme="dark"
    editable={editable}
    extensions={extensions}
    onCreateEditor={(view) => { editorView.current = view; }}
    onChange={onChange}
    basicSetup={{
      lineNumbers: true, foldGutter: true, highlightActiveLine: true,
      bracketMatching: true, closeBrackets: true
    }}
  />;
}
