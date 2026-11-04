#!/usr/bin/env bash
set -euo pipefail
cd "${SYNAPSE_HOME:-/srv/intranet/synapse}"
# No API key or token is printed. The test runs only on the internal Docker network.
docker compose -f compose.intranet.yaml exec -T web node - <<'JS'
const source = "\\documentclass{article}\n\\begin{document}\nINNOVA SYNAPSE Dell smoke test.\n\\end{document}\n";
(async () => {
  const response = await fetch('http://compiler:8000/compile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.LATEX_COMPILER_TOKEN,
    },
    body: JSON.stringify({
      mainFile: 'main.tex',
      files: [{ path: 'main.tex', encoding: 'utf8', content: source }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok || !result.ok || !result.pdf?.startsWith('JVBERi0')) {
    console.error('Falló la compilación PDF de prueba:', String(result.error || result.log || response.status).slice(-1000));
    process.exit(1);
  }
  console.log('Compilación LaTeX real: PDF correcto (formato %PDF).');
})().catch((e) => {console.error('Fallo interno del compilador:', e.message); process.exit(1);});
JS
