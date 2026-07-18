// chutcenter LaTeX migration — Stage 4 lazy Typst fallback.
//
// This whole module (typst.ts runtime + its ~28MB compiler wasm + the Typst document
// builder) is loaded ONLY via dynamic import() from main.js, and only when a LaTeX compile
// fails. Keeping the heavy wasm imports here is what keeps them OUT of the first-load graph:
// Vite code-splits this into its own chunk that the default (LaTeX) path never touches.
import { $typst } from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import { preloadRemoteFonts } from '@myriaddreamin/typst.ts';
import compilerWasmUrl from '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url';
import rendererWasmUrl from '@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url';
import { buildDocument } from './generator/template/build_document.mjs';

const BASE = import.meta.env.BASE_URL;
const FONTS = [
  BASE + 'fonts/STIXTwoMath-Regular.ttf',
  BASE + 'fonts/THSarabunNew-Regular.ttf',
  BASE + 'fonts/THSarabunNew-Bold.ttf',
  BASE + 'fonts/THSarabunNew-Italic.ttf',
  BASE + 'fonts/THSarabunNew-BoldItalic.ttf',
];

let inited = false;
function ensureInit() {
  if (inited) return;
  $typst.setCompilerInitOptions({ getModule: () => compilerWasmUrl, beforeBuild: [preloadRemoteFonts(FONTS)] });
  $typst.setRendererInitOptions({ getModule: () => rendererWasmUrl });
  inited = true;
}

// Same (questions, labels) seam as the LaTeX path — the builder lives here so the Typst
// document assembler is part of the lazy chunk too.
export async function compileTypst(questions, labels) {
  ensureInit();
  const src = buildDocument(questions, labels);
  return $typst.pdf({ mainContent: src }); // Uint8Array
}
