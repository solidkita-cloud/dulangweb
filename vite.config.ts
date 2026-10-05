import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'dulang-wa-bridge',
      configureServer(server) {
        server.middlewares.use('/api/wa-order', (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body || '{}');
                // Broadcast to all connected browser clients via Vite HMR WebSocket
                server.ws.send({
                  type: 'custom',
                  event: 'dulang:wa-incoming-order',
                  data: payload,
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Disinkronkan ke DULANG-3 browser!' }));
              } catch (err: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
          }
        });

        server.middlewares.use('/api/wa-stock', (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body || '{}');
                server.ws.send({
                  type: 'custom',
                  event: 'dulang:wa-stock-updated',
                  data: payload,
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Stok disinkronkan ke DULANG-3 browser!' }));
              } catch (err: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
          }
        });
      },
    },
  ],
  server: {
    port: 3001,
    host: true,
    open: false,
    watch: {
      ignored: ['**/BAHAN/**', '**/EVALUASI/**', '**/*.zip'],
    },
  },
});
