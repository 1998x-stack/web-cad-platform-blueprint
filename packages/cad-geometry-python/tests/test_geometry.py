"""Geometry contracts backed by the OCCT kernel, not screenshots or mesh counts."""
import copy
import json
import math
import tempfile
import unittest
from pathlib import Path

from cad_geometry.kernel import (
    build, evidence, run, export_step, import_step, compare_evidence, GeometryError,
)


ROOT = Path(__file__).resolve().parents[3]
FIXTURE = json.loads((ROOT / "samples/precision-block.cad.json").read_text())


class GeometryTests(unittest.TestCase):
    def test_real_brep_cylinder_cut_and_independent_step_round_trip(self):
        with tempfile.TemporaryDirectory() as work:
            report = run(FIXTURE, Path(work) / "part.step")
            self.assertTrue(report["roundTrip"]["passed"])
            self.assertTrue(report["source"]["valid"])
            self.assertEqual(report["source"]["solids"], 1)
            self.assertAlmostEqual(
                report["source"]["volume_mm3"],
                120 * 60 * 30 - math.pi * 4**2 * 30,
                delta=1e-3,
            )
            for actual, expected in zip(report["source"]["bbox_mm"], (0,0,0,120,60,30)):
                self.assertAlmostEqual(actual, expected, delta=1e-4)
            self.assertGreater(report["artifact"]["bytes"], 1000)
            self.assertEqual(len(report["artifact"]["sha256"]), 64)

    def test_parameter_variation_produces_new_exact_volume(self):
        changed = copy.deepcopy(FIXTURE)
        changed["features"][1]["radiusMm"] = 6
        shape = build(changed)
        self.assertAlmostEqual(evidence(shape).volume_mm3,
                               120 * 60 * 30 - math.pi * 6**2 * 30,
                               delta=1e-3)

    def test_step_file_roundtrip_is_read_from_disk(self):
        shape = build(FIXTURE)
        with tempfile.TemporaryDirectory() as work:
            path = Path(work) / "genuine.step"
            content = export_step(shape, path)
            self.assertEqual(content, path.read_bytes())
            self.assertTrue(content.startswith(b"ISO-10303-21;"))
            compare_evidence(evidence(shape), evidence(import_step(path)))

    def test_missing_dependency_fails_closed(self):
        bad = copy.deepcopy(FIXTURE)
        bad["features"][-1]["inputs"][1] = "not_found"
        with self.assertRaisesRegex(GeometryError, "earlier features"):
            build(bad)

    def test_duplicate_feature_id_rejected(self):
        bad = copy.deepcopy(FIXTURE)
        bad["features"][1]["id"] = "base"
        with self.assertRaisesRegex(GeometryError, "duplicate"):
            build(bad)

    def test_invalid_dimensions_rejected(self):
        for size in ([120, 60, 0], [120, -1, 30], [120, float("nan"), 30]):
            bad = copy.deepcopy(FIXTURE)
            bad["features"][0]["sizeMm"] = size
            with self.assertRaises(GeometryError):
                build(bad)

    def test_invalid_cylinder_radius_rejected(self):
        bad = copy.deepcopy(FIXTURE)
        bad["features"][1]["radiusMm"] = 0
        with self.assertRaises(GeometryError):
            build(bad)

    def test_unsupported_geometry_fails_closed(self):
        bad = copy.deepcopy(FIXTURE)
        bad["features"][1]["type"] = "sphere"
        with self.assertRaisesRegex(GeometryError, "unsupported"):
            build(bad)

    def test_boolean_disjoint_cut_still_valid_solid(self):
        changed = copy.deepcopy(FIXTURE)
        changed["features"][1]["originMm"] = [1000,1000,0]
        ev = evidence(build(changed))
        self.assertAlmostEqual(ev.volume_mm3, 216000, delta=1e-3)
        self.assertTrue(ev.valid)

    def test_unit_must_be_mm(self):
        bad = copy.deepcopy(FIXTURE)
        bad["units"] = "inch"
        with self.assertRaisesRegex(GeometryError, "mm units"):
            build(bad)

    def test_comparison_detects_volume_mismatch(self):
        before = evidence(build(FIXTURE))
        changed = copy.deepcopy(FIXTURE)
        changed["features"][1]["radiusMm"] = 9
        after = evidence(build(changed))
        with self.assertRaisesRegex(GeometryError, "mismatch"):
            compare_evidence(before, after)


if __name__ == "__main__":
    unittest.main()
