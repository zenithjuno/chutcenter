// chutcenter Stage 8 — filter UI over the L2 bank.
// Loads manifest + every bank file, then counts matches live in the browser
// (the independent counter, F4). Full in-browser PDF generation is Stage 9;
// here the "generate" button previews the matched question list as proof.
import { loadBank } from './src/loadBank.js';
import { filterQuestions } from './src/filter.js';

const $ = (id) => document.getElementById(id);
const topicSel = $('topic');
const sourceSel = $('source');
const yearFromSel = $('yearFrom');
const yearToSel = $('yearTo');
const countEl = $('count');
const goBtn = $('go');
const resultsEl = $('results');

const opt = (value, label) => {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  return o;
};

let bank = [];
let topicName = {}; // slug -> Thai name

function currentCriteria() {
  return {
    topic: topicSel.value,
    source: sourceSel.value,
    yearFrom: Number(yearFromSel.value),
    yearTo: Number(yearToSel.value),
  };
}

function refresh() {
  // keep the range coherent: if from > to, mirror the just-changed side
  let { yearFrom, yearTo } = currentCriteria();
  if (yearFrom > yearTo) {
    // snap the other dropdown so the range is never inverted
    if (document.activeElement === yearFromSel) yearToSel.value = String(yearFrom);
    else yearFromSel.value = String(yearTo);
  }
  const c = currentCriteria();
  const matches = filterQuestions(bank, c);
  countEl.textContent = `พบ ${matches.length} ข้อ`;
  goBtn.disabled = matches.length === 0;
  resultsEl.innerHTML = '';
  return matches;
}

function showMatches(matches) {
  if (matches.length === 0) {
    resultsEl.textContent = 'ไม่มีข้อที่ตรงเงื่อนไข';
    return;
  }
  const rows = matches
    .map(
      (q) =>
        `<tr><td>${q.year_be}</td><td>${q.number}</td><td>${topicName[q.topic_slug] ?? q.topic_slug}</td><td>${q.id}</td></tr>`,
    )
    .join('');
  resultsEl.innerHTML = `<div>ชุดที่จะสร้าง (${matches.length} ข้อ) — การสร้าง PDF จริงเป็นขั้นถัดไป (Stage 9):</div>
    <table><thead><tr><th>ปี</th><th>ข้อ</th><th>เรื่อง</th><th>รหัส</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function main() {
  const { manifest, bank: loaded } = await loadBank();
  bank = loaded;

  // topic dropdown: ทุกเรื่อง + every topic in the manifest
  topicSel.appendChild(opt('all', 'ทุกเรื่อง'));
  for (const t of manifest.topics) {
    topicName[t.slug] = t.name_th;
    topicSel.appendChild(opt(t.slug, t.name_th));
  }

  // source dropdown: ทุกแหล่ง + every source
  sourceSel.appendChild(opt('all', 'ทุกแหล่ง'));
  for (const s of manifest.sources) sourceSel.appendChild(opt(s.slug, s.name_th));

  // year range: full contiguous span so a range crossing the void years
  // (2562–2564) is selectable; those years simply contribute zero.
  const years = manifest.collections.map((c) => c.year_be);
  const minY = Math.min(...years);
  const maxY = Math.max(...years);
  for (let y = minY; y <= maxY; y++) {
    yearFromSel.appendChild(opt(String(y), String(y)));
    yearToSel.appendChild(opt(String(y), String(y)));
  }
  yearFromSel.value = String(minY);
  yearToSel.value = String(maxY);

  for (const el of [topicSel, sourceSel, yearFromSel, yearToSel]) el.addEventListener('change', refresh);
  goBtn.addEventListener('click', () => showMatches(refresh()));

  refresh();
}

main().catch((e) => {
  countEl.textContent = 'โหลดคลังไม่สำเร็จ: ' + (e?.message ?? e);
  console.error(e);
});
