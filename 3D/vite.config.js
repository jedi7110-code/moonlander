import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import {storyPreview} from './story-preview.js';

export default defineConfig({
  plugins:[storyPreview()],
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
        cabinAudioStudy: fileURLToPath(new URL('./src/cabin-audio-study.html', import.meta.url)),
        sofaStudy: fileURLToPath(new URL('./src/sofa-study.html', import.meta.url)),
        galleyStudy: fileURLToPath(new URL('./src/galley-study.html', import.meta.url)),
        hatchRepairStudy: fileURLToPath(new URL('./src/hatch-repair-study.html', import.meta.url)),
        hatchDoorStudy: fileURLToPath(new URL('./src/hatch-door-study.html', import.meta.url)),
        gateFrameStudy: fileURLToPath(new URL('./src/gate-frame-study.html', import.meta.url)),
        equipmentLabelStudy: fileURLToPath(new URL('./src/equipment-label-study.html', import.meta.url)),
        servicePartsStudy: fileURLToPath(new URL('./src/service-parts-study.html', import.meta.url)),
      },
      output: { manualChunks: { three: ['three'] } },
    },
  },
});
