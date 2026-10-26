import { defineConfig } from 'vitest/config';

// Dipisah dari vite.config.ts supaya tipe plugin Vite 8 tidak bentrok dengan Vite bawaan Vitest.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
