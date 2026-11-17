#!/usr/bin/env python3
"""Independently import the JS occt-wasm STEP using native OCCT and compare to baseline."""
import json
import sys
from pathlib import Path
from cad_geometry.kernel import import_step, evidence, build, compare_evidence

root=Path(__file__).resolve().parents[1]
path=Path(sys.argv[1]).resolve()
if not path.is_file() or path.stat().st_size<100:
    raise SystemExit('WASM STEP output is absent or empty')
doc=json.loads((root/'samples/precision-block.cad.json').read_text())
expected=evidence(build(doc))
wasm_imported=evidence(import_step(path))
comparison=compare_evidence(expected,wasm_imported)
print(json.dumps({'nativeImportedWasmStep':True,'source':vars(expected),'wasmImported':vars(wasm_imported),'compare':comparison},indent=2))
