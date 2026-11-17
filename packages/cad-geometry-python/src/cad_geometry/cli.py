"""`python -m cad_geometry.cli run input.json --step output.step --report report.json`."""
import argparse
import json
from pathlib import Path

from .kernel import run, GeometryError


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    cmd = sub.add_parser("run", help="build solid, STEP export, independent STEP import and compare")
    cmd.add_argument("document", type=Path)
    cmd.add_argument("--step", type=Path, required=True)
    cmd.add_argument("--report", type=Path)
    args = parser.parse_args()
    args.step.parent.mkdir(parents=True, exist_ok=True)
    with args.document.open(encoding="utf-8") as handle:
        document = json.load(handle)
    result = run(document, args.step)
    output = json.dumps(result, indent=2, ensure_ascii=False)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(output + "\n", encoding="utf-8")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
