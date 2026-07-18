// chutcenter — thai_math_parts -> LaTeX (XeLaTeX) converter.
//
// Sibling of parts_to_typst.mjs: same parts-AST in, but emits a LaTeX math/source
// string instead of Typst. Meant to be swapped in at the SAME seam (build_document
// consumes convParts / convMath). The parts + L2 schema do NOT change when swapping
// engines — only this converter + the template preamble move.
//
// Target engine: XeLaTeX via BusyTeX (TeX Live), with:
//   \usepackage{unicode-math}  \setmathfont{STIX Two Math}  \setmathrm{STIX Two Math}
// Because unicode-math is loaded, math symbols are emitted as raw Unicode passthrough
// (∑, ≤, ∈, ℝ, …) — no macro table needed for the ~34 census symbols. Only STRUCTURE
// (\frac, \sqrt, ^, _, matrices …) and multi-letter operators (\sin, \lim …) use macros.
//
// Pure, zero-dependency ESM (runs under Node for offline tests and in the browser).
// No I/O, no bank knowledge — parts in, LaTeX out.
//
// ⚙️  TUNING: everything a preference pass may want to change lives in LATEX_CONFIG
// below. Edit those values (or call configureLatex({...})) — do NOT sprinkle literals
// through the code. Preference work is ongoing, so keep this the single knob panel.

// ==================================================================== CONFIG
// The one place to tweak converter behaviour. Each value is safe to change alone.
export const LATEX_CONFIG = {
  // --- delimiters ---
  autoSizeDelims: true,        // true -> \left..\right (grows with content); false -> plain
  // --- accents (owner pref 2026-07-06: general vectors = HARPOON, unit i/j/k = hat) ---
  vectorCmd: "\\overrightharpoon", // general vector = harpoon (⇀), matching the Typst/DOCX
                               //   house style. Needs \usepackage{mathtools} (confirmed in the
                               //   BusyTeX bundle). Set "\\vec" for a plain arrow instead.
  unitVectorCmd: "\\hat",      // i / j / k basis vectors
  hatCmd: "\\hat",             // explicit "^" accent
  barCmd: "\\overline",        // bar accent
  accentFallbackCmd: "\\vec",  // unknown accent chr
  // --- fractions ---
  fracCmd: "\\frac",           // "\\dfrac" forces display-size fractions inline
  // --- radicals / roots use \sqrt (fixed) ---
  // --- matrices ---
  matrixEnv: "bmatrix",        // brackets:"[" -> this env
  matrixPlainEnv: "matrix",    // brackets:"none" -> this env
  // --- superscript on a multi-token base gets wrapped in parens: (a+b)^2 ---
  parenSupMultiBase: true,
  // --- named functions ---
  operatorCmd: "\\operatorname", // for multi-letter function names LaTeX lacks a builtin for
  limitsCmd: "\\operatorname*",  // operator that takes limits below (lim-like)
  // piecewise (cases): value/condition separator. Owner pref locked at Stage 6 (Typst house
  // style, memory chutcenter-web-direction): align-left + "; " spacing. The source is
  // inconsistent (some rows carry a leading ";", some a trailing ","); G5 normalizes every
  // row to exactly this separator. ";\\ " = semicolon + control-space.
  casesSeparator: ";\\ ",
  // G7 item 12: a stem line that is math ONLY (a system of equations / a standalone formula
  // sitting alone between line breaks) renders as a CENTERED display equation instead of an
  // inline left-aligned run. Lines that mix Thai/Latin text with math (e.g. "(i) …") stay
  // inline. false = every math stays inline (legacy).
  displayLoneMathLines: true,
  // line_break typing (data lane 2026-07-17, commit b41bfd3a): source line_break parts now
  // carry an intent tag. `{type:"line_break", break:"soft"}` = the author kept a source break
  // but the renderer MAY flow the text (drops the forced boundary; here it becomes an ordinary
  // space so TeX wraps the run — ragged-right per G8). `break:"hard"` or a MISSING field =
  // legacy semantic boundary (unchanged). Fixes the q5 gratuitous wrap WITHOUT touching data;
  // parallel/list/system breaks stay hard. false = treat every break as hard (pre-typing).
  honorSoftBreaks: true,
  // G11 (2026-07-18): a LONE math-only stem line next to an inline math-DOMINANT line (a
  // definition-stack row like q01's "C={...}", whose sibling "B={...} และ" renders inline-left)
  // aligns LEFT with it instead of centering — otherwise one row of the stack floats to center.
  // A math-only line in a >=2 math-only RUN (a real system: q42/q180/q209) or a standalone block
  // among prose (a data list: q89) still centers. false = every math-only line centers (pre-G11).
  stackRowMathInline: true,
  // lim-family scripts sit UNDER the operator even in inline math (G4: house style has
  // x→3 below lim, but TeX inline places _{} beside the operator without \limits)
  limScriptsBelow: true,
  // n-ary operators (∑ ∏ ⋃ ⋂) and integrals: bounds ABOVE/BELOW the symbol, not diagonal
  // beside it (G9, owner pref 2026-07-17 — same \limits treatment as lim)
  naryScriptsBelow: true,
  // display-size ∫ and ∑ glyphs inline (G10, owner pref 2026-07-17): wrap ONLY the operator +
  // its bounds in {\displaystyle …} so the symbol renders large with limits stacked, while the
  // integrand/summand OUTSIDE the group stays text-size — owner wants the operator big but
  // fractions NOT enlarged (chose this over full-displaystyle after the spike). No scalebox.
  naryDisplayStyle: true,
  // --- tables (Stage 6.5 G2+G6) ---
  // Fixed-width tables are auto-scaled DOWN (never up) so column widths + \tabcolsep padding
  // fit the text block. tableMaxWidthIn must track the template geometry: A4 (8.27in) minus
  // 2×2.54cm margins ≈ 6.27in usable — 6.2 leaves a hair for the vertical rules. Found in
  // Stage 6.5: 66/06 (7 cols ≈ 7.0in incl. padding) and 68/22 (6.65in) ran off the page.
  tableMaxWidthIn: 6.2,
  tableColSepIn: 0.083,        // \tabcolsep = 6pt ≈ 0.083in, counted twice per column
  tableColType: "m",           // fixed-width column: "m" = vertically centered (array pkg), "p" = top
  // horizontal alignment inside fixed-width cells — m{}/p{} default to LEFT, which the owner
  // flagged on the 66/06 z-table; \centering (owner pref 2026-07-16) centers both axes with m.
  tableColPrefix: "\\centering\\arraybackslash",  // "" -> left-aligned cells
};

