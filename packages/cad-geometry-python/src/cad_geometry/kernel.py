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
from OCP.TopAbs import TopAbs_SOLID, TopAbs_FACE
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
    area_mm2: float
    faces: int


def _positive_float(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        raise GeometryError(f"{label}: positive finite number required")
    return float(value)


def _length(value: object, label: str, parameters: dict) -> float:
    if isinstance(value, dict):
        if set(value) != {"parameterRef"} or not isinstance(value["parameterRef"], str):
            raise GeometryError(f"{label}: invalid typed length reference")
        name = value["parameterRef"]
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,63}", name):
            raise GeometryError(f"{label}: invalid parameter ID")
        parameter = parameters.get(name)
        if not isinstance(parameter, dict):
            raise GeometryError(f"{label}: missing parameter {name}")
        if set(parameter) != {"kind", "value"} or parameter["kind"] != "length":
            raise GeometryError(f"{label}: expected length parameter {name}")
        value = parameter["value"]
    return _positive_float(value, label)


def _size_vec(value: object, label: str, parameters: dict) -> tuple[float, float, float]:
    if not isinstance(value, list) or len(value) != 3:
        raise GeometryError(f"{label}: expected three dimensions")
    return tuple(_length(v, f"{label}[{i}]", parameters) for i, v in enumerate(value))


