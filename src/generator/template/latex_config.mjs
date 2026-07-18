// chutcenter — LaTeX (XeLaTeX) template config + preamble builder.
//
// Sibling of doc_config.mjs (the Typst template config). Holds EVERY preamble / font /
// size / spacing / layout value for the LaTeX engine in ONE place, plus a preamble()
// builder. The converter (parts_to_latex.mjs) turns math AST -> LaTeX; THIS + the
// build_document_latex assembler turn config + L2 questions -> a full document.
//
// ⚙️  Preference work is ongoing — tune by editing LATEX_DOC_CONFIG. Every knob is
// documented and safe to change alone.
//
// SIZING MODEL (calibrated 2026-07-13 vs the release, Cambria 12pt):
//   base class 12pt keeps MATH at ~12pt (STIX); Thai reaches 16pt by scaling the main
//   font (16/12 = 1.333). So Thai 16pt <-> math 12pt == the house pairing.
//   `sizes.*` below are the DESIRED THAI point sizes (readable); thaiSizeCmd() converts
//   each to a \fontsize that renders at that visual size given the 1.333 font scale.

export const LATEX_DOC_CONFIG = {
  class: { name: "article", options: "12pt" },

  page: { margin: "2.54cm", paper: "a4paper" },

  fonts: {
    thai: "THSarabunNew-Regular.ttf",
    math: "STIXTwoMath-Regular.ttf",
    thaiScale: "1.333",   // 12pt base * 1.333 = 16pt Thai body
    mathScale: "1.0",     // STIX math relative to base (1.0 = 12pt)
    fontPath: "./",
  },

  spacing: {
    linespread: "1.25",
    parindent: "0pt",
    // G8 (odd line breaks): owner pref 2026-07-17 — prefer a line ending SHORT of the right
    // margin (ragged) over forcing it flush-right with stretched-out interword gaps, AND so a
    // wide equation WRAPS WHOLE to the next line instead of splitting mid-relation. \rightskip
    // = 0pt plus 1fil makes any amount of ragged tail free, so TeX never stretches spaces and
    // always prefers wrapping a whole math unit over an internal break. In practice most prose
    // lines still reach near the margin (words pack tight); the raggedness shows only where
    // justifying would be ugly. "0pt" = fully justified (legacy, reverses this). NOTE: a
    // minipage RESETS \rightskip — build_document_latex re-asserts this inside the part-1
    // keepTogether minipage (see minipageRagged there).
    bodyRightSkip: "0pt plus 1fil",
    // Inline-math break penalty (binop + relation). HIGH-BUT-FINITE (9000) is the sweet spot:
    //  • a short/medium equation would rather WRAP WHOLE to the next line (breaking at the cheap
    //    interword space before it) than split internally — so "f(3) ≥ f(4)", "g(x) = 1 − f(x)"
    //    stay intact (owner flagged breaks at −, =, ≥).
    //  • but if a math unit is genuinely WIDER than a whole line, TeX still takes the 9000 break
    //    rather than run off the page — so no hard overflow.
    // TeX defaults (700/500) split short equations; infinite (10000, "mathNoBreak") forbids the
    // forced break and overflows 12 pages instead — 9000 avoids both. See BUILD-CHANGELOG 6.5l.
    mathBreakPenalty: 9000,
  },

  // Desired THAI point sizes (see SIZING MODEL). math tracks body.
  // Values match the house style (Typst doc_config + the production release).
  sizes: {
    body: 16, title: 16, subtitle: 14, partHead: 18, sourceTag: 13, footer: 12, answerLine: 16,
    headerRunning: 13,
  },

  // xcolor hex (no leading '#')
  colors: {
    sourceTag: "7a7a7a", answerLine: "1a1a1a", solution: "222222", footer: "666666", subtitle: "333333",
    headerRunning: "444444",
  },

  // mathtools provides \overrightharpoon (the house vector accent). fancyhdr = footer.
  // array = m{} vertically-centered table columns (Stage 6.5 G6; confirmed present in the BusyTeX pack)
  packages: ["amsmath", "amssymb", "mathtools", "fontspec", "unicode-math", "xcolor", "fancyhdr", "array"],

  // ---- header (title block at document top). Running emblem shell is PARKED (needs the
  // school emblem PNG + derived year label) — leave emblem.enabled=false for now.
  header: {
    enabled: true,
    // {years} is DERIVED from the questions in THIS document (min–max year_be, 2-digit พ.ศ.,
    // e.g. "59-66" or "66") — never hard-typed, so the title always matches what the user
    // actually downloaded. build_document_latex fills it. Omit {years} to drop the range.
    title: "ข้อสอบสัปดาห์วิทย์ ม.น. ม.ปลาย ปี {years}",
    subtitle: "รอบคัดเลือก ระดับมัธยมศึกษาตอนปลาย",
    showSubtitle: true,
    emblem: { enabled: false, image: "nu-science-header-frame.png", yearLabelDerived: true },
    // Running header on EVERY page (Stage 6.5, added after comparing against the settled
    // DOCX house style, which has one and this LaTeX doc previously had none): left = doc
    // label + derived year range, center = topic (bold), right = page number. build_document_latex
    // fills {years} and supplies the topic text (opts.topicLabel). Emblem stays PARKED
    // (needs the school PNG) — page number substitutes for it on the right for now.
    running: {
      enabled: true,
      left: "ข้อสอบสัปดาห์วิทย์ ม.น. ปี {years}",
      showTopic: true,
      showPageNumber: true,
      pageNumberLabel: "หน้า",
    },
  },

  question: {
    numberFormat: "ข้อ {n}.",
    numberBold: false,
    numberGap: "0.4em",
    showSourceTag: true,
    sourceTagFormat: "[สัปดาห์วิทย์ ม.น. ปี {yy}/{nn}]",
  },

  choices: { indent: "1.2em", labelFormat: "{label}.", labelGap: "0.35em", lineGap: "0.15em" },

  part1: {
    enabled: true,
    head: "พาร์ทที่ 1 · โจทย์",
    showHead: true,
    workspace: "150pt",     // legacy fixed blank calc space (used only when questionsPerPage=0)
    keepTogether: true,     // wrap stem+choices so they don't split across a page break
    // Stage 6.5 G7: force exactly N questions per part-1 page. Each question sits at the top of
    // its ~1/N slice with the remaining space (calc workspace) filled by \vspace*{\fill} below,
    // so the two slices come out equal regardless of stem length. 0 = legacy free flow (fixed
    // workspace, packs 2–3/page). Owner pref 2026-07-17: exactly 2, each ~half page.
    questionsPerPage: 2,
  },

  answerGrid: { enabled: true, head: "ตารางเฉลยย่อ", perRow: 10 },

  part2: {
    enabled: true,
    head: "เฉลย",
    showSlug: true,
    repeatQuestion: true,
    questionLabel: "โจทย์ข้อ {n}.",
    answerLineFormat: "เฉลยข้อ {n}. ตอบ {answer}",
    showAnswerText: true,
  },

  footer: { text: "chutcenter · คลังโจทย์ข้อสอบแข่งขัน", showPageNumber: true, pageNumberLabel: "หน้า" },

  // Thai line-breaking: insert zero-width break opportunities (U+200B) between Thai words so
  // long space-less Thai runs wrap instead of overflowing the margin. Injected in JS by
  // thai_linebreak.mjs (Intl.Segmenter) OUTSIDE convParts; the preamble makes U+200B a
  // zero-width, no-hyphen breakpoint. Set enabled:false to turn the whole feature off.
  thaiBreak: { enabled: true, locale: "th" },
};

