// chutcenter — thai_math_parts -> Typst converter (Stage 4)
//
// FAITHFUL PORT of the proven reference:
//   outputs/web-exam-bank-readiness/spike-typst/spike_build.py (conv_* functions)
// The reference is the source of truth for correctness ("ห้ามเขียนใหม่จากจินตนาการ").
// Parity is enforced by web/test/golden.test.mjs against web/test/fixtures/golden_210.json,
// which is generated from the reference over all 210 canonical questions — every output
// string here must match the reference byte-for-byte.
//
// Pure, zero-dependency ESM so it runs unchanged under Node (offline tests) and in the
// browser via typst.ts (Stage 7). No I/O, no bank knowledge — parts in, Typst source out.

// ---------------------------------------------------------------- typst escaping

const ESC_TEXT = new Set(["\\", "#", "$", "*", "_", "`", "@", "<", "[", "]"]);

export function escText(s) {
  let out = "";
  for (const ch of String(s)) out += ESC_TEXT.has(ch) ? "\\" + ch : ch;
  return out;
}

// Escape a literal string embedded inside typst math quotes. (backslash first, then quote)
export function escMathStr(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// ---------------------------------------------------------------- math conversion

const KNOWN_NARY = {
  "∑": "sum",
  "∏": "product",
  "∫": "integral",
  "⋃": "union.big",
  "⋂": "sect.big",
};

const MATH_CHAR_ESCAPE = { "#": "\\#", "$": "\\$", '"': '\\"', "&": "\\&", "\\": "\\\\" };

// --- Stage-4 FIX (not in the 8-question spike; surfaced by the 210 compile sweep) ---
// Function words that typst math has NO built-in for -> render as upright operators.
// (typst DOES define sin cos tan cot sec csc ln log exp det ... so those stay bare.)
const EXTENDED_OP = new Set([
  "cosec", "cosech", "sech", "arcsin", "arccos", "arctan",
  "arccot", "arcsec", "arccsc", "arccosec",
]);
// typst math built-in identifiers that render correctly as bare multi-letter tokens.
const TYPST_MATH_BUILTIN = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "sinh", "cosh", "tanh", "coth",
  "ln", "log", "lg", "exp", "det", "dim", "gcd", "lcm", "hom", "ker", "lim",
  "max", "min", "sup", "inf", "arg", "deg", "mod", "Pr", "tr", "id", "im", "Re", "Im",
]);
const LATIN_RUN = /^[A-Za-z]{2,}$/;

// Python-style truthiness for values that may be list | string | null | undefined.
function truthy(v) {
  if (Array.isArray(v)) return v.length > 0;
  if (v === null || v === undefined || v === "") return false;
  return Boolean(v);
}

// Python `a or b or c`: first truthy, else last.
function pyOr(...vals) {
  for (const v of vals) if (truthy(v)) return v;
  return vals[vals.length - 1];
}

export function mathToken(tokRaw) {
  const tok = String(tokRaw);
  // "," and ";" are argument/row separators inside typst math calls (mat, cases, frac,...)
  if (tok.trim() === "," || tok.trim() === ";") return `class("punctuation", "${tok.trim()}")`;
  // FIX: known function words typst lacks -> upright operator (e.g. cosec θ)
  if (EXTENDED_OP.has(tok)) return `op("${tok}")`;
  // FIX: a bare run of >=2 latin letters typst does not know is an "unknown variable"
  // (points/segments "AB", triangle "ABC") -> space the letters so they compile.
  if (LATIN_RUN.test(tok) && !TYPST_MATH_BUILTIN.has(tok)) return tok.split("").join(" ");
  let out = "";
  for (const ch of tok) out += MATH_CHAR_ESCAPE[ch] ?? ch;
  return out;
}

export function convItems(items) {
  return (items ?? []).map(convMath).join(" ");
}

function multi(base) {
  return Array.isArray(base) && base.length > 1;
}

