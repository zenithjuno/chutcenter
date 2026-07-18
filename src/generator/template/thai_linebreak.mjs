// chutcenter — Thai line-break injector (Stage 5).
//
// Thai has no spaces between words, so XeLaTeX cannot find line-break points inside a long
// Thai run → the text overflows the right margin. The trimmed BusyTeX bundle ships no ICU
// Thai dictionary, so we can't lean on \XeTeXlinebreaklocale. Instead we insert a zero-width
// break opportunity (U+200B) between Thai words here, in JS, using Intl.Segmenter('th').
//
// This runs OUTSIDE convParts (the converter golden stays byte-for-byte clean): buildDocument
// applies it to the parts just before conversion. escText passes U+200B through untouched, and
// the preamble makes U+200B an active char = \discretionary{}{}{} (a breakpoint that adds
// nothing and no hyphen when the line breaks). Toggle with LATEX_DOC_CONFIG.thaiBreak.enabled.

const ZWSP = "\u200B";
const THAI = /[\u0E00-\u0E7F]/; // Thai block; gate breaks to Thai↔Thai boundaries only

// Insert U+200B between adjacent Thai words. A break is added at a segment boundary only when
// the char on BOTH sides is Thai — never inside a word, and never around Latin/digits/space
// (those already break, or must not). Idempotent: existing U+200B are stripped first.
export function breakThaiText(text, cfg = {}) {
  const s = String(text ?? "");
  if (!s || !THAI.test(s)) return s;
  const locale = cfg?.locale || "th";
  let seg;
  try {
    seg = new Intl.Segmenter(locale, { granularity: "word" });
  } catch (e) {
    return s; // no Intl.Segmenter → leave text as-is (loud-free degrade)
  }
  const parts = [...seg.segment(s.split(ZWSP).join(""))].map((x) => x.segment);
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) {
      const prev = parts[i - 1];
      const a = prev[prev.length - 1];
      const b = parts[i][0];
      if (THAI.test(a) && THAI.test(b)) out += ZWSP;
    }
    out += parts[i];
  }
  return out;
}

// Return a shallow-copied parts array with every text part's Thai runs broken. Only touches
// plain text (type:'text' and bare strings) — math parts and everything else pass through
// unchanged, and the input array/objects are not mutated (bank data is shared).
export function injectThaiBreaks(parts, cfg = {}) {
  if (!Array.isArray(parts)) return parts;
  return parts.map((p) => {
    if (typeof p === "string") return breakThaiText(p, cfg);
    if (p && p.type === "text") return { ...p, text: breakThaiText(p.text ?? "", cfg) };
    return p;
  });
}