export function configureLatex(partial = {}) {
  Object.assign(LATEX_CONFIG, partial);
  return LATEX_CONFIG;
}

// ==================================================================== escaping
// TeX text-mode specials. (backslash handled first via the map having no "\\" key issue)
const ESC_TEXT = {
  "\\": "\\textbackslash{}", "#": "\\#", "$": "\\$", "%": "\\%", "&": "\\&",
  "_": "\\_", "{": "\\{", "}": "\\}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}",
};
// TH Sarabun (the body font) covers ASCII + Thai + a fair amount of Latin-1/general
// punctuation (², ×, °, ≤, ≥, −, √, ∞, curly quotes, …) but is MISSING these codepoints —
// confirmed via fonttools cmap check against THSarabunNew-Regular.ttf, 2026-07-16 (Stage 6
// verify caught this via a tofu'd π in an answer_text field). For exactly these chars,
// \ensuremath{} routes the single character through unicode-math (STIX) instead: it
// inserts $...$ in text mode and is a no-op if already inside math mode. Do NOT widen this
// to "any non-ASCII" — most punctuation/symbol chars above ARE in the font and rendering
// them via STIX instead looks subtly different (math-italic style) for no reason.
// Re-check with fonttools if new symbols start appearing tofu'd.
const MISSING_FROM_THAI_FONT = new Set([0x03c0, 0x2208, 0x2192, 0x2228, 0x2227, 0x03b8]); // π ∈ → ∨ ∧ θ
export function escText(s) {
  let out = "";
  for (const ch of String(s)) {
    if (ESC_TEXT[ch] !== undefined) { out += ESC_TEXT[ch]; continue; }
    out += MISSING_FROM_THAI_FONT.has(ch.codePointAt(0)) ? `\\ensuremath{${ch}}` : ch;
  }
  return out;
}

