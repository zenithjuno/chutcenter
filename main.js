// chutcenter Stage 4 — full in-browser document generation, LaTeX-default.
// filter → buildDocumentLatex → BusyTeX compile (in a worker) → PDF, shown in-page +
// downloadable. Typst is a LAZY fallback: its ~28MB chunk loads ONLY if a LaTeX compile
// fails, then we retry with Typst so the user still gets a PDF. Engine assets + fonts are
// served locally (no CDN). Live site behaviour changes only at the Stage 7 publish gate.
import { LatexCompiler } from './src/latex/latex_compiler.js';
import { buildDocumentLatex } from './src/generator/template/build_document_latex.mjs';
import { loadBank } from './src/loadBank.js';
import { filterQuestions } from './src/filter.js';

const $ = (id) => document.getElementById(id);
const topicSel = $('topic'), sourceSel = $('source'), yearFromSel = $('yearFrom'), yearToSel = $('yearTo');
const countEl = $('count'), goBtn = $('go'), statusEl = $('status'), dl = $('dl'), view = $('view');
const busyEl = $('busy'), noteEl = $('note');
const setStatus = (m) => { statusEl.textContent = m; };
const setBusy = (busy, m) => { busyEl.classList.toggle('on', busy); if (m !== undefined) statusEl.textContent = m; };
const setNote = (m) => { noteEl.textContent = m ?? ''; };

// ---- engine flag (debug): ?engine=typst forces the fallback; ?engine=fail makes LaTeX
//      throw so the fallback path can be demoed; default = latex. ----
const ENGINE = new URLSearchParams(location.search).get('engine') || 'latex';

let bank = [];
let topicName = {};
let lastUrl = null;

// The LaTeX engine and a promise that resolves once it is warmed up (mounted + primed to
// steady state). generate() awaits this so a click during warm-up just waits, never errors.
const latex = new LatexCompiler();
let engineReady = false;
let readyResolve, readyReject;
const ready = new Promise((res, rej) => { readyResolve = res; readyReject = rej; });

const opt = (value, label) => { const o = document.createElement('option'); o.value = value; o.textContent = label; return o; };

function criteria() {
  return { topic: topicSel.value, source: sourceSel.value, yearFrom: Number(yearFromSel.value), yearTo: Number(yearToSel.value) };
}

function currentMatches() {
  if (Number(yearFromSel.value) > Number(yearToSel.value)) {
    if (document.activeElement === yearFromSel) yearToSel.value = yearFromSel.value;
    else yearFromSel.value = yearToSel.value;
  }
  return filterQuestions(bank, criteria());
}

function refresh() {
  const m = currentMatches();
  countEl.textContent = `พบ ${m.length} ข้อ`;
  goBtn.disabled = m.length === 0 || !engineReady;
  return m;
}

function labels(matches) {
  const topicLabel = topicSel.value === 'all' ? 'รวมหลายหัวข้อ' : (topicName[topicSel.value] ?? topicSel.value);
  const years = [...new Set(matches.map((q) => q.year_be))].sort((a, b) => a - b);
  const yr = years.length === 0 ? '' : years.length === 1 ? String(years[0]) : `${years[0]}-${years[years.length - 1]}`;
  return {
    titleLine1: 'ข้อสอบสัปดาห์วิทย์ ม.น. ม.ปลาย',
    subtitleLine: `${topicLabel} · ปี ${yr}`,
    answerSlug: `${topicLabel} · ปี ${yr}`,
    topicLabel,
    filename: `chutcenter_${topicLabel}_${yr}.pdf`.replace(/\s+/g, ''),
  };
}

