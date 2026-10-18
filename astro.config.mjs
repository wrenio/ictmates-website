import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://ictmates.com',
  output: 'static',
  // Preserve the recovered design's HTML whitespace behavior on Astro 7.
  compressHTML: true,
});
