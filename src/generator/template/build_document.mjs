// chutcenter — two-part document template (Stage 6).
// Consumes DOC_CONFIG + a list of L2 questions + the converter, and emits a full
// two-part Typst document (Part 1: questions + workspace + answer grid; Part 2: solutions).
// NOTHING about the look is hardcoded here — every format value comes from `config`.
import { convParts, escText } from "../converter/parts_to_typst.mjs";
import { DOC_CONFIG } from "./doc_config.mjs";

const pt = (n) => `${n}pt`;

function preamble(c) {
  const latinList = c.fonts.latin.map((f) => `"${f}"`).join(", ");
  const footerBits = [];
  footerBits.push(`#set text(font: "${c.fonts.thai}", size: ${pt(c.size.footer)}, fill: rgb("${c.color.footer}"))`);
  footerBits.push(`#line(length: 100%, stroke: 0.4pt + gray) #v(2pt)`);
  const pageNo = c.footer.show_page_number
    ? ` #h(1fr) ${c.footer.page_number_label} #counter(page).display("1")`
    : "";
  footerBits.push(`${escText(c.footer.text)}${pageNo}`);
  return [
    `#set page(paper: "${c.page.paper}", margin: (x: ${c.page.margin_x}, y: ${c.page.margin_y}),`,
    `  footer: context [`,
    `    ${footerBits.join("\n    ")}`,
    `  ])`,
    `#set text(font: "${c.fonts.thai}", size: ${pt(c.size.body)}, lang: "th")`,
    `#show math.equation: set text(font: "${c.fonts.math}", size: ${pt(c.size.math)})`,
    `#set par(justify: false, leading: ${c.par.leading})`,
    `#let thai(s) = text(font: "${c.fonts.thai}", size: ${pt(c.size.body)}, s)`,
    `#let latin(s) = text(font: (${latinList}), size: ${pt(c.size.latin)}, s)`,
    "",
  ].join("\n");
}

function sourceTag(c, q) {
  if (!c.question.show_source_tag) return "";
  const yy = String(q.year_be % 100).padStart(2, "0");
  const nn = String(q.number).padStart(2, "0");
  const txt = c.question.source_tag_format.replace("{yy}", yy).replace("{nn}", nn);
  return ` #text(size: ${pt(c.size.source_tag)}, fill: rgb("${c.color.source_tag}"))[${escText(txt)}]`;
}

function questionNumber(c, n) {
  const label = escText(c.question.number_format.replace("{n}", String(n)));
  return c.question.number_bold ? `#text(weight: "bold")[${label}]` : label;
}

function stem(c, q, seqNo) {
  // seqNo = display index within this document (1..N); q.number = original number
  return `${questionNumber(c, seqNo)}#h(${c.question.number_gap}) ${convParts(q.question.parts)}${sourceTag(c, q)}`;
}

function choices(c, q) {
  const out = [];
  for (const ch of q.question.choices ?? []) {
    const label = escText(c.choices.label_format.replace("{label}", ch.label ?? ""));
    // leading space after #h() so a body starting with "(" is not read as a call arg
    out.push(`#pad(left: ${c.choices.indent})[${label}#h(${c.choices.label_gap}) ${convParts(ch.parts ?? [])}]`);
  }
  return out.join(`\n#v(${c.choices.line_gap})\n`);
}

function solutionParts(c, q) {
  const variant = (q.solution_variants ?? []).find((v) => v.status === "available") ?? q.solution_variants?.[0];
  const paras = variant?.parts ?? [];
  return paras
    .map((para) => `#pad(left: 1.2em, text(fill: rgb("${c.color.solution}"))[${convParts(para)}])`)
    .join(`\n#v(${c.par.solution_gap})\n`);
}