def _evaluation_order(features: list) -> list[dict]:
    """ID-tie-break, dependency-first DFS. Never infer results from array position."""
    if any(not isinstance(f, dict) for f in features):
        raise GeometryError("feature must be object")
    by_id = {}
    for f in features:
        fid = f.get("id")
        if not isinstance(fid, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,63}", fid):
            raise GeometryError("invalid feature ID")
        if fid in by_id:
            raise GeometryError(f"duplicate feature: {fid}")
        if not isinstance(f.get("inputs"), list) or not all(isinstance(dep, str) for dep in f["inputs"]):
            raise GeometryError(f"feature {fid}: inputs must be array of IDs")
        by_id[fid] = f
    visited, active, result = set(), set(), []

    def visit(fid: str):
        if fid in active:
            raise GeometryError(f"cyclic dependency at {fid}")
        if fid in visited:
            return
        if fid not in by_id:
            raise GeometryError(f"missing dependency: {fid}")
        active.add(fid)
        for dep in sorted(by_id[fid]["inputs"]):
            visit(dep)
        active.remove(fid)
        visited.add(fid)
        result.append(by_id[fid])

    for fid in sorted(by_id):
        visit(fid)
    return result


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
    area = GProp_GProps()
    BRepGProp.SurfaceProperties_s(shape, area)
    face_explorer = TopExp_Explorer(shape, TopAbs_FACE)
    face_count=0
    while face_explorer.More():
        face_count+=1
        face_explorer.Next()
    bounds = Bnd_Box()
    BRepBndLib.Add_s(shape, bounds, True)
    bb = bounds.Get()
    return Evidence(valid, count, float(props.Mass()), tuple(float(x) for x in bb), float(area.Mass()),face_count)


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
    if set(document) - {"schemaVersion", "documentId", "revision", "units", "parameters", "features", "outputBodyId"}:
        raise GeometryError("unsupported document fields")
    parameters = document.get("parameters")
    if not isinstance(parameters, dict) or len(parameters) > 2000:
        raise GeometryError("invalid parameters")
    for name, param in parameters.items():
        if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,63}", name):
            raise GeometryError("invalid parameter ID")
        if not isinstance(param, dict) or set(param) != {"kind", "value"} or param["kind"] not in {"length", "angle", "count"}:
            raise GeometryError(f"invalid parameter {name}")
        val = param["value"]
        if isinstance(val, bool) or not isinstance(val, (int, float)) or not math.isfinite(val):
            raise GeometryError(f"invalid parameter value {name}")
        if param["kind"] == "length" and val <= 0:
            raise GeometryError(f"invalid length parameter {name}")
        if param["kind"] == "count" and (not isinstance(val, int) or val < 0):
            raise GeometryError(f"invalid count parameter {name}")
    features = document.get("features")
    if not isinstance(features, list) or not 1 <= len(features) <= 1000:
        raise GeometryError("features must contain 1..1000 elements")
    ordered = _evaluation_order(features)
    output = document.get("outputBodyId")
    if not isinstance(output, str) or output not in {f["id"] for f in ordered}:
        raise GeometryError("outputBodyId must explicitly reference an existing solid")
    shapes = {}
    for f in ordered:
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
            dx, dy, dz = _size_vec(f.get("sizeMm"), "sizeMm", parameters)
            shape = BRepPrimAPI_MakeBox(gp_Pnt(x, y, z), dx, dy, dz).Shape()
        elif kind == "cylinder":
            _keys(f, {"id", "type", "inputs", "originMm", "radiusMm", "heightMm", "axis"})
            if f.get("inputs") != [] or f.get("axis") != "Z":
                raise GeometryError("cylinder requires empty inputs and Z axis")
            x, y, z = _vec(f.get("originMm"), "originMm")
            radius = _length(f.get("radiusMm"), "radiusMm", parameters)
            height = _length(f.get("heightMm"), "heightMm", parameters)
            shape = BRepPrimAPI_MakeCylinder(gp_Ax2(gp_Pnt(x,y,z), gp_Dir(0,0,1)),radius,height).Shape()
        elif kind == "boolean":
            _keys(f, {"id", "type", "inputs", "booleanOp"})
            inputs = f.get("inputs")
            if (not isinstance(inputs, list) or len(inputs) != 2 or inputs[0] == inputs[1] or
                    any(not isinstance(x, str) or x not in shapes for x in inputs)):
                raise GeometryError("boolean must reference two distinct solid dependencies")
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
    if output not in shapes:
        raise GeometryError("outputBodyId has no evaluated solid")
    return shapes[output]


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
                     abs_volume_mm3: float = 1e-3, abs_bbox_mm: float = 1e-4,
                     abs_area_mm2: float = 1e-3) -> dict:
    if not before.valid or not after.valid:
        raise GeometryError("invalid shape before/after STEP transfer")
    if before.solids != after.solids:
        raise GeometryError(f"solid-count mismatch: {before.solids} vs {after.solids}")
    vdelta = abs(before.volume_mm3 - after.volume_mm3)
    bdelta = max(abs(a-b) for a,b in zip(before.bbox_mm,after.bbox_mm))
    adelta=abs(before.area_mm2-after.area_mm2)
    passed = vdelta <= abs_volume_mm3 and bdelta <= abs_bbox_mm and adelta <= abs_area_mm2
    if not passed:
        raise GeometryError(f"STEP roundtrip geometry mismatch (volume Δ={vdelta}, area Δ={adelta}, bbox max Δ={bdelta})")
    return {"passed": True, "volumeDeltaMm3": vdelta, "bboxMaxDeltaMm": bdelta, "areaDeltaMm2": adelta,
            "faceCountBefore":before.faces,"faceCountAfter":after.faces,
            "tolerances": {"volumeAbsMm3": abs_volume_mm3, "bboxAbsMm": abs_bbox_mm,"areaAbsMm2":abs_area_mm2}}


def evidence_contract(document: dict, original: Evidence) -> dict:
    """Schema v1 DTO: no raw OCCT handles or mesh approximations cross boundary."""
    return {"schemaVersion":1,"documentId":document["documentId"],
      "documentRevision":document["revision"],
      "kernelBuildId":f"cadquery-ocp/{version('cadquery-ocp')}/native",
      "valid":original.valid,"solidCount":original.solids,
      "volumeMm3":original.volume_mm3,"bboxMm":list(original.bbox_mm),
      "surfaceAreaMm2":original.area_mm2,"faceCount":original.faces,"warnings":[]}


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
        "geometryEvidence": evidence_contract(document, original),
        "kernel": {"binding": "cadquery-ocp", "version": version("cadquery-ocp"), "family": "OCCT", "runtime": "native"},
        "source": vars(original), "imported": vars(imported),
        "roundTrip": comparison,
        "artifact": {"format": "STEP", "sha256": sha256(content).hexdigest(), "bytes": len(content),
                     "file": step_path.name}
    }