export function convMath(node) {
  if (typeof node === "string") return mathToken(node);
  if (Array.isArray(node)) return convItems(node);
  if (node === null || typeof node !== "object") return "";
  if ("expr" in node && !("kind" in node)) return convMath(node.expr);
  const kind = node.kind;

  switch (kind) {
    case "plain":
      return mathToken(String(node.value ?? ""));
    case "expr":
      return convItems(node.items ?? []);
    case "upright":
      return `"${escMathStr(String(node.text ?? ""))}"`;
    case "thai_text":
      return `thai("${escMathStr(node.text ?? "")}")`;
    case "paren":
      return `lr((${convItems(node.items ?? [])}))`;
    case "delim": {
      const beg = node.beg ?? "(";
      const end = node.end ?? ")";
      const body = convItems(node.items ?? []);
      const bmap = { "(": "(", ")": ")", "[": "[", "]": "]", "{": "{", "}": "}", "|": "|", "‖": "||" };
      let b = bmap[beg] ?? beg;
      let e = bmap[end] ?? end;
      if (b === "{") b = "\\{";
      if (e === "}") e = "\\}";
      return `lr(${b} ${body} ${e})`;
    }
    case "neg":
      return "− " + convItems(node.items ?? []);
    case "sup": {
      const base = node.base;
      const b = convItems(base ?? []);
      const s = convItems(node.sup ?? []);
      return multi(base) ? `(${b})^(${s})` : `${b}^(${s})`;
    }
    case "sub":
      return `${convItems(node.base ?? [])}_(${convItems(node.sub ?? [])})`;
    case "sub_sup":
      return `${convItems(node.base ?? [])}_(${convItems(node.sub ?? [])})^(${convItems(node.sup ?? [])})`;
    case "frac":
      return `frac(${convItems(node.num ?? [])}, ${convItems(node.den ?? [])})`;
    case "rad":
      if (truthy(node.deg)) return `root(${convItems(node.deg)}, ${convItems(node.items ?? [])})`;
      return `sqrt(${convItems(node.items ?? [])})`;
    case "bar":
      return `overline(${convItems(node.items ?? [])})`;
    case "acc": {
      const chr = node.chr ?? "→";
      const base = convItems(node.items ?? []);
      if (chr === "^" || chr === "ˆ") return `hat(${base})`;
      if (chr === "→" || chr === "⃗") {
        // vector accents (owner preference 2026-07-06): general vectors use a HARPOON; the
        // single-letter unit-basis vectors i/j/k take a HAT instead (î ĵ k̂). The data encodes
        // i/j/k with the same "→" chr as other vectors, so we special-case by base.
        const raw = (node.items ?? []).filter((x) => typeof x === "string").join("");
        if (raw === "i" || raw === "j" || raw === "k") return `hat(${base})`;
        return `accent(${base}, harpoon)`;
      }
      return `accent(${base}, ${chr})`;
    }
    case "matrix": {
      const rows = node.rows ?? [];
      const brackets = node.brackets ?? "[";
      const rowsSrc = rows
        .map((row) => row.map((cell) => convItems(cell)).join(", "))
        .join("; ");
      if (brackets === "none") return `mat(delim: #none, ${rowsSrc})`;
      return `mat(delim: "[", ${rowsSrc})`;
    }
    case "func": {
      const name = node.name ?? "f";
      const arg = convItems(node.arg ?? []);
      return `op("${escMathStr(name)}")(${arg})`;
    }
    case "log": {
      const base = node.base;
      const arg = convItems(node.arg ?? []);
      if (truthy(base)) return `log_(${convItems(base)}) (${arg})`;
      return `log (${arg})`;
    }
    case "lim_low": {
      const base = node.base ?? ["lim"];
      let baseSrc;
      if (Array.isArray(base) && base.length === 1 && base[0] === "lim") {
        baseSrc = 'op("lim", limits: #true)';
      } else {
        baseSrc = `op("${escMathStr(base.map(String).join(""))}", limits: #true)`;
      }
      return `${baseSrc}_(${convItems(node.lim ?? [])})`;
    }
    case "lim": {
      const body = convItems(node.body ?? []);
      // Shape B: a `lim` field carries the full subscript tokens (variable, arrow, and a
      // one-sided target like a `sup` "3^+"). Older code only read var/to and silently
      // dropped this target (rendered "lim_(x → )"). Honor the lim field when present.
      if ("lim" in node) {
        return `op("lim", limits: #true)_(${convItems(node.lim)}) ${body}`;
      }
      const varTok = node.var ?? "x";
      const to = String(node.to ?? "");
      let toSrc;
      if (to.endsWith("+") || to.endsWith("-")) {
        const sign = to.endsWith("+") ? "+" : "−";
        toSrc = `${mathToken(to.slice(0, -1))}^${sign}`;
      } else {
        toSrc = mathToken(to);
      }
      return `op("lim", limits: #true)_(${mathToken(varTok)} → ${toSrc}) ${body}`;
    }
    case "nary": {
      const chr = node.chr ?? "∑";
      const name = KNOWN_NARY[chr]; // undefined if unknown
      const sub = convItems(node.sub ?? []);
      const sup = convItems(node.sup ?? []);
      const body = convItems(node.body ?? []);
      let head;
      if (name === undefined) head = mathToken(chr);
      else if (name === "integral") head = "integral";
      else head = `limits(${name})`;
      let script = "";
      if (sub) script += `_(${sub})`;
      if (sup) script += `^(${sup})`;
      return `${head}${script} ${body}`;
    }
    case "integral": {
      const lo = pyOr(node.from, node.sub, []);
      const hi = pyOr(node.to, node.sup, []);
      return `integral_(${convItems(lo)})^(${convItems(hi)}) ${convItems(node.body ?? [])}`;
    }
    case "binom":
      return `binom(${convItems(node.top ?? [])}, ${convItems(node.bottom ?? [])})`;
    case "cases": {
      // Left-brace-only 2-column matrix so expression & condition columns align
      // (matches the owner's "matrix placeholder" reference). delim (left, none) = left
      // brace only; column-gap spaces the two columns.
      // Source is inconsistent about the space after the leading ";" in the condition column
      // (some rows carry a " " token, some don't) — normalize to a consistent "; " everywhere.
      const rows = node.rows ?? [];
      const rowSrcs = rows.map((row) => {
        const cells = row.slice();
        if (cells.length >= 2) {
          const cond = cells[cells.length - 1];
          let condSrc;
          if (cond.length && typeof cond[0] === "string" && cond[0].trim() === ";") {
            let rest = cond.slice(1);
            // strip a leading blank spacer (plain " " OR an upright node whose text is blank)
            const blank = (t) =>
              typeof t === "string" ? t.trim() === "" : !!(t && t.kind === "upright" && String(t.text ?? "").trim() === "");
            while (rest.length && blank(rest[0])) rest = rest.slice(1);
            condSrc = `class("punctuation", ";") " " ${convItems(rest)}`;
          } else {
            condSrc = convItems(cond);
          }
          const exprSrc = cells.slice(0, -1).map((c) => convItems(c)).join(", ");
          return `${exprSrc}, ${condSrc}`;
        }
        return cells.map((c) => convItems(c)).join(", ");
      });
      return `mat(delim: #("{", none), align: #left, column-gap: #1.4em, ${rowSrcs.join("; ")})`;
    }
    default:
      // unknown kind: dump readable (matches reference `"[?{kind}]"`)
      return `"[?${kind}]"`;
  }
}

