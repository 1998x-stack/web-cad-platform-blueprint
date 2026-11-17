import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const repo=fileURLToPath(new URL('../../',import.meta.url));
export default defineConfig({
  root,
  server:{host:'127.0.0.1',port:4173,strictPort:true,fs:{allow:[repo]}},
  optimizeDeps:{exclude:['occt-wasm']},\n  worker:{format:'es'}, // occt-wasm uses code-splitting ES modules; Vite's default iife fails
  build:{target:'esnext',outDir:fileURLToPath(new URL('../../dist/studio',import.meta.url)),emptyOutDir:true},
});
