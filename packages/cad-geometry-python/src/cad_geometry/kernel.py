"""Native OCCT B-Rep feature evaluator; strict P0 subset, NOT a browser WASM implementation."""
from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from importlib.metadata import version

from OCP.BRepAlgoAPI import BRepAlgoAPI_Cut, BRepAlgoAPI_Fuse, BRepAlgoAPI_Common
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox, BRepPrimAPI_MakeCylinder
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepGProp import BRepGProp
from OCP.BRepBndLib import BRepBndLib
from OCP.Bnd import Bnd_Box
from OCP.GProp import GProp_GProps
from OCP.IFSelect import IFSelect_RetDone
from OCP.STEPControl import STEPControl_Writer, STEPControl_Reader, STEPControl_AsIs
from OCP.TopAbs import TopAbs_SOLID
from OCP.TopExp import TopExp_Explorer
from OCP.gp import gp_Pnt, gp_Dir, gp_Ax2


class GeometryError(ValueError):
    """Deterministic input/shape/export failure; never silently produce an empty mesh."""


@dataclass(frozen=True)
class Evidence:
    valid: bool
    solids: int
    volume_mm3: float
    bbox_mm: tuple[float, float, float, float, float, float]


def _positive_float(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        raise GeometryError(f"{label}: positive finite number required")
    return float(value)


def _vec(value: object, label: str) -> tuple[float, float, float]:
    if not isinstance(value, list) or len(value) != 3:
        raise GeometryError(f"{label}: expected vector of three finite numbers")
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in value):
        raise GeometryError(f"{label}: vector must be finite")
    return tuple(float(v) for v in value)


def _keys(feature: dict, allowed: set[str]) -> None:
    extras = set(feature) - allowed
    if extras:
        raise GeometryError(f"feature {feature.get('id')}: unexpected fields {sorted(extras)}")


def _shape_valid(shape) -> bool:
    return not shape.IsNull() and BRepCheck_Analyzer(shape).IsValid()


def evidence(shape) -> Evidence:
    if shape.IsNull():
        raise GeometryError("null OCCT shape")
    valid = _shape_valid(shape)
    explorer = TopExp_Explorer(shape, TopAbs_SOLID)
    count = 0
    while explorer.More():
        count += 1
        explorer.Next()
    props = GProp_GProps()
    BRepGProp.VolumeProperties_s(shape, props)
    bounds = Bnd_Box()
    BRepBndLib.Add_s(shape, bounds, True)
    bb = bounds.Get()
    return Evidence(valid, count, float(props.Mass()), tuple(float(x) for x in bb))


def _assert_solid(shape, label: str) -> Evidence:
    ev = evidence(shape)
    if not ev.valid or ev.solids != 1 or ev.volume_mm3 <= 0:
        raise GeometryError(f"{label}: expected exactly one valid positive-volume solid; got {ev}")
    return ev


def build(document: dict):
    if not isinstance(document, dict):
        raise GeometryError("document must be JSON object")
    if document.get("schemaVersion") != 1 or document.get("units") != "mm":
        raise GeometryError("only CadDocumentV1 with mm units is supported")
    if not isinstance(document.get("revision"), int) or isinstance(document["revision"], bool) or document["revision"] < 0:
        raise GeometryError("revision must be non-negative int")
    if not isinstance(document.get("documentId"), str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,63}", document["documentId"]):
        raise GeometryError("invalid documentId")
    features = document.get("features")
    if not isinstance(features, list) or not 1 <= len(features) <= 1000:
        raise GeometryError("features must contain 1..1000 elements")
    shapes = {}
    for f in features:
        if not isinstance(f, dict):
            raise GeometryError("feature must be object")
        fid = f.get("id")
        if not isinstance(fid, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,63}", fid):
            raise GeometryError("invalid feature ID")
        if fid in shapes:
            raise GeometryError(f"duplicate feature: {fid}")
        kind = f.get("type")
        if kind == "box":
            _keys(f, {"id", "type", "inputs", "originMm", "sizeMm"})
            if f.get("inputs") != []:
                raise GeometryError("box requires empty inputs")
            x, y, z = _vec(f.get("originMm"), "originMm")
            dx, dy, dz = _vec(f.get("sizeMm"), "sizeMm")
            for val, k in [(dx, "sizeMm.x"), (dy, "sizeMm.y"), (dz, "sizeMm.z")]:
                _positive_float(val, k)
            shape = BRepPrimAPI_MakeBox(gp_Pnt(x, y, z), dx, dy, dz).Shape()
        elif kind == "cylinder":
            _keys(f, {"id", "type", "inputs", "originMm", "radiusMm", "heightMm", "axis"})
            if f.get("inputs") != [] or f.get("axis") != "Z":
                raise GeometryError("cylinder requires empty inputs and Z axis")
            x, y, z = _vec(f.get("originMm"), "originMm")
            radius = _positive_float(f.get("radiusMm"), "radiusMm")
            height = _positive_float(f.get("heightMm"), "heightMm")
            shape = BRepPrimAPI_MakeCylinder(gp_Ax2(gp_Pnt(x,y,z), gp_Dir(0,0,1)),radius,height).Shape()
        elif kind == "boolean":
            _keys(f, {"id", "type", "inputs", "booleanOp"})
            inputs = f.get("inputs")
            if (not isinstance(inputs, list) or len(inputs) != 2 or inputs[0] == inputs[1] or
                    any(not isinstance(x, str) or x not in shapes for x in inputs)):
                raise GeometryError("boolean must reference two existing, distinct earlier features")
            op = f.get("booleanOp")
            algorithms = {"cut": BRepAlgoAPI_Cut, "union": BRepAlgoAPI_Fuse, "intersect": BRepAlgoAPI_Common}
            if op not in algorithms:
                raise GeometryError(f"unsupported boolean: {op}")
            algorithm = algorithms[op](shapes[inputs[0]], shapes[inputs[1]])
            algorithm.Build()
            if not algorithm.IsDone():
                raise GeometryError(f"OCCT boolean {op} did not complete")
            shape = algorithm.Shape()
        else:
            raise GeometryError(f"unsupported feature type: {kind!r}")
        _assert_solid(shape, fid)
        shapes[fid] = shape
    return shapes[features[-1]["id"]]


