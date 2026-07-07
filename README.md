# chutcenter

Free exam-question PDFs, compiled **entirely in your browser** via [typst.ts](https://github.com/Myriad-Dreamin/typst.ts) —
no server render, no upload, fonts embedded (TH Sarabun New + STIX Two Math).

This is the Stage 7 technical proof: compiles one real question (2559, ข้อ 20) to a PDF live in
the browser and lets you download it. The full filter UI (choose topic/source/year, generate a
custom question set) is the next stage.

## Run locally

```sh
npm install
npm run dev
```

## Deploy

Static build (`npm run build` → `dist/`), deployable to Cloudflare Pages / GitHub Pages / any
static host. No backend required — the WASM compiler and fonts are served as static assets.