// Compile via LaTeX; on ANY LaTeX failure, lazy-load Typst and retry so the user still gets
// a PDF. Returns { pdf, engine } where engine is 'latex' | 'typst'. `?engine=typst` skips
// straight to the fallback; `?engine=fail` forces the LaTeX attempt to throw (demo).
async function compilePdf(matches, L) {
  if (ENGINE !== 'typst') {
    try {
      if (ENGINE === 'fail') throw new Error('forced LaTeX failure (?engine=fail)');
      const src = buildDocumentLatex(matches, { titleLine1: L.titleLine1, subtitleLine: L.subtitleLine, answerSlug: L.answerSlug, topicLabel: L.topicLabel });
      const { pdf } = await latex.compile(src);
      return { pdf, engine: 'latex' };
    } catch (e) {
      console.warn('LaTeX compile failed, falling back to Typst:', e);
      setNote('ตัวสร้างหลักมีปัญหา กำลังใช้ตัวสำรอง (Typst) …');
    }
  }
  const { compileTypst } = await import('./src/typst_fallback.js'); // lazy — heavy chunk
  const pdf = await compileTypst(matches, { titleLine1: L.titleLine1, subtitleLine: L.subtitleLine, answerSlug: L.answerSlug });
  return { pdf, engine: 'typst' };
}

async function generate() {
  const matches = refresh();
  if (!matches.length) return;
  goBtn.disabled = true;
  if (!engineReady) {
    setBusy(true, 'กำลังเตรียมตัวสร้าง PDF ครั้งแรก … รอสักครู่');
    try { await ready; } catch (e) { /* warm-up failed → compilePdf will fall back to Typst */ }
  }
  setBusy(true, `กำลังสร้าง PDF … (${matches.length} ข้อ)`);
  await new Promise((r) => setTimeout(r, 30)); // let the spinner paint
  try {
    const L = labels(matches);
    const t0 = performance.now();
    const { pdf, engine } = await compilePdf(matches, L);
    const ms = Math.round(performance.now() - t0);
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastUrl = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
    view.src = lastUrl; view.style.display = 'block';
    dl.href = lastUrl; dl.download = L.filename; dl.style.display = 'inline';
    setNote('');
    setBusy(false, `สร้างเสร็จ: ${matches.length} ข้อ · ${(pdf.length / 1048576).toFixed(2)} MB · ${ms} ms${engine === 'typst' ? ' · (ตัวสำรอง Typst)' : ''} → ${L.filename}`);
  } catch (e) {
    console.error(e);
    setNote('');
    setBusy(false, 'สร้าง PDF ไม่สำเร็จ ลองใหม่อีกครั้ง หรือลดจำนวนข้อลง (รายละเอียด: ' + (e?.message ?? e) + ')');
  } finally {
    goBtn.disabled = currentMatches().length === 0 || !engineReady;
  }
}

// Warm the LaTeX engine in the background right after load: init (mount) + a couple of
// throwaway compiles to get past the WASM JIT ramp, so the user's first real PDF is ~0.8s
// instead of ~10s. The loading line tells them what's happening (never looks frozen).
async function prewarm() {
  if (ENGINE === 'typst') { engineReady = true; readyResolve(); setBusy(false, 'พร้อมสร้าง PDF ✓ (โหมด Typst)'); refresh(); return; }
  setBusy(true, 'กำลังเตรียมตัวสร้าง PDF …');
  setNote('ครั้งแรกเตรียมตัวสร้างสักครู่ (โหลด ~53MB ครั้งเดียว แล้วเบราว์เซอร์จำไว้) — เปิดครั้งต่อไปเร็ว');
  try {
    await latex.init();
    // prime to steady state with a tiny real doc (first 1–2 questions)
    const primeDoc = buildDocumentLatex(bank.slice(0, Math.min(2, bank.length)), labels(bank.slice(0, 2)));
    for (let i = 0; i < 2; i++) { try { await latex.compile(primeDoc); } catch (e) { /* JIT ramp; ignore */ } }
    engineReady = true;
    readyResolve();
    setBusy(false, 'พร้อมสร้าง PDF ✓');
    setNote('');
    refresh();
  } catch (e) {
    // Engine could not warm up. Don't hard-fail: let generate() fall back to Typst on demand.
    console.error('LaTeX warm-up failed:', e);
    engineReady = true; // enable the button; compilePdf will use the Typst fallback
    readyResolve();
    setBusy(false, 'พร้อมสร้าง PDF ✓ (จะใช้ตัวสำรองหากจำเป็น)');
    setNote('');
    refresh();
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

  prewarm(); // background — do not await; the UI is usable while it warms
}

main().catch((e) => { countEl.textContent = 'โหลดคลังไม่สำเร็จ: ' + (e?.message ?? e); console.error(e); });
