# OCCT native geometry spike (CAD-004/CAD-005)

**Status:** runnable native OCCT (cadquery-ocp) reference implementation, not yet a browser WebAssembly worker. The purpose is an independent precise B-Rep oracle for the future WASM adapter and STEP converter. No Three.js preview or persistent CAD editor here.

## Install and run

Use Python 3.11–3.13 (supported binary wheel required) and `pip install -e '.[test]'`; pin `cadquery-ocp==7.9.3.1.1`.

```sh
python -m cad_geometry.cli run samples/precision-block.cad.json --step /tmp/precision-block.step --report /tmp/precision-block.json
python -m pytest packages/cad-geometry-python/tests -q
```

From the repository root without editable install:

```sh
PYTHONPATH=packages/cad-geometry-python/src python -m cad_geometry.cli run samples/precision-block.cad.json --step /tmp/precision-block.step --report /tmp/precision-block.json
PYTHONPATH=packages/cad-geometry-python/src python -m unittest discover -s packages/cad-geometry-python/tests -v
```

The CLI validates unique feature IDs and dependency order, rejects unsupported operations, evaluates real OCCT B-Rep, checks validity and solid count, exports real ISO 10303 STEP, and imports the file **into a separate fresh STEPControl_Reader** for tolerance comparisons. The JSON report records SHA-256 and OCCT binding version.

**Explicit limitations:** only box, axial Z cylinder, boolean cut/union/intersect and mm are supported by this spike; no sketch solver, parameterized extrusion, persistent topology naming, STEP assembly metadata, browser WASM, or transactional service. Do not load untrusted CAD/STEP in the web process; a sandboxed worker is required for production.

See [validation evidence](../../docs/19-cad-004-005-evidence.md).
