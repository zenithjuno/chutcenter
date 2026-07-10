// chutcenter — document config (Stage 6). EVERY format parameter lives here, never
// hardcoded in the template (construction-plan golden rule #4). Tuning the look = editing
// these values; the template reads them. Toggling a value must visibly change the output
// (proven by web/test/doc_config.test.* later).
//
// Defaults are tuned to match the production reference PDFs
// (outputs/releases/nu-science-*), which the owner supplied as the target style.

export const DOC_CONFIG = {
  page: {
    paper: "a4",
    margin_x: "1.5cm",   // narrower than the DOCX ref so long Thai stems (e.g. 2559 q2) fit
    margin_y: "1.8cm",
  },

  fonts: {
    thai: "TH Sarabun New",
    math: "STIX Two Math",
    latin: ["Cambria", "STIX Two Text", "Georgia"],
  },

  // point sizes
  size: {
    body: 16,      // Thai body
    math: 13,      // math equations
    latin: 13,     // latin/admin runs
    title: 16,     // header line 1
    subtitle: 14,  // header line 2
    part_head: 18, // "พาร์ทที่ 1", "เฉลย"
    source_tag: 13,
    answer_line: 16,
    footer: 12,
  },

  color: {
    source_tag: "#7a7a7a",
    answer_line: "#1a1a1a",
    solution: "#222222",
    footer: "#666666",
    subtitle: "#333333",
  },

  par: {
    leading: "0.62em",       // line spacing inside a paragraph
    question_gap: "0.9em",   // vertical gap between questions
    solution_gap: "0.5em",   // gap between solution paragraphs
  },

  header: {
    // {exam}=exam name, {round}=edition no., {year}=พ.ศ., {level}=level line
    title: "ข้อสอบสัปดาห์วิทย์ ม.น. ม.ปลาย ครั้งที่ {round} พ.ศ. {year}",
    subtitle: "รอบคัดเลือก ระดับมัธยมศึกษาตอนปลาย",
    show_subtitle: true,
  },

  question: {
    number_format: "ข้อ {n}.",
    number_bold: false,
    number_gap: "0.4em",           // space after "ข้อ N."
    // source tag shown at the end of the stem, e.g. [สัปดาห์วิทย์ ม.น. ปี 59/01]
    show_source_tag: true,
    source_tag_format: "[สัปดาห์วิทย์ ม.น. ปี {yy}/{nn}]",
  },

  choices: {
    indent: "1.2em",
    label_format: "{label}.",
    label_gap: "0.35em",
    line_gap: "0.15em",
  },

  part1: {
    enabled: true,
    head: "พาร์ทที่ 1 · โจทย์",
    show_head: true,
    // fixed blank calc space appended after each question (matches the owner's DOCX:
    // a fixed 150pt gap after each item is "enough" and keeps ~2 questions/page).
    workspace: "150pt",
  },

  answer_grid: {
    enabled: true,
    head: "ตารางเฉลยย่อ",
    // 2-row table per chunk: row 1 = ข้อ numbers, row 2 = answers aligned beneath.
    per_row: 10,                  // questions per table before wrapping to a new table
  },

  part2: {
    enabled: true,
    head: "เฉลย",
    show_slug: true,              // second line under "เฉลย" naming the topic/source/year
    repeat_question: true,        // reprint the question above its solution
    question_label: "โจทย์ข้อ {n}.",
    answer_line_format: "เฉลยข้อ {n}. ตอบ {answer}",
    show_answer_text: true,       // append answer_text after the answer line
  },

  footer: {
    text: "chutcenter · คลังโจทย์ข้อสอบแข่งขัน",
    show_page_number: true,
    page_number_label: "หน้า",
  },

  math: {
    // long/tall inline expressions can be promoted to a centered display line.
    // Stage-6 tuning hook; off by default (matches inline-first reference).
    display_block: false,
  },
};
