// chutcenter LaTeX migration — Stage 3 benchmark: LaTeX (BusyTeX) vs Typst, head to head.
//
// Proves the three Stage-3 gates and adds the owner-requested Typst comparison:
//   1) mount-once reuse   — compile the same doc 3× in a row; 2nd/3rd not paying a re-mount.
//   2) warm-up + per-compile timings at 3 document sizes, LaTeX vs Typst on IDENTICAL content.
//   3) reload cache-hit   — after one run the wasm+pack are in IndexedDB; reload → hit=true.
//
// This is a measurement/verification page, NOT the product. main.js (the live app) is
// untouched — the compile-seam swap is Stage 4.
import { $typst } from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import { preloadRemoteFonts } from '@myriaddreamin/typst.ts';
import compilerWasmUrl from '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url';
import rendererWasmUrl from '@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url';
import { loadBank } from '../loadBank.js';
import { buildDocument } from '../generator/template/build_document.mjs';
import { buildDocumentLatex } from '../generator/template/build_document_latex.mjs';
import { LatexCompiler } from './latex_compiler.js';

const BASE = import.meta.env.BASE_URL;
const $ = (id) => document.getElementById(id);
const log = (m) => { $('log').textContent += m + '\n'; };
const fmt = (ms) => `${Math.round(ms)} ms`;

const FONTS = [
  BASE + 'fonts/STIXTwoMath-Regular.ttf',
  BASE + 'fonts/THSarabunNew-Regular.ttf',
  BASE + 'fonts/THSarabunNew-Bold.ttf',
  BASE + 'fonts/THSarabunNew-Italic.ttf',
  BASE + 'fonts/THSarabunNew-BoldItalic.ttf',
];
$typst.setCompilerInitOptions({ getModule: () => compilerWasmUrl, beforeBuild: [preloadRemoteFonts(FONTS)] });
$typst.setRendererInitOptions({ getModule: () => rendererWasmUrl });

function labelsFor(qs) {
  const years = [...new Set(qs.map((q) => q.year_be))].sort((a, b) => a - b);
  const yr = years.length ? (years.length === 1 ? String(years[0]) : `${years[0]}-${years[years.length - 1]}`) : '';
  return { titleLine1: 'ข้อสอบสัปดาห์วิทย์ ม.น. ม.ปลาย', subtitleLine: `เทียบ engine · ปี ${yr}`, answerSlug: `เทียบ engine · ปี ${yr}` };
}

function show(iframeId, pdf) {
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  $(iframeId).src = url;
}

async function run() {
  $('run').disabled = true;
  $('log').textContent = '';
  const rows = $('rows'); rows.innerHTML = '';

  const { bank } = await loadBank();
  const sizes = [2, 30, bank.length].filter((n, i, a) => n > 0 && a.indexOf(n) === i);
  log(`คลังโหลดแล้ว: ${bank.length} ข้อ · จะทดสอบขนาด: ${sizes.join(', ')} ข้อ\n`);

  // Pre-build both engines' sources for each size (build time is negligible, excluded from compile timing).
  const docs = sizes.map((n) => {
    const qs = bank.slice(0, n);
    const L = labelsFor(qs);
    return { n, tex: buildDocumentLatex(qs, L), typ: buildDocument(qs, L) };
  });

  // ---------- LaTeX warm-up (init = download/cache + mount texmf once) ----------
  const latex = new LatexCompiler();
  let t0 = performance.now();
  await latex.init();
  const latexWarm = performance.now() - t0;
  const hit = latex.lastCacheHits;
  log(`LaTeX warm-up (init + mount): ${fmt(latexWarm)}`);
  log(`  cache: wasm ${hit.wasm ? 'HIT ✓ (ไม่โหลดซ้ำ)' : 'miss (โหลด+เก็บลง cache)'} · pack ${hit.pack ? 'HIT ✓' : 'miss'}`);
  $('cacheNote').textContent = (hit.wasm && hit.pack)
    ? 'cache HIT ✓ — เปิดครั้งนี้ไม่ดาวน์โหลด engine ซ้ำ (อ่านจาก IndexedDB)'
    : 'cache miss — โหลด engine ครั้งแรกแล้วเก็บไว้ · กด "รีโหลดหน้า" แล้วรันซ้ำเพื่อดู cache HIT';

  // ---------- Typst warm-up ----------
  t0 = performance.now();
  await $typst.pdf({ mainContent: '#set page(width:auto,height:auto,margin:2pt)\nready' });
  const typstWarm = performance.now() - t0;
  log(`Typst warm-up: ${fmt(typstWarm)}\n`);

  // ---------- prime the WASM engines to steady state ----------
  // The first few BusyTeX compiles are slow while V8 JITs the wasm; they settle after a
  // handful of runs, regardless of doc size. Prime with the mid doc so the measured table
  // below reflects STEADY-STATE speed (what a user gets from the 2nd document onward), not
  // one-time JIT ramp. The priming times also prove mount-once reuse: they don't grow.
  const mid = docs.find((d) => d.n === 30) || docs[0];
  const prime = [];
  for (let i = 0; i < 4; i++) { const r = await latex.compile(mid.tex); prime.push(r.ms); }
  for (let i = 0; i < 2; i++) { await $typst.pdf({ mainContent: mid.typ }); }
  log(`LaTeX warm-up ramp (${mid.n} ข้อ ×4): ${prime.map(fmt).join('  →  ')}`);
  log(`  ${prime[3] <= prime[0] ? '✓ เร็วขึ้นเรื่อย ๆ แล้วนิ่ง → mount ครั้งเดียว + reuse ได้ผล' : '⚠ ไม่นิ่งลง — ตรวจ reuse'}\n`);

  // ---------- per-size head-to-head at STEADY STATE (min of 2 warm runs) ----------
  const best = async (fn) => { let m = Infinity; for (let i = 0; i < 2; i++) { const t = performance.now(); const r = await fn(); m = Math.min(m, performance.now() - t); if (i === 1) return { ms: m, out: r }; } };
  let firstShown = false;
  for (const d of docs) {
    const L = await best(() => latex.compile(d.tex));
    const T = await best(() => $typst.pdf({ mainContent: d.typ }));
    const lms = L.ms, tms = T.ms;
    const lpdf = L.out.pdf, tpdf = T.out;
    const ratio = (lms / tms).toFixed(1);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${d.n}</td>`
      + `<td class="num">${Math.round(lms)}</td>`
      + `<td class="num">${Math.round(tms)}</td>`
      + `<td class="num">${ratio}×</td>`
      + `<td class="num">${(lpdf.length / 1024).toFixed(0)}</td>`
      + `<td class="num">${(tpdf.length / 1024).toFixed(0)}</td>`;
    rows.appendChild(tr);
    log(`ขนาด ${String(d.n).padStart(4)} ข้อ (steady): LaTeX ${fmt(lms).padStart(8)} · Typst ${fmt(tms).padStart(8)} · LaTeX/Typst = ${ratio}×`);
    if (!firstShown && d.n <= 30) { show('pdfLatex', lpdf); show('pdfTypst', tpdf); firstShown = true; }
  }

  log('\nเสร็จ. ตัวเลข "steady" = ความเร็วตอน engine อุ่นแล้ว (เอกสารที่ 2 เป็นต้นไป). ดู PDF สองฝั่งเทียบหน้าตา.');
  $('run').disabled = false;
}

$('run').addEventListener('click', () => run().catch((e) => { log('\nERROR: ' + (e && e.stack || e)); $('run').disabled = false; }));
$('reload').addEventListener('click', () => location.reload());
