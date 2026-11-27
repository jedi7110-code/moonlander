import {fileURLToPath} from 'node:url';
const path = relative => fileURLToPath(new URL(relative, import.meta.url));
export default {
  root: path('../../'),
  publicDir: path('../../../obs/public'),
  cacheDir: path('../../output/curtis-infection-vite-cache'),
  resolve: {alias: [
    {find: 'three/addons', replacement: path('../../../obs/node_modules/three/examples/jsm')},
    {find: /^three$/, replacement: path('../../../obs/node_modules/three/build/three.module.js')},
  ]},
  server: {host: '127.0.0.1', port: 5186, strictPort: true, fs: {allow: [path('../../../')]}},
  build: {outDir: path('../../output/curtis-infection-preview'), emptyOutDir: true, copyPublicDir: false,
    rollupOptions: {input: path('./index.html')}},
};
