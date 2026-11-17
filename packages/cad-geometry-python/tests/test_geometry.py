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

    def test_malformed_step_fails_closed_without_uncaught_kernel_error(self):
        # Regression: a parse-corrupt STEP used to escape import_step as an uncaught
        # OCP Standard_Failure ("Bnd_Box is void") instead of a typed GeometryError.
        shape = build(FIXTURE)
        with tempfile.TemporaryDirectory() as work:
            content = export_step(shape, Path(work) / "genuine.step")
            truncated = Path(work) / "truncated.step"
            truncated.write_bytes(content[: max(40, len(content) // 3)])
            corrupt = Path(work) / "corrupt.step"
            corrupt.write_text(content.decode().replace("CARTESIAN_POINT", "NOT_A_KEYWORD"))
            empty = Path(work) / "empty.step"
            empty.write_bytes(b"")
            for bad in (truncated, corrupt, empty):
                with self.assertRaises(GeometryError, msg=f"{bad.name} must fail closed"):
                    import_step(bad)

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
        with self.assertRaisesRegex(GeometryError, "missing dependency"):
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


class ContractRegressionTests(unittest.TestCase):
    def test_reverse_feature_order_builds_same_valid_output(self):
        scrambled=copy.deepcopy(FIXTURE)
        scrambled['features'].reverse()
        before=evidence(build(FIXTURE)); after=evidence(build(scrambled))
        self.assertTrue(before.valid and after.valid)
        self.assertAlmostEqual(before.volume_mm3,after.volume_mm3,delta=1e-4)
        self.assertEqual(before.bbox_mm,after.bbox_mm)

    def test_only_parameter_change_drives_exact_hole_diameter(self):
        document=copy.deepcopy(FIXTURE)
        document['parameters']['holeRadius']['value']=6
        before=evidence(build(FIXTURE))
        after=evidence(build(document))
        self.assertAlmostEqual(after.volume_mm3,120*60*30 - math.pi*6**2*30,delta=1e-3)
        self.assertGreater(before.volume_mm3,after.volume_mm3)
        self.assertEqual(document['features'][1]['radiusMm'], {'parameterRef':'holeRadius'})

    def test_invalid_param_ref_or_kind_fails_closed(self):
        for badvalue in ({'parameterRef':'missing'},{'parameterRef': 1},{'hack':'foo'}):
            document=copy.deepcopy(FIXTURE)
            document['features'][1]['radiusMm']=badvalue
            with self.assertRaises(GeometryError):build(document)
        document=copy.deepcopy(FIXTURE);document['parameters']['holeRadius']['kind']='count'
        with self.assertRaisesRegex(GeometryError,'length'):build(document)

    def test_explicit_output_body_and_invalid_dependencies(self):
        d=copy.deepcopy(FIXTURE);d.pop('outputBodyId')
        with self.assertRaisesRegex(GeometryError,'outputBodyId'):build(d)
        d=copy.deepcopy(FIXTURE);d['outputBodyId']='base'
        self.assertAlmostEqual(evidence(build(d)).volume_mm3,120*60*30,delta=1e-3)
        d=copy.deepcopy(FIXTURE);d['features'][2]['inputs']=['result','base']
        with self.assertRaisesRegex(GeometryError,'cyclic'):build(d)

    def test_js_parameter_transaction_drives_native_brep(self):
        import subprocess
        repo=Path(__file__).resolve().parents[3]
        result=subprocess.run(['node','scripts/create_parameter_revision.mjs'],cwd=repo,
          capture_output=True,text=True,check=True)
        candidate=json.loads(result.stdout)
        self.assertEqual(candidate['revision'],FIXTURE['revision']+1)
        self.assertEqual(candidate['parameters']['holeRadius']['value'],6)
        ev=evidence(build(candidate))
        self.assertAlmostEqual(ev.volume_mm3,120*60*30-math.pi*6**2*30,delta=1e-3)

    def test_standardized_geometry_evidence_schema(self):
        from cad_geometry.kernel import evidence_contract
        from jsonschema import Draft202012Validator
        repo=Path(__file__).resolve().parents[3]
        schema=json.loads((repo/'packages/cad-contracts/schema/geometry-evidence.v1.schema.json').read_text())
        dto=evidence_contract(FIXTURE,evidence(build(FIXTURE)))
        Draft202012Validator(schema).validate(dto)
        self.assertEqual(dto['solidCount'],1)
        self.assertGreater(dto['surfaceAreaMm2'],0)

    def test_output_body_independent_of_unreferenced_extra_primitive(self):
        d=copy.deepcopy(FIXTURE);d['features'].append({
          'id':'later','type':'box','inputs':[],'originMm':[999,0,0],'sizeMm':[1,1,1]})
        self.assertAlmostEqual(evidence(build(d)).volume_mm3,evidence(build(FIXTURE)).volume_mm3,delta=1e-4)
