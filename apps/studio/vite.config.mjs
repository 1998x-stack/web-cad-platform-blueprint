import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const repo=fileURLToPath(new URL('../../',import.meta.url));
export default defineConfig({
  root,
  server:{host:'127.0.0.1',port:4173,strictPort:true,fs:{allow:[repo]}},
  optimizeDeps:{exclude:['occt-wasm','@salusoft89/planegcs']},
  worker:{format:'es'},
  build:{rollupOptions:{input:{main:resolve(root,'index.html'),sketch:resolve(root,'sketch.html'),profile:resolve(root,'profile.html')}},target:'esnext',outDir:fileURLToPath(new URL('../../dist/studio',import.meta.url)),emptyOutDir:true},
});
