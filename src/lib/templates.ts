import type { SynapseProject } from './types';

export const starterTex = [
  '\\documentclass[11pt,a4paper]{article}',
  '\\usepackage[utf8]{inputenc}',
  '\\usepackage[spanish]{babel}',
  '\\usepackage{amsmath,amssymb,graphicx}',
  '\\usepackage[a4paper,margin=2.5cm]{geometry}',
  '\\title{Nuevo proyecto de investigación}',
  '\\author{INNOVA SYNAPSE}',
  '\\date{\\today}',
  '\\begin{document}',
  '\\maketitle',
  '\\begin{abstract}',
  'Escribe aquí el resumen de tu investigación.',
  '\\end{abstract}',
  '\\section{Introducción}',
  'Plantea el problema y los objetivos de la investigación.',
  '\\section{Metodología}',
  'Describe el método utilizado.',
  '\\section{Resultados}',
  'La ecuación de ejemplo es $E=mc^2$.',
  '\\section{Conclusiones}',
  'Resume los hallazgos y futuras líneas de trabajo.',
  '\\end{document}',
  ''
].join('\n');

export function newProject(name = 'Sin título'): SynapseProject {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now,
    mainFile: 'main.tex',
    files: [
      { path: 'main.tex', content: starterTex, encoding: 'utf8' },
      { path: 'referencias.bib', content: '% Referencias BibTeX\n', encoding: 'utf8' },
      { path: 'figures/.keep', content: '', encoding: 'utf8' }
    ]
  };
}