// Inside math mode (unicode-math): only these are structural/special and must be escaped
// when they appear as LITERAL tokens (not as our own structure).
// "~" is the logic-negation tilde in the bank's tokens, but in TeX math it is an active
// NBSP — before the G3 fix every ~p rendered as " p" with the negation silently gone.
const ESC_MATH = { "#": "\\#", "$": "\\$", "%": "\\%", "&": "\\&", "_": "\\_", "{": "\\{", "}": "\\}", "~": "{\\sim}" };
function escMathChar(ch) { return ESC_MATH[ch] ?? ch; }

// Escape a literal string embedded inside \text{...} / \operatorname{...}.
export function escMathStr(s) {
  return escText(s);
}

// ==================================================================== math tokens
// Multi-letter operators LaTeX DOES define (emit as \name). Others -> \operatorname.
const LATEX_BUILTIN_OP = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "sinh", "cosh", "tanh", "coth",
  "ln", "log", "lg", "exp", "det", "dim", "gcd", "hom", "ker", "lim",
  "max", "min", "sup", "inf", "arg", "deg", "Pr",
]);
const EXTENDED_OP = new Set([
  "cosec", "cosech", "sech", "arcsin", "arccos", "arctan",
  "arccot", "arcsec", "arccsc", "arccosec", "lcm",
]);
const LATIN_RUN = /^[A-Za-z]{2,}$/;

export function mathToken(tokRaw) {
  const tok = String(tokRaw);
  // "," / ";" are argument/row separators inside calls — pass literal
  if (tok.trim() === "," || tok.trim() === ";") return tok.trim();
  if (LATEX_BUILTIN_OP.has(tok)) return `\\${tok} `;
  if (EXTENDED_OP.has(tok)) return `${LATEX_CONFIG.operatorCmd}{${tok}}`;
  // a bare run of >=2 latin letters LaTeX would set as juxtaposed italics (product) —
  // for point/segment names (AB, ABC) space them so each is its own upright-ish italic.
  if (LATIN_RUN.test(tok) && !LATEX_BUILTIN_OP.has(tok)) return tok.split("").join(" ");
  let out = "";
  for (const ch of tok) out += escMathChar(ch);
  return out;
}

// ==================================================================== math tree
export function convItems(items) {
  return (items ?? []).map(convMath).join(" ");
}
function multi(base) { return Array.isArray(base) && base.length > 1; }

// A base that is ITSELF scripted (x_i, x^2, x_i^2) must be braced before another script is
// attached, else XeLaTeX throws "Double subscript/superscript" on e.g. x_{i}_{2}. (Typst
// auto-groups, so its converter needs no equivalent.) Found in Stage 6.5: nested sub in a
// statistics question silently truncated the whole doc via the masked-exit bug.
function scriptedBase(arr) {
  return Array.isArray(arr) && arr.length === 1 && arr[0] && typeof arr[0] === "object"
    && (arr[0].kind === "sub" || arr[0].kind === "sup" || arr[0].kind === "sub_sup");
}
function baseSrc(arr) {
  const s = convItems(arr ?? []);
  return scriptedBase(arr) ? `{${s}}` : s;
}

// --- "already parenthesized" detection (Stage 6.5 G1: spurious double parens) ---
// Some sources carry their OWN parens around an argument/base; wrapping again gives
// sin((2x)), det((A)), log((8/15)), ((4!))^6. Two shapes occur in the bank:
//   (a) a func/log arg that is exactly ONE paren node (or round delim node), and
//   (b) a sup base whose literal tokens are a single balanced "(" ... ")" group.
// In both cases we must reuse the source's parens instead of adding a layer.
function isParenNode(n) {
  return !!n && typeof n === "object"
    && (n.kind === "paren"
      || (n.kind === "delim" && (n.beg ?? "(") === "(" && (n.end ?? ")") === ")"));
}
function singleParenArg(arr) {
  return Array.isArray(arr) && arr.length === 1 && isParenNode(arr[0]);
}
// Literal-token shape (b): first token "(" must close exactly at the last token —
// a base like ["(","a",")","+","(","b",")"] is NOT self-parenthesized and still needs the wrap.
function selfParenthesized(arr) {
  if (!Array.isArray(arr) || arr.length < 2 || arr[0] !== "(" || arr[arr.length - 1] !== ")") return false;
  let depth = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === "(") depth++;
    else if (arr[i] === ")") { depth--; if (depth === 0 && i < arr.length - 1) return false; }
  }
  return depth === 0;
}

