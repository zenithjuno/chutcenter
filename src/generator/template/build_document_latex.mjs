// chutcenter — two-part LaTeX document assembler (sibling of build_document.mjs).
// Consumes LATEX_DOC_CONFIG + a list of L2 questions + the LaTeX converter, and emits a
// full XeLaTeX document (Part 1: questions + workspace + answer grid; Part 2: solutions).
// NOTHING about the look is hardcoded — every format value comes from `config`.
import { convParts, escText, mixedTextToLatex } from "../converter/parts_to_latex.mjs";
import { LATEX_DOC_CONFIG, preamble, thaiSizeCmd } from "./latex_config.mjs";
import { injectThaiBreaks } from "./thai_linebreak.mjs";

// convParts with the Thai word-break pass applied first (Stage 5). Kept OUTSIDE the converter
// so parts_to_latex's golden stays byte-for-byte clean; toggled by config.thaiBreak.enabled.
function cvParts(c, parts) {
  return convParts(c.thaiBreak?.enabled ? injectThaiBreaks(parts, c.thaiBreak) : parts);
}

function sizeGroup(c, ptKey, body, opts = {}) {
  // {\fontsize.. [\bfseries] [\color{..}] body}
  const bits = [thaiSizeCmd(c.sizes[ptKey], c)];
  if (opts.bold) bits.push("\\bfseries");
  if (opts.color) bits.push(`\\color{${opts.color}}`);
  return `{${bits.join("")} ${body}}`;
}

// DERIVED year range for the title: min–max of the questions' พ.ศ. years, 2-digit
// (e.g. "59-66", or "66" when a single year). Never hard-typed — matches what the user
// downloaded. Returns "" if no years are present.
function deriveYearRange(questions) {
  const years = questions.map((q) => q.year_be).filter((y) => Number.isFinite(y));
  if (!years.length) return "";
  const yy = (n) => String(n % 100).padStart(2, "0");
  const lo = Math.min(...years), hi = Math.max(...years);
  return lo === hi ? yy(lo) : `${yy(lo)}-${yy(hi)}`;
}

function sourceTag(c, q) {
  if (!c.question.showSourceTag) return "";
  const yy = String(q.year_be % 100).padStart(2, "0");
  const nn = String(q.number).padStart(2, "0");
  const txt = c.question.sourceTagFormat.replace("{yy}", yy).replace("{nn}", nn);
  return ` ${sizeGroup(c, "sourceTag", escText(txt), { color: "sourcetag" })}`;
}

function questionNumber(c, n) {
  const label = escText(c.question.numberFormat.replace("{n}", String(n)));
  return c.question.numberBold ? `{\\bfseries ${label}}` : label;
}

function stem(c, q, seqNo) {
  return `${questionNumber(c, seqNo)}\\hspace{${c.question.numberGap}}${cvParts(c, q.question.parts)}${sourceTag(c, q)}`;
}

function choices(c, q) {
  const rows = (q.question.choices ?? []).map((ch) => {
    const label = escText(c.choices.labelFormat.replace("{label}", ch.label ?? ""));
    return `\\hspace*{${c.choices.indent}}${label}\\hspace{${c.choices.labelGap}}${cvParts(c, ch.parts ?? [])}`;
  });
  return rows.join(`\\par\\vspace{${c.choices.lineGap}}\n`);
}

function solutionVariant(q) {
  return (q.solution_variants ?? []).find((v) => v.status === "available") ?? q.solution_variants?.[0];
}
function solutionParts(c, q) {
  const paras = solutionVariant(q)?.parts ?? [];
  return paras
    .map((para) => `\\par\\hspace*{1.2em}{\\color{solutioncol}${cvParts(c, para)}}`)
    .join("\n");
}

