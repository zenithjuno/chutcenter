// chutcenter Stage 9 — full in-browser document generation.
// filter → buildDocument (converter S4 + template S6) → typst.ts compile → PDF
// shown in-page + downloadable. WASM + fonts served locally (no CDN, offline-capable).
import { $typst } from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import { preloadRemoteFonts } from '@myriaddreamin/typst.ts';
import compilerWasmUrl from '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url';
import rendererWasmUrl from '@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url';
import { loadBank } from './src/loadBank.js';
import { filterQuestions } from './src/filter.js';
import { buildDocument } from './src/generator/template/build_document.mjs';

const BASE = import.meta.env.BASE_URL; // base-relative so assets resolve under /chutcenter/
const $ = (id) => document.getElementById(id);
const topicSel = $('topic'), sourceSel = $('source'), yearFromSel = $('yearFrom'), yearToSel = $('yearTo');
const countEl = $('count'), goBtn = $('go'), statusEl = $('status'), dl = $('dl'), view = $('view');
const setStatus = (m) => { statusEl.textContent = m; };

// ---- typst.ts: local WASM + base-relative fonts (absolute /fonts 404s under a subpath) ----
const FONTS = [
  BASE + 'fonts/STIXTwoMath-Regular.ttf',
  BASE + 'fonts/THSarabunNew-Regular.ttf',
  BASE + 'fonts/THSarabunNew-Bold.ttf',
  BASE + 'fonts/THSarabunNew-Italic.ttf',
  BASE + 'fonts/THSarabunNew-BoldItalic.ttf',
];
$typst.setCompilerInitOptions({ getModule: () => compilerWasmUrl, beforeBuild: [preloadRemoteFonts(FONTS)] });
$typst.setRendererInitOptions({ getModule: () => rendererWasmUrl });

let bank = [];
let topicName = {};
let typstReady = false;
let lastUrl = null;

const opt = (value, label) => { const o = document.createElement('option'); o.value = value; o.textContent = label; return o; };

function criteria() {
  return { topic: topicSel.value, source: sourceSel.value, yearFrom: Number(yearFromSel.value), yearTo: Number(yearToSel.value) };
}

function currentMatches() {
  // keep the range coherent (never inverted)
  if (Number(yearFromSel.value) > Number(yearToSel.value)) {
    if (document.activeElement === yearFromSel) yearToSel.value = yearFromSel.value;
    else yearFromSel.value = yearToSel.value;
  }
  return filterQuestions(bank, criteria());
}

function refresh() {
  const m = currentMatches();
  countEl.textContent = `พบ ${m.length} ข้อ`;
  goBtn.disabled = m.length === 0 || !typstReady;
  return m;
}

// ---- derive title / subtitle / filename from the selection + the actual matched years ----
function labels(matches) {
  const topicLabel = topicSel.value === 'all' ? 'รวมหลายหัวข้อ' : (topicName[topicSel.value] ?? topicSel.value);
  const years = [...new Set(matches.map((q) => q.year_be))].sort((a, b) => a - b);
  const yr = years.length === 0 ? '' : years.length === 1 ? String(years[0]) : `${years[0]}-${years[years.length - 1]}`;
  return {
    titleLine1: 'ข้อสอบสัปดาห์วิทย์ ม.น. ม.ปลาย',
    subtitleLine: `${topicLabel} · ปี ${yr}`,
    answerSlug: `${topicLabel} · ปี ${yr}`,
    filename: `chutcenter_${topicLabel}_${yr}.pdf`.replace(/\s+/g, ''),
  };
}

async function generate() {
  const matches = refresh();
  if (!matches.length || !typstReady) return;
  goBtn.disabled = true;
  setStatus(`กำลังสร้าง PDF … (${matches.length} ข้อ)`);
  // let the status paint before the (possibly heavy) compile blocks the thread
  await new Promise((r) => setTimeout(r, 30));
  try {
    const L = labels(matches);
    const src = buildDocument(matches, { titleLine1: L.titleLine1, subtitleLine: L.subtitleLine, answerSlug: L.answerSlug });
    const t0 = performance.now();
    const pdf = await $typst.pdf({ mainContent: src });
    const ms = Math.round(performance.now() - t0);
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastUrl = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
    view.src = lastUrl; view.style.display = 'block';
    dl.href = lastUrl; dl.download = L.filename; dl.style.display = 'inline';
    setStatus(`สร้างเสร็จ: ${matches.length} ข้อ · ${(pdf.length / 1048576).toFixed(2)} MB · ${ms} ms → ${L.filename}`);
  } catch (e) {
    console.error(e);
    setStatus('สร้าง PDF ไม่สำเร็จ: ' + (e?.message ?? e));
  } finally {
    goBtn.disabled = currentMatches().length === 0 || !typstReady;
  }
}

async function main() {
  const { manifest, bank: loaded } = await loadBank();
  bank = loaded;

  topicSel.appendChild(opt('all', 'ทุกเรื่อง'));
  for (const t of manifest.topics) { topicName[t.slug] = t.name_th; topicSel.appendChild(opt(t.slug, t.name_th)); }
  sourceSel.appendChild(opt('all', 'ทุกแหล่ง'));
  for (const s of manifest.sources) sourceSel.appendChild(opt(s.slug, s.name_th));
  const years = manifest.collections.map((c) => c.year_be);
  const minY = Math.min(...years), maxY = Math.max(...years);
  for (let y = minY; y <= maxY; y++) { yearFromSel.appendChild(opt(String(y), String(y))); yearToSel.appendChild(opt(String(y), String(y))); }
  yearFromSel.value = String(minY); yearToSel.value = String(maxY);

  for (const el of [topicSel, sourceSel, yearFromSel, yearToSel]) el.addEventListener('change', refresh);
  goBtn.addEventListener('click', generate);
  refresh();

  // warm up typst.ts (loads WASM); enable generate once ready
  setStatus('กำลังเตรียมตัวสร้าง PDF (โหลด typst.ts)…');
  try {
    await $typst.pdf({ mainContent: '#set page(width:auto,height:auto,margin:2pt)\nready' });
    typstReady = true;
    setStatus('พร้อมสร้าง PDF ✓');
    refresh();
  } catch (e) {
    setStatus('เตรียม typst.ts ไม่สำเร็จ: ' + (e?.message ?? e));
  }
}

main().catch((e) => { countEl.textContent = 'โหลดคลังไม่สำเร็จ: ' + (e?.message ?? e); console.error(e); });
