import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://webstore.pk',
  output: 'static',
  compressHTML: true,
  devToolbar: { enabled: false },
});