export function buildDocumentLatex(questions, opts = {}) {
  const c = opts.config ?? LATEX_DOC_CONFIG;
  const years = deriveYearRange(questions);
  // Running header (every page): left = doc label + derived years, center = topic (bold),
  // right = page number. opts.topicLabel comes from main.js (falls back to subtitleLine for
  // callers — e.g. the bench page — that don't pass it separately).
  const running = c.header.running?.enabled ? {
    left: c.header.running.left.replace("{years}", years),
    center: c.header.running.showTopic ? (opts.topicLabel ?? opts.subtitleLine ?? "") : "",
    showPageNumber: !!c.header.running.showPageNumber,
    pageNumberLabel: c.header.running.pageNumberLabel,
  } : null;
  const doc = [preamble(c, running)];

  // ---- header (title block); {years} derived from THIS document's questions
  if (c.header.enabled) {
    const title = opts.titleLine1 ?? c.header.title.replace("{years}", years);
    const head = [`\\begin{center}`, sizeGroup(c, "title", escText(title), { bold: true })];
    const subtitle = opts.subtitleLine ?? (c.header.showSubtitle ? c.header.subtitle : null);
    if (subtitle) head.push(`\\par ${sizeGroup(c, "subtitle", escText(subtitle), { color: "subtitlecol" })}`);
    head.push(`\\end{center}`, `\\vspace{8pt}`);
    doc.push(head.join("\n"));
  }

  // ---- Part 1: questions + workspace
  if (c.part1.enabled) {
    if (c.part1.showHead) doc.push(`${sizeGroup(c, "partHead", escText(c.part1.head), { bold: true })}\\par\\vspace{4pt}`);
    const perPage = c.part1.questionsPerPage | 0;   // 0 = legacy free flow
    const lead = c.par?.questionGap ?? "0.9em";
    // A minipage always RESETS \rightskip back to justified (verified via spike), so the
    // document-wide soft-ragged from spacing.bodyRightSkip is lost inside the keepTogether
    // wrapper — long equations then split mid-relation (e.g. "f(3) ≥ f(4)") instead of wrapping
    // whole. Re-assert the configured \rightskip at the top of each minipage. (G8, 2026-07-17)
    const minipageRagged = c.spacing?.bodyRightSkip ? `\\setlength{\\rightskip}{${c.spacing.bodyRightSkip}}` : "";
    questions.forEach((q, i) => {
      const inner = `${stem(c, q, i + 1)}\\par\\vspace{${c.choices.lineGap}}\n${choices(c, q)}`;
      if (perPage > 0) {
        // Fixed N-per-page: each question sits at the top of its slice, the rest filled with
        // blank workspace by an equal \vspace*{\fill}. IMPORTANT: no per-question \vspace lead
        // here — a lead would land above every question but NOT below the last one on the page,
        // making the last slot's workspace short by that lead (measured ~20pt: Q2 < Q1). With no
        // lead the two \fill gaps distribute equally (verified: gap-below-Q1 == gap-below-Q2).
        doc.push(`\\noindent\\begin{minipage}{\\linewidth}${minipageRagged}${inner}\\end{minipage}`);
        doc.push("\\par\\vspace*{\\fill}");
        const lastOverall = i === questions.length - 1;
        if ((i + 1) % perPage === 0 && !lastOverall) doc.push("\\newpage");
      } else {
        // legacy free flow: keep the per-question lead + fixed workspace gap
        const block = c.part1.keepTogether
          ? `\\par\\vspace{${lead}}\\noindent\\begin{minipage}{\\linewidth}${minipageRagged}${inner}\\end{minipage}`
          : `\\par\\vspace{${lead}}\\noindent ${inner}`;
        doc.push(block);
        doc.push(`\\par\\vspace{${c.part1.workspace}}`);
      }
    });
    doc.push("\\newpage");
  }

  // ---- answer grid (2-row tabulars, wrapped by perRow)
  if (c.answerGrid.enabled) {
    doc.push(`${sizeGroup(c, "partHead", escText(c.answerGrid.head), { bold: true })}\\par\\vspace{6pt}`);
    const per = c.answerGrid.perRow;
    for (let start = 0; start < questions.length; start += per) {
      const chunk = questions.slice(start, start + per);
      const cols = "|" + "c|".repeat(chunk.length);
      const nums = chunk.map((_, j) => `ข้อ ${start + j + 1}`).join(" & ");
      const ans = chunk.map((q) => `\\textbf{${escText(String(q.answer ?? ""))}}`).join(" & ");
      doc.push(
        `\\noindent\\begin{tabular}{${cols}}\\hline\n${nums} \\\\ \\hline\n${ans} \\\\ \\hline\n\\end{tabular}\\par\\vspace{6pt}`
      );
    }
    doc.push("\\newpage");
  }

  // ---- Part 2: solutions
  if (c.part2.enabled) {
    if (c.part2.head) {
      const h = [`\\begin{center}`, sizeGroup(c, "partHead", escText(c.part2.head), { bold: true })];
      const slug = opts.answerSlug ?? opts.subtitleLine;
      if (c.part2.showSlug && slug) h.push(`\\par ${sizeGroup(c, "subtitle", escText(slug), { color: "subtitlecol" })}`);
      h.push(`\\end{center}`, `\\vspace{6pt}`);
      doc.push(h.join("\n"));
    }
    questions.forEach((q, i) => {
      const L = [`\\par\\vspace{0.9em}\\noindent`];
      if (c.part2.repeatQuestion) {
        const qlabel = escText(c.part2.questionLabel.replace("{n}", String(i + 1)));
        L.push(`${qlabel}\\hspace{${c.question.numberGap}}${cvParts(c, q.question.parts)}${sourceTag(c, q)}`);
        L.push(`\\par\\vspace{${c.choices.lineGap}}\n${choices(c, q)}`);
      }
      const ans = escText(String(q.answer ?? ""));
      const line = escText(c.part2.answerLineFormat.replace("{n}", String(i + 1)).replace("{answer}", ans));
      let ansLine = `\\par\\vspace{3pt}{\\bfseries\\color{answerline}${line}}`;
      // G3(16): answer_text is mixed Thai + literal math — math words must be math runs
      if (c.part2.showAnswerText && q.answer_text) ansLine += `\\hspace{0.5em}${mixedTextToLatex(String(q.answer_text))}`;
      L.push(ansLine);
      L.push(solutionParts(c, q));
      doc.push(L.join("\n"));
    });
  }

  doc.push("", "\\end{document}");
  return doc.join("\n");
}
