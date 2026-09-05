import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      additionalExports: {
        CallSession: 'DurableObject',
        UserSession: 'DurableObject',
      },
      miniflare: { compatibilityDate: '2026-09-06' },
    }),
  ],
});
