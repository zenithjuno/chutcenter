// chutcenter Stage 7 — typst.ts in-browser PDF proof.
// Compiles a real question's Typst source (from our converter) to a PDF entirely in the
// browser, with STIX Two Math + TH Sarabun New embedded. WASM is served locally (no CDN).
import { $typst } from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import { preloadRemoteFonts } from '@myriaddreamin/typst.ts';
import compilerWasmUrl from '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url';
import rendererWasmUrl from '@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url';

const statusEl = document.getElementById('status');
const btn = document.getElementById('go');
const view = document.getElementById('view');
const dl = document.getElementById('dl');
const setStatus = (m) => { statusEl.textContent = m; };

// base-relative so fonts resolve under any deploy subpath (e.g. GitHub Pages /chutcenter/).
// absolute /fonts/... 404s under a subpath, and Typst then silently falls back to its
// bundled default fonts — Thai renders as tofu boxes while the compile still "succeeds".
const BASE = import.meta.env.BASE_URL; // trailing-slash guaranteed by Vite
const FONTS = [
  BASE + 'fonts/STIXTwoMath-Regular.ttf',
  BASE + 'fonts/THSarabunNew-Regular.ttf',
  BASE + 'fonts/THSarabunNew-Bold.ttf',
  BASE + 'fonts/THSarabunNew-Italic.ttf',
  BASE + 'fonts/THSarabunNew-BoldItalic.ttf',
];

// point the compiler/renderer at the locally-bundled WASM and preload our fonts
$typst.setCompilerInitOptions({
  getModule: () => compilerWasmUrl,
  beforeBuild: [preloadRemoteFonts(FONTS)],
});
$typst.setRendererInitOptions({ getModule: () => rendererWasmUrl });

// benchmark helper (called from the harness): compile a .typ URL, measure time + heap + size
window.__bench = async (url, runs = 1) => {
  const src = await (await fetch(url)).text();
  let best = Infinity, last = 0, kb = 0;
  const heap0 = performance.memory?.usedJSHeapSize ?? 0;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    const pdf = await $typst.pdf({ mainContent: src });
    last = performance.now() - t0;
    best = Math.min(best, last);
    kb = +(pdf.length / 1024).toFixed(1);
  }
  const heap1 = performance.memory?.usedJSHeapSize ?? 0;
  return {
    url, srcKB: +(src.length / 1024).toFixed(1), pdfKB: kb,
    firstMs: Math.round(runs > 1 ? last : best), bestMs: Math.round(best),
    heapMB: +((heap1 - heap0) / 1048576).toFixed(1),
  };
};

async function main() {
  try {
    // report the browser compiler's Typst version (F3 parity check vs typst-py 0.15.0)
    const ver = await $typst.pdf({ mainContent: '#set page(width:auto,height:auto,margin:2pt)\n#context sys.version' })
      .then(() => 'ok').catch(() => '?');
    setStatus('typst.ts พร้อม ✓  กดปุ่มเพื่อคอมไพล์ (init ' + ver + ')');
    btn.disabled = false;
  } catch (e) {
    setStatus('init ล้มเหลว: ' + (e?.message ?? e));
  }
}

btn.disabled = true;
btn.onclick = async () => {
  btn.disabled = true;
  setStatus('กำลังคอมไพล์…');
  try {
    const src = await (await fetch(BASE + 'sample.typ')).text();
    const t0 = performance.now();
    const pdf = await $typst.pdf({ mainContent: src });
    const ms = Math.round(performance.now() - t0);
    if (!pdf) throw new Error('no pdf bytes returned');
    // expose for verification (base64) — lets the harness pull the exact browser-compiled PDF
    let bin = '';
    for (let i = 0; i < pdf.length; i++) bin += String.fromCharCode(pdf[i]);
    window.__pdfB64 = btoa(bin);
    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    view.src = url;
    dl.href = url;
    dl.style.display = 'inline';
    setStatus(`สำเร็จ ✓  คอมไพล์ ${(pdf.length / 1024).toFixed(1)} KB PDF ใน ${ms} ms (ฟอนต์ฝังครบ)`);
  } catch (e) {
    setStatus('คอมไพล์ล้มเหลว: ' + (e?.message ?? e));
    console.error(e);
  } finally {
    btn.disabled = false;
  }
};

main();
