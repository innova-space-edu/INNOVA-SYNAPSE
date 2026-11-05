'use client';
import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';

type Props = { value: string; onChange: (value: string) => void; editable: boolean };

export function LatexCodeEditor({ value, onChange, editable }: Props) {
  const extensions = useMemo(() => [StreamLanguage.define(stex)], []);
  return <CodeMirror
    value={value}
    height="100%"
    theme="dark"
    editable={editable}
    extensions={extensions}
    onChange={onChange}
    basicSetup={{
      lineNumbers: true, foldGutter: true, highlightActiveLine: true,
      bracketMatching: true, closeBrackets: true
    }}
  />;
}
