import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const editor = readFileSync(new URL('../src/components/latex-code-editor.tsx', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../src/components/workspace.tsx', import.meta.url), 'utf8');

test('CodeMirror is the only vertical scroll owner', () => {
  const rules = Array.from(css.matchAll(/\.editor-container \.cm-scroller\s*\{([^}]*)\}/g), match => match[1]);
  assert.ok(rules.length >= 1, 'CodeMirror requires an explicit scroller rule');
  const joined = rules.join(';');
  assert.match(joined, /overflow-y:auto!important/);
  assert.match(joined, /overflow-anchor:none/);
  for (const [index, rule] of rules.entries()) {
    assert.doesNotMatch(rule, /(?:^|;)\s*(?:display|height|max-height|min-height|flex|flex-grow|flex-shrink|flex-basis|flex-direction)\s*:/,
      'rule ' + index + ' must not override CodeMirror internal scroll geometry');
  }
  assert.doesNotMatch(css, /\.editor-container \.cm-content\{[^}]*min-width:max-content/);
  assert.doesNotMatch(css, /\.editor-container\{[^}]*padding-bottom:64px/);
});

test('editor height is bounded without nesting an extra scroll container', () => {
  assert.match(css, /\.editor-container\{height:0;min-height:0;flex:1 1 0;padding-bottom:0\}/);
  assert.match(css, /\.editor-container > \.cm-theme\{[^}]*height:100%/);
  assert.match(css, /\.editor-container \.cm-editor\{[^}]*height:100%/);
  assert.match(editor, /const scrollTheme = EditorView\.theme\(/);
  assert.match(editor, /'\.cm-scroller': \{ overflow: 'auto', overflowAnchor: 'none' \}/);
});

test('ordinary updates preserve scroll theme and switching file isolates view state', () => {
  assert.match(editor, /const extensions = useMemo\(\(\) => \[syntax, scrollTheme, visualDiff\]/);
  assert.match(workspace, /<LatexCodeEditor key=\{activeFile\} value=\{active\.content\}/);
  assert.doesNotMatch(editor, /onWheel=\{/);
});
