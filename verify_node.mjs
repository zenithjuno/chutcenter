// Stage 7 verification (headless) — compile with the SAME typst.ts WASM the browser uses,
// so we can (a) read the bundled Typst compiler version (F3 parity vs typst-py 0.15.0) and
// (b) save the PDF to disk for a pixel comparison against the typst-py offline render.
import { createTypstCompiler } from '@myriaddreamin/typst.ts/compiler';
import { preloadRemoteFonts } from '@myriaddreamin/typst.ts';
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = process.argv[2] || '.';

const wasm = readFileSync('node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm');
const fontFiles = [
  'public/fonts/STIXTwoMath-Regular.ttf',
  'public/fonts/THSarabunNew-Regular.ttf',
  'public/fonts/THSarabunNew-Bold.ttf',
  'public/fonts/THSarabunNew-Italic.ttf',
  'public/fonts/THSarabunNew-BoldItalic.ttf',
];
const fonts = fontFiles.map((f) => new Uint8Array(readFileSync(f)));

const c = createTypstCompiler();
await c.init({ getModule: () => wasm, beforeBuild: [preloadRemoteFonts(fonts)] });

// (a) compiler version
c.addSource('/v.typ', '#set page(width: auto, height: auto, margin: 2pt)\n#context [typstver=#sys.version]');
const vres = await c.compile({ mainFilePath: '/v.typ', format: 'pdf' });
writeFileSync(OUT + '/ver.pdf', vres.result ?? new Uint8Array());

// (b) the real sample
const src = readFileSync('public/sample.typ', 'utf-8');
c.addSource('/main.typ', src);
const res = await c.compile({ mainFilePath: '/main.typ', format: 'pdf' });
if (!res.result) {
  console.error('COMPILE FAILED', JSON.stringify(res.diagnostics ?? res).slice(0, 400));
  process.exit(1);
}
writeFileSync(OUT + '/typstts_sample.pdf', res.result);
console.log('OK typst.ts(node) sample.pdf bytes =', res.result.length);