def export_step(shape, path: Path) -> bytes:
    _assert_solid(shape, "before STEP export")
    # The external boundary always uses millimeters; never accept unit ambiguity.
    from OCP.Interface import Interface_Static
    Interface_Static.SetCVal_s("write.step.unit", "MM")
    Interface_Static.SetCVal_s("xstep.cascade.unit", "MM")
    writer = STEPControl_Writer()
    if writer.Transfer(shape, STEPControl_AsIs) != IFSelect_RetDone:
        raise GeometryError("STEP writer transfer failed")
    if writer.Write(str(path)) != IFSelect_RetDone:
        raise GeometryError("STEP write failed")
    content = path.read_bytes()
    if not content.startswith(b"ISO-10303-21;") or len(content) < 100:
        raise GeometryError("invalid STEP file header or empty file")
    return content


def import_step(path: Path):
    reader = STEPControl_Reader()
    if reader.ReadFile(str(path)) != IFSelect_RetDone:
        raise GeometryError("STEP reader failed")
    if reader.TransferRoots() < 1:
        raise GeometryError("STEP contains no transferable roots")
    shape = reader.OneShape()
    _assert_solid(shape, "imported STEP")
    return shape


def compare_evidence(before: Evidence, after: Evidence,
                     abs_volume_mm3: float = 1e-3, abs_bbox_mm: float = 1e-4) -> dict:
    if not before.valid or not after.valid:
        raise GeometryError("invalid shape before/after STEP transfer")
    if before.solids != after.solids:
        raise GeometryError(f"solid-count mismatch: {before.solids} vs {after.solids}")
    vdelta = abs(before.volume_mm3 - after.volume_mm3)
    bdelta = max(abs(a-b) for a,b in zip(before.bbox_mm,after.bbox_mm))
    passed = vdelta <= abs_volume_mm3 and bdelta <= abs_bbox_mm
    if not passed:
        raise GeometryError(f"STEP roundtrip geometry mismatch (volume Δ={vdelta}, bbox max Δ={bdelta})")
    return {"passed": True, "volumeDeltaMm3": vdelta, "bboxMaxDeltaMm": bdelta,
            "tolerances": {"volumeAbsMm3": abs_volume_mm3, "bboxAbsMm": abs_bbox_mm}}


def run(document: dict, step_path: Path) -> dict:
    shape = build(document)
    original = _assert_solid(shape, "source")
    content = export_step(shape, step_path)
    # Independent reader, no reuse of source topology or source shape handles.
    restored = import_step(step_path)
    imported = _assert_solid(restored, "imported")
    comparison = compare_evidence(original, imported)
    return {
        "documentId": document["documentId"], "documentRevision": document["revision"],
        "kernel": {"binding": "cadquery-ocp", "version": version("cadquery-ocp"), "family": "OCCT", "runtime": "native"},
        "source": vars(original), "imported": vars(imported),
        "roundTrip": comparison,
        "artifact": {"format": "STEP", "sha256": sha256(content).hexdigest(), "bytes": len(content),
                     "file": step_path.name}
    }
