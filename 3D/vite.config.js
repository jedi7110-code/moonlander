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
    // Read by the opening-film prefetch worker to warm the cabin's chunks.
    manifest: 'assets/obs-manifest.json',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./src/index.html', import.meta.url)),
        obs: fileURLToPath(new URL('./src/obs.html', import.meta.url)),
        curtisStudy: fileURLToPath(new URL('./src/curtis-study.html', import.meta.url)),
        shipExteriorStudy: fileURLToPath(new URL('./src/ship-exterior-study.html', import.meta.url)),
        shipExteriorCinema: fileURLToPath(new URL('./src/ship-exterior-cinema.html', import.meta.url)),
        exteriorShotStudy: fileURLToPath(new URL('./src/exterior-shot-study.html', import.meta.url)),
        exteriorSceneCatalog: fileURLToPath(new URL('./src/exterior-scene-catalog.html', import.meta.url)),
        exteriorCraftStudy: fileURLToPath(new URL('./src/exterior-craft-study.html', import.meta.url)),
        exteriorPlanetStudy: fileURLToPath(new URL('./src/exterior-planet-study.html', import.meta.url)),
        exteriorSunriseStudy: fileURLToPath(new URL('./src/exterior-sunrise-study.html', import.meta.url)),
        exteriorFlareStudy: fileURLToPath(new URL('./src/exterior-flare-study.html', import.meta.url)),
        cabinAudioStudy: fileURLToPath(new URL('./src/cabin-audio-study.html', import.meta.url)),
        emergencyLightingStudy: fileURLToPath(new URL('./src/emergency-lighting-study.html', import.meta.url)),
        ladderStructureStudy: fileURLToPath(new URL('./src/ladder-structure-study.html', import.meta.url)),
        sofaStudy: fileURLToPath(new URL('./src/sofa-study.html', import.meta.url)),
        loungeSmokingStudy: fileURLToPath(new URL('./src/lounge-smoking-study.html', import.meta.url)),
        loungeGamesStudy: fileURLToPath(new URL('./src/lounge-games-study.html', import.meta.url)),
        chessPieceStudy: fileURLToPath(new URL('./src/chess-piece-study.html', import.meta.url)),
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
