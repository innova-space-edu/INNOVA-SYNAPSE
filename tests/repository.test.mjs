import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
test('no embedded API credentials in example environment', () => {
  const file = readFileSync('.env.example','utf8');
  assert.match(file, /OPENAI_API_KEY=\n/);
  assert.match(file, /LATEX_COMPILER_TOKEN=replace-with-long-random-token/);
});
test('compiler Docker Compose is not directly published', () => {
  const file = readFileSync('docker-compose.yml','utf8');
  const compiler = file.split('  compiler:')[1];
  assert.ok(compiler);
  assert.doesNotMatch(compiler, /\n    ports:/);
  assert.match(compiler, /read_only: true/);
});