// ---- \fontsize command that renders at `pt` VISUAL Thai points, given the main-font
// Scale. Font glyphs are scaled by thaiScale, so we ask for pt/thaiScale; the baseline
// (2nd arg) is a raw length unaffected by the scale, so we set it to pt*1.25 directly.
export function thaiSizeCmd(pt, cfg = LATEX_DOC_CONFIG) {
  const scale = parseFloat(cfg.fonts.thaiScale) || 1;
  const size = (pt / scale).toFixed(2);
  const lead = (pt * 1.25).toFixed(2);
  return `\\fontsize{${size}pt}{${lead}pt}\\selectfont`;
}

// Build the XeLaTeX preamble (everything up to and including \begin{document}).
// `running`, if given, is { left, center, showPageNumber, pageNumberLabel } with {years}
// already substituted by build_document_latex (it knows THIS document's questions).
export function preamble(cfg = LATEX_DOC_CONFIG, running = null) {
  const f = cfg.fonts;
  const c = cfg.colors;
  const footerFont = thaiSizeCmd(cfg.sizes.footer, cfg);
  const headerFont = thaiSizeCmd(cfg.sizes.headerRunning, cfg);
  const pageNo = cfg.footer.showPageNumber ? `${escLatexText(cfg.footer.pageNumberLabel)} \\thepage` : "";
  const headerPageNo = running?.showPageNumber ? `${escLatexText(running.pageNumberLabel ?? "")} \\thepage` : "";
  const lines = [
    `\\documentclass[${cfg.class.options}]{${cfg.class.name}}`,
    ...cfg.packages.map((p) => `\\usepackage{${p}}`),
    // paper size MUST be passed to geometry — without it BusyTeX/TeX defaults to US Letter
    // (612x792pt), not A4 (found in Stage 6.5: output was Letter despite page.paper=a4paper).
    `\\usepackage[${cfg.page.paper},margin=${cfg.page.margin}]{geometry}`,
    `\\setmainfont{${f.thai}}[Path=${f.fontPath},Scale=${f.thaiScale}]`,
    // BOTH \setmathfont and \setmathrm are required — else operator names (\sin \cos \lim)
    // fall back to the Thai text font instead of the math font.
    `\\setmathfont{${f.math}}[Path=${f.fontPath},Scale=${f.mathScale}]`,
    `\\setmathrm{${f.math}}[Path=${f.fontPath},Scale=${f.mathScale}]`,
    `\\linespread{${cfg.spacing.linespread}}`,
    `\\setlength{\\parindent}{${cfg.spacing.parindent}}`,
    // G8: soft-ragged right — let a line end short rather than stretch spaces to the margin
    cfg.spacing.bodyRightSkip ? `\\setlength{\\rightskip}{${cfg.spacing.bodyRightSkip}}` : "",
    // G8: high-but-finite inline-math break penalty so equations wrap whole (see mathBreakPenalty)
    cfg.spacing.mathBreakPenalty != null
      ? `\\binoppenalty=${cfg.spacing.mathBreakPenalty}\\relpenalty=${cfg.spacing.mathBreakPenalty}`
      : "",
    // colors
    `\\definecolor{sourcetag}{HTML}{${c.sourceTag}}`,
    `\\definecolor{answerline}{HTML}{${c.answerLine}}`,
    `\\definecolor{solutioncol}{HTML}{${c.solution}}`,
    `\\definecolor{footercol}{HTML}{${c.footer}}`,
    `\\definecolor{subtitlecol}{HTML}{${c.subtitle}}`,
    `\\definecolor{headerrunningcol}{HTML}{${c.headerRunning}}`,
    // per-page header (running label + topic + page number) + footer (rule + text left, page number right)
    `\\pagestyle{fancy}`,
    `\\fancyhf{}`,
    `\\renewcommand{\\headrulewidth}{${running ? "0.4pt" : "0pt"}}`,
    `\\renewcommand{\\footrulewidth}{0.4pt}`,
    running ? `\\fancyhead[L]{{${headerFont}\\color{headerrunningcol}${escLatexText(running.left ?? "")}}}` : "",
    running?.center ? `\\fancyhead[C]{{${headerFont}\\bfseries ${escLatexText(running.center)}}}` : "",
    headerPageNo ? `\\fancyhead[R]{{${headerFont}\\color{headerrunningcol}${headerPageNo}}}` : "",
    `\\fancyfoot[L]{{${footerFont}\\color{footercol}${escLatexText(cfg.footer.text)}}}`,
    pageNo ? `\\fancyfoot[R]{{${footerFont}\\color{footercol}${pageNo}}}` : "",
    // Thai word-break: make U+200B (inserted by thai_linebreak.mjs) an active char that is a
    // zero-width, no-hyphen breakpoint. Defined via hex codepoint (no literal ZWSP in source);
    // \endgroup sits inside \lowercase so the \def lands globally after the group closes.
    cfg.thaiBreak?.enabled
      ? `\\catcode"200B=\\active\n\\begingroup\\lccode\`\\~="200B\\lowercase{\\endgroup\\protected\\def~{\\discretionary{}{}{}}}`
      : "",
    `\\begin{document}`,
    "",
  ].filter((l) => l !== "");
  return lines.join("\n");
}

export function requiredFonts(cfg = LATEX_DOC_CONFIG) {
  return [cfg.fonts.thai, cfg.fonts.math];
}

// minimal TeX text-mode escape for config-supplied strings used in the preamble
function escLatexText(s) {
  const map = { "#": "\\#", "$": "\\$", "%": "\\%", "&": "\\&", "_": "\\_", "{": "\\{", "}": "\\}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}" };
  return String(s).replace(/[#$%&_{}~^]/g, (ch) => map[ch]);
}