// ---------------------------------------------------------------- parts conversion

export function convParts(parts) {
  const out = [];
  for (const p of parts ?? []) {
    if (typeof p === "string") {
      out.push(escText(p));
      continue;
    }
    const t = p.type;
    if (t === "text") out.push(escText(p.text ?? ""));
    else if (t === "latin_text") out.push(`#latin("${escMathStr(p.text ?? "")}")`);
    else if (t === "math") {
      const node = "expr" in p && !("kind" in p) ? p.expr : p;
      out.push(`$${convMath(node)}$`);
    } else if (t === "line_break") out.push(" \\\n");
    else if (t === "table") out.push(convTable(p));
    else if (t === "label") out.push(escText(p.text ?? ""));
  }
  return out.join("");
}

export function convTable(p) {
  const rows = p.rows ?? [];
  const ncols = rows.length ? Math.max(...rows.map((r) => r.length)) : 1;
  const widths = p.widths;
  let cols;
  if (truthy(widths)) cols = widths.map((w) => `${w}in`).join(", ");
  else cols = Array(ncols).fill("auto").join(", ");
  const cells = [];
  for (const row of rows) {
    for (const cell of row) cells.push(`[${convParts(cell)}]`);
    for (let i = 0; i < ncols - row.length; i++) cells.push("[]");
  }
  const body = cells.join(",\n    ");
  return (
    `\n#align(center)[#table(columns: (${cols}), align: center + horizon, ` +
    `stroke: 0.5pt,\n    ${body}\n)]\n`
  );
}
