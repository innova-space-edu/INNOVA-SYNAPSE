import { cp, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require=createRequire(import.meta.url);
const source=dirname(require.resolve('pdfjs-dist/package.json'));
const target=new URL('../public/pdfjs/',import.meta.url);
await mkdir(target,{recursive:true});
await cp(join(source,'build/pdf.worker.min.mjs'),new URL('pdf.worker.min.mjs',target));
for(const folder of ['cmaps','standard_fonts','wasm'])await cp(join(source,folder),new URL(folder,target),{recursive:true});
