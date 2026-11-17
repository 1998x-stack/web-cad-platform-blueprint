# apps/studio — planned app boundary

Future React + Vite + TypeScript CAD Studio and 3D Model Gallery. Not implemented in this blueprint.

Intended modules: `app/`, `features/{catalog,sketch,modeling,history,export,agent-review}/`, `viewport/`, `components/`.

UI must communicate through `cad-core` commands and `cad-geometry` worker; Three.js scene is not the authoritative CAD document. See docs/04 and docs/11.
