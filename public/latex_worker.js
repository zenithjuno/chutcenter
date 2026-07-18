// chutcenter LaTeX migration — Stage 3 reusable BusyTeX worker.
//
// Mounts the trimmed texmf set ONCE (in the pipeline's on_initialized hook) and then
// serves many compile() calls on the SAME emscripten Module. BusyTeX's compile() only
// remounts its work dir (project_dir) each call — the injected texmf lives at root paths
// and survives, so warm compiles skip the ~1080-file mount entirely.
//
// Assets are handed in by the main thread (latex_compiler.js), which owns the IndexedDB
// cache: busytex.wasm arrives as a blob: URL, the trimmed texmf as a raw pack.bin buffer,
// and the two fonts as buffers. This worker never fetches the big assets itself.
//
// Message protocol:
//   in : { type:'init', engineBase, wasmUrl, pack:ArrayBuffer, font:ArrayBuffer, stix:ArrayBuffer }
//   out: { type:'ready' }
//   in : { type:'compile', id, tex }
//   out: { type:'result', id, exit_code, ms, pdf:ArrayBuffer, logTail }
//   out: { type:'error', where, id?, msg }
//   out: { type:'log', msg }              (diagnostic, buffered — never streamed to UI)

let pipeline = null;
let ready = null; // resolves once texmf is mounted
let FONT = null, STIX = null;

function post(m, transfer) { postMessage(m, transfer || []); }
function log(...a) { post({ type: 'log', msg: a.join(' ') }); }

function mkdirp(FS, absPath) {
  const parts = absPath.split('/').filter(Boolean);
  let cur = '';
  for (let i = 0; i < parts.length - 1; i++) {
    cur += '/' + parts[i];
    try { FS.mkdir(cur); } catch (e) { /* EEXIST ok */ }
  }
}

// pack.bin = [8-byte LE header length][JSON [{p,o,l}]][concatenated file bytes]
function unpack(ab) {
  const dv = new DataView(ab);
  const hlen = Number(dv.getBigUint64(0, true));
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 8, hlen)));
  const base = 8 + hlen;
  return header.map((e) => ['/' + e.p, new Uint8Array(ab, base + e.o, e.l)]);
}

async function init(d) {
  importScripts(d.engineBase + 'busytex_pipeline.js');
  FONT = new Uint8Array(d.font);
  STIX = new Uint8Array(d.stix);
  const files = unpack(d.pack);
  log('unpacked trimmed texmf:', files.length, 'files');

  let resolveReady;
  ready = new Promise((r) => (resolveReady = r));

  pipeline = new BusytexPipeline(
    d.engineBase + 'busytex.js',
    d.wasmUrl,            // blob: URL backed by the IndexedDB-cached wasm bytes
    [], [], [],           // NO data packages — the trimmed pack replaces them
    () => {},             // print sink: swallow kpathsea debug (never stream to DOM)
    async () => {
      // on_initialized: the module is up but empty of texmf. Inject the trimmed set once.
      const Module = await pipeline.Module;
      const FS = Module.FS;
      // kpathsea locates texmf relative to /bin/busytex; with no data bundle that dir is
      // absent → "Can't get directory of program name". Create it.
      try { FS.mkdir('/bin'); } catch (e) {}
      try { FS.writeFile('/bin/busytex', new Uint8Array(0)); } catch (e) {}
      for (const [abs, buf] of files) { mkdirp(FS, abs); FS.writeFile(abs, buf); }
      log('mounted texmf into MEMFS (once)');
      resolveReady();
    },
    true,                 // preload=true → keep Module (and MEMFS) alive across compiles
    BusytexPipeline.ScriptLoaderWorker,
  );

  await ready;
  post({ type: 'ready' });
}

async function compile(d) {
  await ready;
  const t0 = performance.now();
  // Fonts go in as compile inputs every call: compile() wipes the work dir each time,
  // but the texmf roots (injected once) persist.
  const result = await pipeline.compile(
    [
      { path: 'main.tex', contents: d.tex },
      { path: 'THSarabunNew-Regular.ttf', contents: FONT },
      { path: 'STIXTwoMath-Regular.ttf', contents: STIX },
    ],
    'main.tex', false, 'silent', 'xetex_bibtex8_dvipdfmx', [],
  );
  const ms = Math.round(performance.now() - t0);
  const pdf = result.pdf && result.pdf.length ? result.pdf : new Uint8Array();
  const buf = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
  // The busytex pipeline's exit_code reflects the LAST step (xdvipdfmx), so a XeLaTeX run
  // that errored out mid-document (exit 1, partial .xdv) still surfaces as exit_code 0 →
  // the app would ship a SILENTLY TRUNCATED PDF instead of falling back to Typst (found in
  // Stage 6.5). Treat any TeX error line ("! ...") in the log as a hard failure so the
  // compiler rejects and the Typst airbag takes over. Warnings ("... Warning:") don't match.
  const logStr = String(result.log || '');
  const texError = /(^|\n)! /.test(logStr);
  const exit_code = (result.exit_code && result.exit_code !== 0) ? result.exit_code : (texError ? 1 : 0);
  post(
    { type: 'result', id: d.id, exit_code, ms, pdf: buf, logTail: logStr.slice(-2000) },
    [buf],
  );
}

onmessage = (ev) => {
  const d = ev.data || {};
  if (d.type === 'init') init(d).catch((e) => post({ type: 'error', where: 'init', msg: String((e && e.stack) || e) }));
  else if (d.type === 'compile') compile(d).catch((e) => post({ type: 'error', where: 'compile', id: d.id, msg: String((e && e.stack) || e) }));
};
