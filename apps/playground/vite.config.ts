import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const packageSource = (file: string) =>
  fileURLToPath(new URL(`../../packages/chat-typography/src/${file}`, import.meta.url));

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: '/',
  resolve: {
    dedupe: ['react', 'react-dom'],
    // The dev server edits the engine in place; builds keep the published dist entry points.
    alias:
      command === 'serve'
        ? [
            {
              find: /^@calebduren\/typograph\/hanging\.css$/,
              replacement: packageSource('hanging.css'),
            },
            { find: /^@calebduren\/typograph\/hanging$/, replacement: packageSource('hanging.ts') },
            { find: /^@calebduren\/typograph\/static$/, replacement: packageSource('static.ts') },
            { find: /^@calebduren\/typograph$/, replacement: packageSource('index.ts') },
          ]
        : [],
  },
  optimizeDeps: { include: ['streamdown'] },
  build: { sourcemap: true, manifest: true },
  server: { port: 4173 },
}));
