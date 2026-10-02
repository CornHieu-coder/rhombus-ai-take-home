"""Compare an S3 source object with a GCS pipeline export."""

import argparse
import csv
import io
import json
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
COLUMNS = ["order_id", "customer_email", "customer_name", "amount_usd", "order_date", "country"]
SCENARIOS = [
    "baseline", "schema-drop-column", "schema-rename-column",
    "schema-change-type", "schema-add-column", "schema-combined",
    "semantic-cents", "semantic-day-month",
]


def parse_csv(value):
    reader = csv.DictReader(io.StringIO(value.lstrip("\ufeff"), newline=""))
    return list(reader.fieldnames or []), list(reader)


def canonical_row(row):
    """Compare numeric amounts by value without rounding away output errors."""
    try:
        amount = Decimal(row.get("amount_usd"))
    except (InvalidOperation, TypeError, ValueError):
        return row
    if not amount.is_finite():
        return row
    return {**row, "amount_usd": amount}


def expected_rows(rows, scenario):
    result = []
    rejected = {}
    seen_ids = set()
    for row in rows:
        order_id = (row["order_id"] or "").strip()
        if order_id in seen_ids:
            rejected[order_id] = "duplicate order_id"
            continue
        seen_ids.add(order_id)
        email = (row["customer_email"] or "").strip().lower()
        if not order_id or not email:
            rejected[order_id] = "missing required field"
            continue
        try:
            amount = Decimal((row["amount_usd"] or "").strip())
            if scenario == "semantic-cents":
                amount /= 100
            if not amount.is_finite() or amount <= 0:
                raise InvalidOperation
            amount = amount.quantize(Decimal("0.01"))
        except (InvalidOperation, ValueError):
            rejected[order_id] = "invalid amount"
            continue
        date_format = "%d/%m/%Y" if scenario == "semantic-day-month" else "%m/%d/%Y"
        try:
            order_date = datetime.strptime((row["order_date"] or "").strip(), date_format).date()
        except ValueError:
            rejected[order_id] = "invalid date"
            continue
        country = (row["country"] or "").strip().lower()
        if country not in {"us", "usa", "united states"}:
            rejected[order_id] = "invalid country"
            continue
        result.append({
            "order_id": order_id,
            "customer_email": email,
            "customer_name": (row["customer_name"] or "").strip() or "Unknown",
            "amount_usd": str(amount),
            "order_date": order_date.isoformat(),
            "country": "US",
        })
    return result, rejected