function truthy(v) {
  if (Array.isArray(v)) return v.length > 0;
  if (v === null || v === undefined || v === "") return false;
  return Boolean(v);
}
function pyOr(...vals) {
  for (const v of vals) if (truthy(v)) return v;
  return vals[vals.length - 1];
}

// ---- G4/G9: below-the-operator script helpers ----
function limBelow() {
  return LATEX_CONFIG.limScriptsBelow ? "\\limits" : "";
}
function naryBelow() {
  return LATEX_CONFIG.naryScriptsBelow ? "\\limits" : "";
}
// ---- G9/G10: n-ary / integral operator head ----
// Build "<op>\limits_{sub}^{sup}" and, when naryDisplayStyle is on, wrap it in {\displaystyle …}
// so the SYMBOL is display-size (big ∫/∑ with stacked bounds) while the summand/integrand —
// emitted OUTSIDE this group by the caller — stays text-size (fractions not enlarged).
function naryHead(opCmd, sub, sup) {
  const scripts = (sub ? `_{${sub}}` : "") + (sup ? `^{${sup}}` : "");
  const inner = `${opCmd}${naryBelow()}${scripts}`;
  return LATEX_CONFIG.naryDisplayStyle ? `{\\displaystyle ${inner}}` : inner;
}
// One-sided limits sometimes arrive as a trailing bare sign token (["x","→",frac,"−"],
// 67/17) instead of a proper sup node — attach it as a superscript on the preceding item.
function limScriptItems(items) {
  const a = (items ?? []).slice();
  const last = a[a.length - 1];
  if (a.length >= 2 && typeof last === "string" && /^[+\-−]$/.test(last.trim())) {
    const prev = a[a.length - 2];
    a.splice(a.length - 2, 2, { kind: "sup", base: [prev], sup: [last.trim()] });
  }
  return a;
}

// delimiter char -> LaTeX (left/right aware)
const DELIM = {
  "(": "(", ")": ")", "[": "[", "]": "]", "{": "\\{", "}": "\\}",
  "|": "|", "‖": "\\|", "⌊": "\\lfloor", "⌋": "\\rfloor", "⌈": "\\lceil", "⌉": "\\rceil",
  "⟨": "\\langle", "⟩": "\\rangle",
};

