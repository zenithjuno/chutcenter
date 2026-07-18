// chutcenter LaTeX migration — Stage 3 main-thread wrapper around the BusyTeX worker.
//
// Single API: `const c = new LatexCompiler(); await c.init(); const pdf = await c.compile(tex);`
// - init() spins up ONE worker, mounts the trimmed texmf once, and reuses it.
// - The big assets (busytex.wasm ~29MB, texmf.pack ~22.65MB) are cached in IndexedDB, so a
//   page reload reads them from disk instead of re-downloading (cache hit).
// - compile(tex) → Uint8Array (PDF bytes). Loud failure on a non-zero exit → the caller
//   (Stage 4) falls back to Typst.
// State is observable via `c.status` ('idle'|'init'|'ready'|'busy'|'error') and c.onstatus.

const BASE = import.meta.env.BASE_URL;               // e.g. '/chutcenter/'
const ENGINE = BASE + 'engine/';
const DB_NAME = 'chutcenter-latex';
const STORE = 'assets';
// Bump when the vendored engine/pack changes so stale bytes are not served from cache.
const ASSET_VERSION = 'busytex-tl2023-trim1';

// ---- tiny IndexedDB blob cache (key -> ArrayBuffer) ----
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    tx.onsuccess = () => resolve(tx.result || null);
    tx.onerror = () => reject(tx.error);
  });
}
async function idbSet(key, val) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Return {buf, hit}: cached ArrayBuffer if present, else fetch + store. `hit` says whether
// it came from the cache (no network) — used to prove the reload cache-hit in the bench.
async function cachedAsset(url, key) {
  const vkey = ASSET_VERSION + ':' + key;
  const cached = await idbGet(vkey);
  if (cached) return { buf: cached, hit: true };
  const buf = await (await fetch(url)).arrayBuffer();
  try { await idbSet(vkey, buf); } catch (e) { /* quota etc — degrade to no-cache */ }
  return { buf, hit: false };
}

export class LatexCompiler {
  constructor() {
    this.worker = null;
    this.status = 'idle';
    this.onstatus = null;
    this._seq = 0;
    this._pending = new Map();   // id -> {resolve, reject}
    this._readyResolve = null;
    this._readyReject = null;
    this.lastCacheHits = null;   // {wasm, pack} booleans from the last init()
  }

  _set(s) { this.status = s; if (this.onstatus) this.onstatus(s); }

  async init() {
    if (this.status === 'ready' || this.status === 'busy') return;
    this._set('init');
    // Assets: wasm + pack (cached, big) and the two fonts (small, fetched fresh).
    const [wasm, pack, font, stix] = await Promise.all([
      cachedAsset(ENGINE + 'busytex.wasm', 'wasm'),
      cachedAsset(ENGINE + 'texmf.pack', 'pack'),
      fetch(BASE + 'fonts/THSarabunNew-Regular.ttf').then((r) => r.arrayBuffer()),
      fetch(BASE + 'fonts/STIXTwoMath-Regular.ttf').then((r) => r.arrayBuffer()),
    ]);
    this.lastCacheHits = { wasm: wasm.hit, pack: pack.hit };
    const wasmUrl = URL.createObjectURL(new Blob([wasm.buf], { type: 'application/wasm' }));

    this.worker = new Worker(BASE + 'latex_worker.js');
    this.worker.onmessage = (ev) => this._onmessage(ev.data);
    this.worker.onerror = (e) => this._fail(new Error('worker error: ' + (e.message || e.filename)));

    const ready = new Promise((res, rej) => { this._readyResolve = res; this._readyReject = rej; });
    // pack/font/stix are transferable (consumed by the worker) — wasm goes as a blob URL.
    this.worker.postMessage(
      { type: 'init', engineBase: ENGINE, wasmUrl, pack: pack.buf, font, stix },
      [pack.buf, font, stix],
    );
    await ready;
    this._set('ready');
  }

  _onmessage(d) {
    if (d.type === 'ready') { if (this._readyResolve) this._readyResolve(); }
    else if (d.type === 'result') {
      const p = this._pending.get(d.id);
      if (!p) return;
      this._pending.delete(d.id);
      if (this._pending.size === 0 && this.status === 'busy') this._set('ready');
      if (d.exit_code === 0 && d.pdf && d.pdf.byteLength) {
        p.resolve({ pdf: new Uint8Array(d.pdf), ms: d.ms });
      } else {
        p.reject(new Error(`LaTeX compile failed (exit ${d.exit_code}); log tail:\n` + (d.logTail || '')));
      }
    } else if (d.type === 'error') {
      if (d.where === 'init') this._fail(new Error('LaTeX init failed: ' + d.msg));
      else if (d.id != null) {
        const p = this._pending.get(d.id);
        if (p) { this._pending.delete(d.id); p.reject(new Error('LaTeX compile error: ' + d.msg)); }
      }
    }
    // 'log' messages are diagnostics only — ignored here.
  }

  _fail(err) {
    this._set('error');
    if (this._readyReject) this._readyReject(err);
    for (const { reject } of this._pending.values()) reject(err);
    this._pending.clear();
  }

  // Returns { pdf: Uint8Array, ms }. Rejects loudly on compile failure.
  compile(tex) {
    if (!this.worker || (this.status !== 'ready' && this.status !== 'busy')) {
      return Promise.reject(new Error('LatexCompiler not initialized'));
    }
    const id = ++this._seq;
    this._set('busy');
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'compile', id, tex });
    });
  }

  terminate() {
    if (this.worker) { this.worker.terminate(); this.worker = null; }
    this._set('idle');
  }
}
