"""Validate CAD-006 fixtures with JSON Schema Draft 2020-12 (requires jsonschema)."""
import json
from pathlib import Path
from jsonschema import Draft202012Validator
ROOT = Path(__file__).resolve().parent.parent
schema=json.loads((ROOT/'packages/cad-contracts/schema/sketch.v1.schema.json').read_text())
Draft202012Validator.check_schema(schema)
validator=Draft202012Validator(schema)
for file in sorted((ROOT/'samples').glob('*.sketch.json')):
    doc=json.loads(file.read_text())
    errors=list(validator.iter_errors(doc))
    if errors: raise SystemExit(f'{file}: {errors[0].message}')
    print('PASS sketch schema:', file.name)
