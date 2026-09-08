import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: '/3D/',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
