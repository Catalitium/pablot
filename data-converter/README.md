# Data Converter

Offline converter for `CSV`, `JSON`, and `YAML` with strict parse-first behavior and explicit errors.

## Supported Directions
- CSV -> JSON
- CSV -> YAML
- JSON -> CSV
- JSON -> YAML
- YAML -> CSV
- YAML -> JSON

If source and target formats are identical, converter returns input unchanged with a clear no-op notice.

## Parse and Error Behavior
- Conversion always validates source input first.
- Parse failures display explicit format-scoped errors.
- On parse failure, output is cleared to avoid stale converted data.

## CSV Handling Policy
- Handles quoted fields, escaped quotes (`""`), and embedded newlines.
- Uses first row as headers.
- Converts rows to arrays of objects for structured output.
- When converting nested JSON/YAML to CSV, keys are flattened with dot notation.

## YAML Handling Policy
- Supports nested objects and arrays for common YAML structures.
- Preserves schema shape across supported samples.
- Uses deterministic serialization for repeatable output.

## Output Download
- Download button writes `converted.csv`, `converted.json`, or `converted.yaml` based on target format.

## Local-Only Guarantee
All parsing and conversion happens in-browser. No network calls or backend processing.
