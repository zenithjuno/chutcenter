// Stage 5 verification: compile the SAME long space-less Thai stem twice — Thai-break OFF
// (overflows the margin) vs ON (wraps, no mid-word cut) — so the difference is visible.
import { LatexCompiler } from './latex_compiler.js';
import { buildDocumentLatex } from '../generator/template/build_document_latex.mjs';
import { LATEX_DOC_CONFIG } from '../generator/template/latex_config.mjs';

const $ = (id) => document.getElementById(id);
const log = (m) => { $('log').textContent += m + '\n'; };
const cfg = (enabled) => ({ ...JSON.parse(JSON.stringify(LATEX_DOC_CONFIG)), thaiBreak: { enabled, locale: 'th' } });

// A deliberately long Thai stem with NO spaces — the worst case for line-breaking.
const longThai =
  'จงพิจารณาข้อความต่อไปนี้แล้วหาคำตอบที่ถูกต้องที่สุดโดยกำหนดให้จำนวนเต็มบวกที่น้อยที่สุดซึ่งหารด้วยเจ็ดแล้วเหลือเศษสามและหารด้วยห้าแล้วเหลือเศษสองมีค่าเท่ากับเท่าใดเมื่อพิจารณาในช่วงที่กำหนดให้อย่างรอบคอบ';
const question = [{
  year_be: 2566, number: 1, answer: '52', answer_text: 'ห้าสิบสอง',
  question: { parts: [{ type: 'text', text: longThai }], choices: [
    { label: 'ก', parts: [{ type: 'text', text: 'สี่สิบเจ็ด' }] },
    { label: 'ข', parts: [{ type: 'text', text: 'ห้าสิบสอง' }] },
  ] },
  solution_variants: [],
}];

async function run() {
  $('run').disabled = true;
  const latex = new LatexCompiler();
  log('กำลังเตรียม engine …');
  await latex.init();
  for (const [enabled, iframe, label] of [[false, 'pdfOff', 'ตัดคำ OFF (คาดว่าล้นขอบ)'], [true, 'pdfOn', 'ตัดคำ ON (ควรพอดี)']]) {
    const tex = buildDocumentLatex(question, { config: cfg(enabled) });
    log(`ZWSP ในซอร์ส (${enabled ? 'ON' : 'OFF'}): ${(tex.match(/\u200B/g) || []).length} จุด`);
    const { pdf, ms } = await latex.compile(tex);
    $(iframe).src = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
    log(`${label}: ${Math.round(ms)} ms · ${(pdf.length / 1024).toFixed(0)} KB`);
  }
  log('\nดู PDF สองฝั่ง: ซ้าย=ปิดตัดคำ (ข้อความยาวล้นขอบขวา), ขวา=เปิดตัดคำ (ตัดบรรทัดพอดี ไม่ตัดกลางคำ).');
  $('run').disabled = false;
}
$('run').addEventListener('click', () => run().catch((e) => { log('ERROR: ' + (e && e.stack || e)); $('run').disabled = false; }));
