import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Dev proxy: forwards API calls to the local Worker so the browser never hits
// CORS. `VITE_API_BASE_URL` can be set to override the same-origin default.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/health': 'http://localhost:8787',
      '/v1': 'http://localhost:8787',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