export function convMath(node) {
  const C = LATEX_CONFIG;
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
      return `\\mathrm{${escMathStr(String(node.text ?? ""))}}`;
    case "thai_text":
      return `\\text{${escMathStr(node.text ?? "")}}`;
    case "paren": {
      const body = convItems(node.items ?? []);
      return C.autoSizeDelims ? `\\left(${body}\\right)` : `(${body})`;
    }
    case "delim": {
      const b = DELIM[node.beg ?? "("] ?? (node.beg ?? "(");
      const e = DELIM[node.end ?? ")"] ?? (node.end ?? ")");
      const body = convItems(node.items ?? []);
      return C.autoSizeDelims ? `\\left${b} ${body} \\right${e}` : `${b} ${body} ${e}`;
    }
    case "neg":
      return "-" + convItems(node.items ?? []);
    case "sup": {
      const base = node.base;
      const s = convItems(node.sup ?? []);
      if (multi(base) && C.parenSupMultiBase && !selfParenthesized(base)) {
        const open = C.autoSizeDelims ? "\\left(" : "(";
        const close = C.autoSizeDelims ? "\\right)" : ")";
        return `{${open}${convItems(base ?? [])}${close}}^{${s}}`;
      }
      return `${baseSrc(base)}^{${s}}`;
    }
    case "sub":
      return `${baseSrc(node.base)}_{${convItems(node.sub ?? [])}}`;
    case "sub_sup":
      return `${baseSrc(node.base)}_{${convItems(node.sub ?? [])}}^{${convItems(node.sup ?? [])}}`;
    case "frac":
      return `${C.fracCmd}{${convItems(node.num ?? [])}}{${convItems(node.den ?? [])}}`;
    case "rad":
      if (truthy(node.deg)) return `\\sqrt[${convItems(node.deg)}]{${convItems(node.items ?? [])}}`;
      return `\\sqrt{${convItems(node.items ?? [])}}`;
    case "bar":
      return `${C.barCmd}{${convItems(node.items ?? [])}}`;
    case "acc": {
      const chr = node.chr ?? "→";
      const base = convItems(node.items ?? []);
      if (chr === "^" || chr === "ˆ") return `${C.hatCmd}{${base}}`;
      if (chr === "→" || chr === "⃗") {
        const raw = (node.items ?? []).filter((x) => typeof x === "string").join("");
        if (raw === "i" || raw === "j" || raw === "k") return `${C.unitVectorCmd}{${base}}`;
        return `${C.vectorCmd}{${base}}`;
      }
      return `${C.accentFallbackCmd}{${base}}`;
    }
    case "matrix": {
      const rows = node.rows ?? [];
      const env = node.brackets === "none" ? C.matrixPlainEnv : C.matrixEnv;
      const body = rows.map((row) => row.map((cell) => convItems(cell)).join(" & ")).join(" \\\\ ");
      return `\\begin{${env}}${body}\\end{${env}}`;
    }
    case "func": {
      const name = node.name ?? "f";
      let head;
      if (LATEX_BUILTIN_OP.has(name)) head = `\\${name}`;
      else if (name.length > 1) head = `${C.operatorCmd}{${escMathStr(name)}}`;
      else head = mathToken(name);
      // arg already a paren group -> reuse its parens (else sin((2x)), det((A)))
      if (singleParenArg(node.arg)) return `${head}${convMath(node.arg[0])}`;
      const arg = convItems(node.arg ?? []);
      const open = C.autoSizeDelims ? "\\left(" : "(";
      const close = C.autoSizeDelims ? "\\right)" : ")";
      return `${head}${open}${arg}${close}`;
    }
    case "log": {
      const head = truthy(node.base) ? `\\log_{${convItems(node.base)}}` : "\\log";
      // arg already a paren group -> reuse its parens (else log((8/15)))
      if (singleParenArg(node.arg)) return `${head}${convMath(node.arg[0])}`;
      const arg = convItems(node.arg ?? []);
      const open = C.autoSizeDelims ? "\\left(" : "(";
      const close = C.autoSizeDelims ? "\\right)" : ")";
      return `${head}${open}${arg}${close}`;
    }
    case "lim_low": {
      const base = node.base ?? ["lim"];
      const nm = Array.isArray(base) ? base.map(String).join("") : String(base);
      const head = LATEX_BUILTIN_OP.has(nm) ? `\\${nm}` : `${C.limitsCmd}{${escMathStr(nm)}}`;
      return `${head}${limBelow()}_{${convItems(limScriptItems(node.lim))}}`;
    }
    case "lim": {
      const body = convItems(node.body ?? []);
      if ("lim" in node) return `\\lim${limBelow()}_{${convItems(limScriptItems(node.lim))}} ${body}`;
      const varTok = mathToken(node.var ?? "x");
      const to = String(node.to ?? "");
      let toSrc;
      if (to.endsWith("+") || to.endsWith("-")) {
        toSrc = `${mathToken(to.slice(0, -1))}^{${to.slice(-1)}}`;
      } else {
        toSrc = mathToken(to);
      }
      return `\\lim${limBelow()}_{${varTok} \\to ${toSrc}} ${body}`;
    }
    case "nary": {
      const NARY = { "∑": "\\sum", "∏": "\\prod", "∫": "\\int", "⋃": "\\bigcup", "⋂": "\\bigcap" };
      const chr = node.chr ?? "∑";
      const opCmd = NARY[chr] ?? mathToken(chr);
      const sub = convItems(node.sub ?? []);
      const sup = convItems(node.sup ?? []);
      const body = convItems(node.body ?? []);
      return `${naryHead(opCmd, sub, sup)} ${body}`;
    }
    case "integral": {
      const lo = convItems(pyOr(node.from, node.sub, []));
      const hi = convItems(pyOr(node.to, node.sup, []));
      return `${naryHead("\\int", lo, hi)} ${convItems(node.body ?? [])}`;
    }
    case "binom":
      return `\\binom{${convItems(node.top ?? [])}}{${convItems(node.bottom ?? [])}}`;
    case "cases": {
      // amsmath cases (left brace, align-left) = the owner's approved piecewise look. Each row
      // = "value & <sep> condition". The source is inconsistent — some condition columns start
      // with a ";" (+ optional blank spacer), some rows instead leave a trailing "," on the
      // value — so G5 strips both artifacts and re-emits ONE consistent C.casesSeparator.
      const blank = (t) =>
        typeof t === "string" ? t.trim() === "" : !!(t && t.kind === "upright" && String(t.text ?? "").trim() === "");
      const stripTrailingComma = (arr) => {
        let a = arr.slice();
        while (a.length && typeof a[a.length - 1] === "string" && a[a.length - 1].trim() === ",") a = a.slice(0, -1);
        return a;
      };
      const rows = node.rows ?? [];
      const rowSrcs = rows.map((row) => {
        const cells = row.slice();
        if (cells.length >= 2) {
          let cond = cells[cells.length - 1].slice();
          if (cond.length && typeof cond[0] === "string" && cond[0].trim() === ";") {
            cond = cond.slice(1);
            while (cond.length && blank(cond[0])) cond = cond.slice(1);
          }
          cond = stripTrailingComma(cond);
          const exprSrc = cells.slice(0, -1).map((c) => convItems(stripTrailingComma(c))).join(", ");
          return `${exprSrc} & ${C.casesSeparator}${convItems(cond)}`;
        }
        return cells.map((c) => convItems(c)).join(" & ");
      });
      return `\\begin{cases}${rowSrcs.join(" \\\\ ")}\\end{cases}`;
    }
    default:
      // unknown kind: readable marker (parity with reference "[?{kind}]")
      return `\\text{[?${kind}]}`;
  }
}