def validate(source_text, output_text, scenario, repeat_outputs=()):
    if scenario not in SCENARIOS:
        raise ValueError(f"Unknown scenario: {scenario}")
    source_columns, source_rows = parse_csv(source_text)
    missing = [column for column in COLUMNS if column not in source_columns]
    extra = [column for column in source_columns if column not in COLUMNS]
    checks = []

    def add(name, passed, detail):
        checks.append({"name": name, "passed": passed, "detail": detail})

    add("source_schema", not missing, f"missing={missing}; extra={extra}")
    expected = []
    rejected = {}
    if not missing:
        expected, rejected = expected_rows(source_rows, scenario)
    _, baseline_rows = parse_csv((ROOT / "datasets" / "baseline.csv").read_text(encoding="utf-8"))
    _, baseline_rejected = expected_rows(baseline_rows, "baseline")
    new_invalid = sorted(order_id for order_id in rejected if order_id not in baseline_rejected)
    add("new_invalid_values", not new_invalid if not missing else None,
        f"new rejected order_ids={new_invalid}; baseline rejected={sorted(baseline_rejected)}")

    add("output_exists", output_text is not None, "output supplied" if output_text is not None else "no output object")
    output_columns, output_rows = parse_csv(output_text) if output_text is not None else ([], [])
    add("output_schema", output_columns == COLUMNS if output_text is not None else None,
        f"expected={COLUMNS}; actual={output_columns}")
    add("row_count", len(output_rows) == len(expected) if output_text is not None and not missing else None,
        f"expected={len(expected)}; actual={len(output_rows)}")
    actual_by_id = {row.get("order_id", ""): row for row in output_rows}
    expected_by_id = {row["order_id"]: row for row in expected}
    actual_values = {key: canonical_row(row) for key, row in actual_by_id.items()}
    expected_values = {key: canonical_row(row) for key, row in expected_by_id.items()}
    matches = (
        output_text is not None and not missing and output_columns == COLUMNS
        and len(actual_by_id) == len(output_rows)
        and actual_values == expected_values
    )
    add("cleaning_rules", matches if output_text is not None and not missing else None,
        f"expected={expected_by_id}; actual={actual_by_id}" if not matches and output_text is not None else "canonical rows match" if matches else "not evaluated")

    if repeat_outputs:
        all_outputs = [output_text, *repeat_outputs]
        comparable = []
        for item in all_outputs:
            if item is None:
                comparable.append(None)
            else:
                columns, rows = parse_csv(item)
                comparable.append((columns, [canonical_row(row) for row in rows]))
        deterministic = len(repeat_outputs) >= 2 and comparable[0] is not None and all(item == comparable[0] for item in comparable[1:])
        add("determinism", deterministic, f"compared {len(all_outputs)} ordered CSV results; identical={deterministic}")
    else:
        add("determinism", None, "not evaluated; supply two repeat outputs for three runs")

    return {
        "scenario": scenario,
        "passed": not any(item["passed"] is False for item in checks),
        "source_rows": len(source_rows),
        "expected_rows": len(expected),
        "output_rows": len(output_rows) if output_text is not None else None,
        "source_extra_columns": extra,
        "checks": checks,
    }


def read_uri(uri):
    if Path(uri).is_file():
        return Path(uri).read_text(encoding="utf-8-sig")
    parsed = urlparse(uri)
    if parsed.scheme == "s3":
        import boto3
        return boto3.client("s3").get_object(Bucket=parsed.netloc, Key=parsed.path.lstrip("/"))["Body"].read().decode("utf-8-sig")
    if parsed.scheme == "gs":
        from google.cloud import storage
        return storage.Client().bucket(parsed.netloc).blob(parsed.path.lstrip("/")).download_as_text(encoding="utf-8-sig")
    if parsed.scheme in {"", "file"}:
        return Path(parsed.path if parsed.scheme else uri).read_text(encoding="utf-8-sig")
    raise ValueError(f"Unsupported URI scheme: {parsed.scheme}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenario", choices=SCENARIOS, required=True)
    parser.add_argument("--source", required=True, help="s3://bucket/key or local CSV path")
    parser.add_argument("--output", help="gs://bucket/key or local CSV path")
    parser.add_argument("--output-missing", action="store_true", help="Record a run that produced no output")
    parser.add_argument("--repeat-output", action="append", default=[], help="Two more output URIs for determinism")
    parser.add_argument("--report", help="Write JSON report to this path")
    args = parser.parse_args()
    if bool(args.output) == args.output_missing:
        parser.error("supply exactly one of --output or --output-missing")
    source_text = read_uri(args.source)
    retrieval_error = None
    try:
        output_text = read_uri(args.output) if args.output else None
    except Exception as exc:
        output_text = None
        retrieval_error = f"{type(exc).__name__}: {exc}"
    repeats = [read_uri(uri) for uri in args.repeat_output]
    report = validate(source_text, output_text, args.scenario, repeats)
    report["source_uri"] = args.source
    report["output_uri"] = args.output
    if retrieval_error:
        report["retrieval_error"] = retrieval_error
    encoded = json.dumps(report, indent=2, ensure_ascii=False)
    if args.report:
        destination = Path(args.report)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(encoded + "\n", encoding="utf-8")
    print(encoded)
    return 0 if report["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