export function buildDocument(questions, opts = {}) {
  const c = opts.config ?? DOC_CONFIG;
  const doc = [preamble(c)];

  // ---- header
  const title = opts.titleLine1 ?? c.header.title;
  doc.push(`#align(center)[#text(size: ${pt(c.size.title)}, weight: "bold")[${escText(title)}]]`);
  const subtitle = opts.subtitleLine ?? (c.header.show_subtitle ? c.header.subtitle : null);
  if (subtitle) {
    doc.push(`#align(center)[#text(size: ${pt(c.size.subtitle)}, fill: rgb("${c.color.subtitle}"))[${escText(subtitle)}]]`);
  }
  doc.push(`#v(8pt)`);

  // ---- Part 1: questions + workspace
  if (c.part1.enabled) {
    if (c.part1.show_head) doc.push(`#text(size: ${pt(c.size.part_head)}, weight: "bold")[${escText(c.part1.head)}]\n#v(4pt)`);
    questions.forEach((q, i) => {
      // question + choices stay intact; the fixed workspace gap is appended after (flows freely)
      const block = [
        `#block(breakable: false, above: ${c.par.question_gap})[`,
        stem(c, q, i + 1),
        "",
        choices(c, q),
        "]",
      ].join("\n");
      doc.push(block);
      doc.push(`#v(${c.part1.workspace})`);
    });
    doc.push("#pagebreak()");
  }

  // ---- answer grid: 2-row tables (row 1 = ข้อ numbers, row 2 = answers), wrapped by per_row
  if (c.answer_grid.enabled) {
    doc.push(`#text(size: ${pt(c.size.part_head)}, weight: "bold")[${escText(c.answer_grid.head)}]\n#v(6pt)`);
    const per = c.answer_grid.per_row;
    const tables = [];
    for (let start = 0; start < questions.length; start += per) {
      const chunk = questions.slice(start, start + per);
      const nums = chunk.map((_, j) => `[ข้อ ${start + j + 1}]`).join(", ");
      const ans = chunk.map((q) => `[*${escText(String(q.answer ?? ""))}*]`).join(", ");
      tables.push(`#table(columns: ${chunk.length}, align: center, stroke: 0.5pt,\n  ${nums},\n  ${ans}\n)`);
    }
    doc.push(tables.join("\n#v(6pt)\n"));
    doc.push("#pagebreak()");
  }

  // ---- Part 2: solutions
  if (c.part2.enabled) {
    if (c.part2.head) {
      doc.push(`#align(center)[#text(size: ${pt(c.size.part_head)}, weight: "bold")[${escText(c.part2.head)}]]`);
      const slug = opts.answerSlug ?? opts.subtitleLine;
      if (c.part2.show_slug && slug) {
        doc.push(`#align(center)[#text(size: ${pt(c.size.subtitle)}, fill: rgb("${c.color.subtitle}"))[${escText(slug)}]]`);
      }
      doc.push(`#v(6pt)`);
    }
    questions.forEach((q, i) => {
      const L = [`#block(breakable: true, above: ${c.par.question_gap})[`];
      if (c.part2.repeat_question) {
        const qlabel = escText(c.part2.question_label.replace("{n}", String(i + 1)));
        L.push(`${qlabel}#h(${c.question.number_gap}) ${convParts(q.question.parts)}${sourceTag(c, q)}`);
        L.push("");
        L.push(choices(c, q));
      }
      const ans = escText(String(q.answer ?? ""));
      const line = escText(c.part2.answer_line_format.replace("{n}", String(i + 1)).replace("{answer}", ans));
      let ansLine = `#v(3pt)#text(fill: rgb("${c.color.answer_line}"), weight: "bold")[${line}]`;
      // space after #h() so an answer_text starting with a math char (e.g. √) isn't read as code
      if (c.part2.show_answer_text && q.answer_text) ansLine += `#h(0.5em) ${escText(String(q.answer_text))}`;
      L.push(ansLine);
      L.push(solutionParts(c, q));
      L.push("]");
      doc.push(L.join("\n"));
    });
  }

  return doc.join("\n");
}
