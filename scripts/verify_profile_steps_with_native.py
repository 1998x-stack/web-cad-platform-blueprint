#!/usr/bin/env python3
"""Independently re-import every CAD-007 polygon STEP with native OCCT (cadquery-ocp).

For each `<name>.step` + `<name>.evidence.json` produced by the real WASM Worker
(`PROFILE_STEP_OUTPUT_DIR=... npm run test:profile-wasm`) this script:

1. verifies the recorded SHA256 against the actual bytes,
2. imports the STEP in a *separate native* OCP process/writer-independent reader,
3. rebuilds an equivalent native prism from the same polygon (independent oracle),
4. compares volume / surface area / bbox / solid / face counts within the repo tolerances,
5. runs fail-closed negatives (truncated STEP, self-intersecting native wire).

Raw STEP bytes stay local; only the numeric report and hashes belong in evidence/.
"""
from __future__ import annotations

import json
import sys
from hashlib import sha256
from pathlib import Path

from cad_geometry.kernel import (
    GeometryError,
    compare_evidence,
    evidence,
    import_step,
)
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeEdge, BRepBuilderAPI_MakeFace, BRepBuilderAPI_MakeWire
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepPrimAPI import BRepPrimAPI_MakePrism
from OCP.gp import gp_Pnt, gp_Vec


def build_native_prism(points, depth):
    """Independent native oracle: closed polygon on XY extruded along +Z."""
    wire_builder = BRepBuilderAPI_MakeWire()
    n = len(points)
    for i in range(n):
        a, b = points[i], points[(i + 1) % n]
        wire_builder.Add(BRepBuilderAPI_MakeEdge(gp_Pnt(a[0], a[1], 0.0), gp_Pnt(b[0], b[1], 0.0)).Edge())
    face = BRepBuilderAPI_MakeFace(wire_builder.Wire()).Face()
    return BRepPrimAPI_MakePrism(face, gp_Vec(0, 0, depth)).Shape()


def check_profile(out_dir: Path, name: str) -> dict:
    step_path = out_dir / f"{name}.step"
    meta = json.loads((out_dir / f"{name}.evidence.json").read_text())
    raw = step_path.read_bytes()
    digest = sha256(raw).hexdigest()
    if digest != meta["step"]["sha256"] or len(raw) != meta["step"]["bytes"]:
        raise GeometryError(f"{name}: STEP hash/size does not match recorded evidence")

    imported = evidence(import_step(step_path))
    oracle = evidence(build_native_prism(meta["pointsMm"], meta["extrusionDepthMm"]))
    comparison = compare_evidence(oracle, imported)
    expected = float(meta["expectedVolumeMm3"])
    vol_delta = abs(imported.volume_mm3 - expected)
    if vol_delta > 1e-3:
        raise GeometryError(f"{name}: imported volume {imported.volume_mm3} vs expected {expected} (Δ={vol_delta})")
    if imported.solids != 1 or not imported.valid:
        raise GeometryError(f"{name}: imported STEP is not one valid solid")
    expected_faces = len(meta["pointsMm"]) + 2  # side faces + 2 caps
    return {
        "profile": name,
        "stepSha256": digest,
        "stepBytes": len(raw),
        "nativeImported": vars(imported),
        "nativeOracle": vars(oracle),
        "wasmReportedVolumeMm3": meta["wasmEvidence"]["volumeMm3"],
        "expectedVolumeMm3": expected,
        "volumeDeltaVsExpectedMm3": vol_delta,
        "isoFaceCountMatchesTheory": imported.faces == expected_faces,
        "comparison": comparison,
        "passed": bool(imported.valid and imported.solids == 1 and imported.volume_mm3 > 0 and imported.faces == expected_faces),
    }


def negative_cases(out_dir: Path) -> dict:
    results = {}
    good = (out_dir / "triangle.step")
    if not good.is_file():
        raise GeometryError("negative cases require triangle.step to exist")
    text = good.read_text()

    truncated = out_dir / "triangle.truncated.step"
    truncated.write_text(text[: max(40, len(text) // 3)])  # valid header, severed body
    try:
        import_step(truncated)
        results["truncatedStep"] = "FAIL_OPEN"
    except GeometryError as exc:
        results["truncatedStep"] = f"FAIL_CLOSED: {exc}"

    corrupt = out_dir / "triangle.corrupt.step"
    corrupt.write_text(text.replace("CARTESIAN_POINT", "NOT_A_KEYWORD"))
    try:
        import_step(corrupt)
        results["corruptKeywordsStep"] = "FAIL_OPEN"
    except GeometryError as exc:
        results["corruptKeywordsStep"] = f"FAIL_CLOSED: {exc}"

    # Self-intersecting (bow-tie) wire: native face construction must not yield a valid solid.
    bowtie = [[0, 0], [4, 4], [0, 4], [4, 0]]
    try:
        shape = build_native_prism(bowtie, 10)
        results["selfIntersectingNativeFace"] = "VALID" if BRepCheck_Analyzer(shape).IsValid() else "FAIL_CLOSED: invalid shape"
    except Exception as exc:  # noqa: BLE001 - OCCT raises Standard_Failure subclasses
        results["selfIntersectingNativeFace"] = f"FAIL_CLOSED: {type(exc).__name__}"

    results["allFailClosed"] = all(str(v).startswith("FAIL_CLOSED") for k, v in results.items() if k != "allFailClosed")
    return results


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: verify_profile_steps_with_native.py <step-dir> [report.json]", file=sys.stderr)
        return 2
    out_dir = Path(sys.argv[1]).resolve()
    report = {"nativeBinding": "cadquery-ocp", "components": []}
    ok = True
    for name in ("triangle", "rotated", "concave"):
        entry = check_profile(out_dir, name)
        report["components"].append(entry)
        ok = ok and entry["passed"]
    report["negatives"] = negative_cases(out_dir)
    ok = ok and report["negatives"]["allFailClosed"]
    report["passed"] = bool(ok)
    if len(sys.argv) >= 3:
        Path(sys.argv[2]).write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
