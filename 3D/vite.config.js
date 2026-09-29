import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: 'src',
  base: '/3D/',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./src/index.html', import.meta.url)),
        obs: fileURLToPath(new URL('./src/obs.html', import.meta.url)),
        sofaStudy: fileURLToPath(new URL('./src/sofa-study.html', import.meta.url)),
        gateFrameStudy: fileURLToPath(new URL('./src/gate-frame-study.html', import.meta.url)),
      },
      output: { manualChunks: { three: ['three'] } },
    },
  },
});