// ==================================================================== text/math routing
// -------- G3: math-ish content must be MATH runs (STIX), not Thai-font text runs --------
// latin_text carries two very different things: math tokens (truth values T/F, bare numbers,
// class intervals "35 - 39", "2.28%", "(1)" markers) and true Latin prose ("(Arithmetic
// Mean)", "SDGs"). Only the former belongs in math mode; prose keeps \textrm.
// Math-ish = nothing left after stripping digits/space/punct, or a single UPPERCASE letter
// (T/F/Z/A). Lowercase runs ("i) ", "SDGs") are prose.
function mathishLatin(s) {
  if (!String(s).trim()) return false;
  const rest = String(s).replace(/[0-9\s.,;:%()[\]\-–—/]+/g, "");
  return rest === "" || /^[A-Z]$/.test(rest);
}
function latinTextSrc(text) {
  const s = String(text ?? "");
  if (!mathishLatin(s)) return `\\textrm{${escText(s)}}`;
  // inside math: escape TeX specials, keep spaces visible (math mode eats them)
  const inner = s.replace(/[%#&$]/g, (m) => "\\" + m).replace(/ /g, "\\ ");
  return `$\\mathrm{${inner}}$`;
}

// answer_text is a LITERAL string mixing Thai prose with math tokens ("20√7 ตารางหน่วย",
// "det(A^{-1}B)=det(C)", "~(~p → q)"). Split on spaces; Thai-bearing words stay text runs,
// each non-Thai word becomes its own math run (original spacing preserved verbatim).
const THAI_RE = /[฀-๿]/;
export function mixedTextToLatex(s) {
  return String(s ?? "")
    .split(/( +)/)
    .map((w) => {
      if (!w || /^ +$/.test(w)) return w;
      if (THAI_RE.test(w)) return escText(w);
      return `$${litMathWord(w)}$`;
    })
    .join("");
}
// One literal math word -> LaTeX math. Braces are markup only right after ^/_ (A^{-1});
// elsewhere they are literal set braces ({(x,y)∈R×R:...}). Known operator names (det, sin,
// lim …) get their upright macro; other letter runs stay as-is.
function litMathWord(w) {
  let out = "";
  const stack = []; // per open brace: true = script group (raw), false = literal (escaped)
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    if (ch === "^" || ch === "_") {
      out += ch;
      if (w[i + 1] === "{") { out += "{"; stack.push(true); i++; }
      continue;
    }
    if (ch === "{") { out += "\\{"; stack.push(false); continue; }
    if (ch === "}") { out += stack.pop() ? "}" : "\\}"; continue; }
    out += ESC_MATH[ch] ?? ch;
  }
  return out.replace(/[A-Za-z]{2,}/g, (run) => (LATEX_BUILTIN_OP.has(run) ? `\\${run} ` : run));
}

// ==================================================================== parts
function mathNode(p) {
  return "expr" in p && !("kind" in p) ? p.expr : p;
}
// Render one part inline (no line_break handling — caller splits lines).
function convPartInline(p) {
  if (typeof p === "string") return escText(p);
  const t = p.type;
  if (t === "text") return escText(p.text ?? "");
  if (t === "latin_text") return latinTextSrc(p.text ?? "");
  if (t === "math") return `$${convMath(mathNode(p))}$`;
  if (t === "table") return convTable(p);
  if (t === "label") return escText(p.text ?? "");
  return "";
}
function isBlankPart(p) {
  if (typeof p === "string") return p.trim() === "";
  return p?.type === "text" && String(p.text ?? "").trim() === "";
}
// Short connective glue between equations (และ/แล้ว/,/…). Used only to tell a "math-dominant"
// stack row (math + glue, renders inline) from real prose. (G11)
const LINE_GLUE = /^(?:และ|หรือ|เมื่อ|โดยที่|แต่|กับ|แล้ว|ถ้า|ให้|,|;|:|·|∧|∨|-)$/;
function lineTextOf(p) {
  if (typeof p === "string") return p;
  return p && (p.type === "text" || p.type === "latin_text") ? String(p.text ?? "") : "";
}
// A rendered line that is ONLY math (>=1 math, nothing else non-blank) — the display-eq candidate.
function isMathOnlyLine(line) {
  const nb = line.filter((p) => !isBlankPart(p));
  const m = nb.filter((p) => p && p.type === "math");
  return m.length >= 1 && m.length === nb.length;
}
// A line that is math plus only glue words (e.g. "B = {...} และ") — renders inline-left, and a
// lone math-only neighbor should align with it rather than center. (G11)
function isMathDomLine(line) {
  const nb = line.filter((p) => !isBlankPart(p));
  const m = nb.filter((p) => p && p.type === "math");
  const t = nb.filter((p) => p && (p.type === "text" || p.type === "latin_text"));
  return m.length >= 1 && t.length > 0 && m.length + t.length === nb.length && t.every((p) => LINE_GLUE.test(lineTextOf(p).trim()));
}
// A line_break part that forces a real line boundary. A "soft"-typed break (with the knob on)
// does NOT: it flows as an ordinary space so TeX wraps the run naturally. A "hard" break or one
// with no `break` field (legacy) is always a boundary. (line_break typing, 2026-07-17)
function isBreakBoundary(p) {
  if (!(p && p.type === "line_break")) return false;
  if (LATEX_CONFIG.honorSoftBreaks && p.break === "soft") return false;
  return true;
}

export function convParts(parts) {
  const list = parts ?? [];
  if (!LATEX_CONFIG.displayLoneMathLines) {
    // legacy: everything inline, hard break -> "\\", soft break -> a flowing space
    return list
      .map((p) => (p && p.type === "line_break" ? (isBreakBoundary(p) ? " \\\\\n" : " ") : convPartInline(p)))
      .join("");
  }
  // Split into lines at each BOUNDARY break; a soft break instead injects a space so its two
  // sides stay on one (wrappable) line. A line that is MATH-ONLY (>=1 math, no other non-blank
  // content) becomes a centered display equation; other lines render inline. (G7 item 12)
  const lines = [[]];
  for (const p of list) {
    if (p && p.type === "line_break") {
      if (isBreakBoundary(p)) lines.push([]);
      else lines[lines.length - 1].push({ type: "text", text: " " });
    } else lines[lines.length - 1].push(p);
  }
  // Only a genuine MULTI-line block can hold a standalone display equation. A single-line
  // parts array (a choice like "$2$", a one-line stem, a solution step) always renders inline —
  // otherwise every lone-math choice would be blown up into a centered display. (Guard for the
  // regression found in G7: choice "$2$" -> "\[\displaystyle 2\]".) Render the PROCESSED line
  // (soft breaks already flattened to spaces), not the raw list, so a stem whose only break was
  // soft still gets that flowing space instead of an empty raw line_break part. (q5)
  if (lines.length === 1) return lines[0].map(convPartInline).join("");
  // Classify each line once so the display decision can see its neighbors (G11).
  const cls = lines.map((line) => (isMathOnlyLine(line) ? "mathonly" : isMathDomLine(line) ? "mathdom" : "other"));
  const rendered = lines.map((line, i) => {
    const maths = line.filter((p) => p && p.type === "math");
    const others = line.filter((p) => !(p && p.type === "math") && !isBlankPart(p));
    if (maths.length >= 1 && others.length === 0) {
      // G11: a lone math-only line wedged next to an inline math-dominant sibling is one row of a
      // left-aligned definition stack (q01 C={...}) — keep it inline-left. A math-only line in a
      // >=2 math-only RUN (a real system) or among prose (a standalone block) still centers.
      const runNeighbor = cls[i - 1] === "mathonly" || cls[i + 1] === "mathonly";
      const domNeighbor = cls[i - 1] === "mathdom" || cls[i + 1] === "mathdom";
      const stackRow = LATEX_CONFIG.stackRowMathInline && !runNeighbor && domNeighbor;
      if (!stackRow) {
        return { display: true, src: maths.map((p) => `\\[\\displaystyle ${convMath(mathNode(p))}\\]`).join("\n") };
      }
    }
    return { display: false, src: line.map(convPartInline).join("") };
  });
  // Join lines: a display block already breaks vertically, so it needs no "\\"; between two
  // inline lines emit "\\".
  let s = "";
  for (let i = 0; i < rendered.length; i++) {
    if (i === 0) { s += rendered[i].src; continue; }
    const glue = rendered[i - 1].display || rendered[i].display ? "\n" : " \\\\\n";
    s += glue + rendered[i].src;
  }
  return s;
}

// Scale fixed column widths (inches) down so the whole tabular — columns plus the
// 2×\tabcolsep padding each column adds — fits the text block (G2: 66/06 and 68/22
// ran past the margin). Never scales up; tables that already fit pass through untouched.
export function fitTableWidths(widths, ncols) {
  const C = LATEX_CONFIG;
  const sum = widths.reduce((a, b) => a + b, 0);
  const avail = C.tableMaxWidthIn - ncols * 2 * C.tableColSepIn;
  if (sum <= avail) return widths;
  const scale = avail / sum;
  // floor at 3 decimals — rounding up could nudge the total back over the budget
  return widths.map((w) => Math.floor(w * scale * 1000) / 1000);
}

export function convTable(p) {
  const rows = p.rows ?? [];
  const ncols = rows.length ? Math.max(...rows.map((r) => r.length)) : 1;
  const widths = p.widths;
  // column spec, ONE entry per column: fixed widths (inches) -> m{w in} (vertically
  // centered, G6; needs the array package in the preamble); else centered c.
  // Keep it as an array and join with "|" so multi-char specs like "m{0.95in}" stay intact —
  // a char-level split("") would shatter "m{0.95in}" into "m|{|0|.|9|5|i|n|}" (illegal array arg,
  // which silently truncated any doc containing a width-table; found in Stage 6.5).
  const pre = LATEX_CONFIG.tableColPrefix ? `>{${LATEX_CONFIG.tableColPrefix}}` : "";
  const colArr = truthy(widths)
    ? fitTableWidths(widths, ncols).map((w) => `${pre}${LATEX_CONFIG.tableColType}{${w}in}`)
    : Array(ncols).fill("c");
  const colspec = "|" + colArr.join("|") + "|";
  const body = rows
    .map((row) => {
      const cells = row.map((cell) => convParts(cell));
      while (cells.length < ncols) cells.push("");
      return cells.join(" & ");
    })
    .join(" \\\\\n\\hline\n");
  return `\n\\begin{center}\n\\begin{tabular}{${colspec}}\n\\hline\n${body} \\\\\n\\hline\n\\end{tabular}\n\\end{center}\n`;
}
