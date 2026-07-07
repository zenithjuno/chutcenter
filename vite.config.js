import { defineConfig } from 'vite';
import { writeFileSync } from 'node:fs';

// dev-only middleware: browser POSTs the compiled PDF bytes to /__save so the harness can
// inspect the exact in-browser output. Not shipped to production.
const savePdfPlugin = {
  name: 'save-pdf',
  configureServer(server) {
    server.middlewares.use('/__save', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        writeFileSync('.browser-out.pdf', Buffer.concat(chunks)); // cwd = web/app (gitignored)
        res.setHeader('access-control-allow-origin', '*');
        res.end('saved ' + Buffer.concat(chunks).length);
      });
    });
  },
};

export default defineConfig({
  server: { port: 5187, host: '127.0.0.1' },
  optimizeDeps: { exclude: ['@myriaddreamin/typst-ts-web-compiler', '@myriaddreamin/typst-ts-renderer'] },
  plugins: [savePdfPlugin],
});
