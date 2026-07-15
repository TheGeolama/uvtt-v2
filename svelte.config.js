import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // Essential for Client-Side SPA routing on static hosts like GitHub Pages
      fallback: 'index.html' 
    }),
    alias: {
      '$lib': './src/lib',
      '$components': './src/lib/components',
      '$stores': './src/lib/stores',
      '$utils': './src/lib/utils',
      '$src': './src'
    },
    paths: {
      // Explicitly define the base path for GitHub Pages production deployments
      base: process.env.NODE_ENV === 'production' ? '/uvtt-v2-upgrader' : ''
    }
  }
};

export default config;