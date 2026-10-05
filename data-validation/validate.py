"""Compare an S3 source object with a GCS pipeline export."""

import argparse
import csv
import io
import json
import re
from collections import Counter
from datetime import datetime
from decimal import Decimal, DecimalException, InvalidOperation, localcontext
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
COLUMNS = ["order_id", "customer_email", "customer_name", "amount_usd", "order_date", "country"]
NUMERIC_LITERAL = re.compile(r"[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?")
SCENARIOS = [
    "baseline", "schema-drop-column", "schema-rename-column",
    "schema-change-type", "schema-add-column", "schema-combined",
    "semantic-cents", "semantic-day-month",
]


def parse_csv(value):
    """Keep CSV shape errors visible before dictionary conversion loses cells."""
    reader = csv.reader(io.StringIO(value.lstrip("\ufeff"), newline=""), strict=True)
    columns, rows, errors = [], [], []
    try:
        columns = next(reader, [])
        duplicates = sorted(name for name, count in Counter(columns).items() if count > 1)
        if duplicates:
            errors.append({"code": "duplicate_headers", "row": 1, "headers": duplicates})
        if any(not name.strip() for name in columns):
            errors.append({"code": "empty_header", "row": 1})
        for cells in reader:
            if not cells:  # A blank physical line is not a CSV data record.
                continue
            record = len(rows) + 2
            if len(cells) != len(columns):
                errors.append({"code": "row_width", "row": record, "line": reader.line_num,
                               "expected_fields": len(columns), "actual_fields": len(cells)})
            rows.append(dict(zip(columns, cells)))
    except csv.Error as exc:
        errors.append({"code": "csv_syntax", "line": reader.line_num, "error": str(exc)})
    return columns, rows, errors


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
    rejected = []
    errors = []
    seen_ids = set()
    for record, row in enumerate(rows, start=2):
        order_id = (row["order_id"] or "").strip()

        def reject(reason):
            rejected.append({"row": record, "order_id": order_id, "reason": reason})

        if order_id in seen_ids:
            reject("duplicate order_id")
            continue
        seen_ids.add(order_id)
        email = (row["customer_email"] or "").strip().lower()
        if not order_id or not email:
            reject("missing required field")
            continue
        amount_text = (row["amount_usd"] or "").strip()
        try:
            amount = Decimal(amount_text)
        except (InvalidOperation, ValueError):
            if NUMERIC_LITERAL.fullmatch(amount_text):
                errors.append({"code": "amount_range", "row": record, "order_id": order_id,
                               "error": "Numeric literal exceeds the decimal calculator's representation range"})
            else:
                reject("invalid amount")
            continue
        if not amount.is_finite() or amount <= 0:
            reject("invalid amount")
            continue
        try:
            # Increase precision for finite amounts instead of silently rejecting
            # values wider than Decimal's default 28 digits. Bound allocation for
            # extreme exponents; this is a validator limit, not a cleaning rule.
            precision = max(28, len(amount.as_tuple().digits) + max(0, amount.as_tuple().exponent) + 2)
            if precision > 1000:
                errors.append({"code": "amount_range", "row": record, "order_id": order_id,
                               "error": "Rounding requires more than the validator's 1000-digit safety limit"})
                continue
            with localcontext() as context:
                context.prec = precision
                if scenario == "semantic-cents":
                    amount /= 100
                amount = amount.quantize(Decimal("0.01"))
        except DecimalException as exc:
            errors.append({"code": "amount_range", "row": record, "order_id": order_id,
                           "error": f"Cannot safely round amount: {type(exc).__name__}"})
            continue
        date_format = "%d/%m/%Y" if scenario == "semantic-day-month" else "%m/%d/%Y"
        date_text = (row["order_date"] or "").strip()
        order_date = None
        for accepted_format in ("%Y-%m-%d", date_format):
            try:
                order_date = datetime.strptime(date_text, accepted_format).date()
                break
            except ValueError:
                pass
        if order_date is None:
            reject("invalid date")
            continue
        country = (row["country"] or "").strip().lower()
        if country not in {"us", "usa", "united states"}:
            reject("invalid country")
            continue
        result.append({
            "order_id": order_id,
            "customer_email": email,
            "customer_name": (row["customer_name"] or "").strip() or "Unknown",
            "amount_usd": str(amount),
            "order_date": order_date.isoformat(),
            "country": "US",
        })
    return result, rejected, errors


def validate(source_text, output_text, scenario, repeat_outputs=()):
    if scenario not in SCENARIOS:
        raise ValueError(f"Unknown scenario: {scenario}")
    source_columns, source_rows, source_errors = parse_csv(source_text)
    missing = [column for column in COLUMNS if column not in source_columns]
    extra = [column for column in source_columns if column not in COLUMNS]
    checks = []

    def add(name, passed, detail):
        checks.append({"name": name, "passed": passed, "detail": detail})

    source_valid = not missing and not source_errors
    add("source_schema", source_valid, f"missing={missing}; extra={extra}; CSV errors={source_errors}")
    expected = []
    rejected, validation_errors = [], []
    if source_valid:
        expected, rejected, validation_errors = expected_rows(source_rows, scenario)
    _, baseline_rows, _ = parse_csv((ROOT / "datasets" / "baseline.csv").read_text(encoding="utf-8"))
    baseline_expected, baseline_rejected, _ = expected_rows(baseline_rows, "baseline")
    baseline_reasons = {(item["order_id"], item["reason"]) for item in baseline_rejected}
    new_reasons = sorted({(item["order_id"], item["reason"]) for item in rejected} - baseline_reasons)
    baseline_valid_ids = {row["order_id"] for row in baseline_expected}
    source_ids = {(row.get("order_id") or "").strip() for row in source_rows}
    expected_ids = {row["order_id"] for row in expected}
    lost_ids = sorted((baseline_valid_ids & source_ids) - expected_ids) if source_valid else []
    new_invalid_details = {"lost_valid_order_ids": lost_ids,
                           "new_rejection_reasons": [{"order_id": order_id, "reason": reason}
                                                     for order_id, reason in new_reasons]}
    evaluable = source_valid and not validation_errors
    add("new_invalid_values", not (lost_ids or new_reasons) if evaluable else None,
        f"input-quality alert: lost valid order_ids={lost_ids}; new rejection reasons={new_reasons}; "
        "correctly filtered output is checked separately")
    if validation_errors:
        add("amount_range", False, validation_errors)

    add("output_exists", output_text is not None, "output supplied" if output_text is not None else "no output object")
    output_columns, output_rows, output_errors = parse_csv(output_text) if output_text is not None else ([], [], [])
    output_valid = output_columns == COLUMNS and not output_errors
    add("output_schema", output_valid if output_text is not None else None,
        f"expected={COLUMNS}; actual={output_columns}; CSV errors={output_errors}")
    add("row_count", len(output_rows) == len(expected) if output_text is not None and evaluable and not output_errors else None,
        f"expected={len(expected)}; actual={len(output_rows)}")
    actual_by_id = {row.get("order_id", ""): row for row in output_rows}
    expected_by_id = {row["order_id"]: row for row in expected}
    actual_values = {key: canonical_row(row) for key, row in actual_by_id.items()}
    expected_values = {key: canonical_row(row) for key, row in expected_by_id.items()}
    matches = (
        output_text is not None and evaluable and output_valid
        and len(actual_by_id) == len(output_rows)
        and actual_values == expected_values
    )
    add("cleaning_rules", matches if output_text is not None and evaluable else None,
        f"expected={expected_by_id}; actual={actual_by_id}" if evaluable and not matches and output_text is not None
        else "canonical rows match" if matches else "not evaluated")

    all_outputs = [output_text, *repeat_outputs]
    comparable, repeat_errors = [], []
    for index, item in enumerate(all_outputs):
        if item is not None:
            columns, rows, errors = parse_csv(item)
            comparable.append((columns, [canonical_row(row) for row in rows]))
            if errors:
                repeat_errors.append({"output_index": index, "errors": errors})
    if repeat_errors:
        deterministic, status = False, "invalid_csv"
    elif len(comparable) >= 2:
        deterministic = all(item == comparable[0] for item in comparable[1:])
        status = "identical" if deterministic else "different"
    else:
        deterministic, status = None, "insufficient_evidence"
    comparison = {"supplied_outputs": len(all_outputs), "available_outputs": len(comparable),
                  "unavailable_outputs": len(all_outputs) - len(comparable), "status": status}
    add("determinism", deterministic,
        f"{status}; compared {len(comparable)} available ordered CSV results; "
        f"{comparison['unavailable_outputs']} unavailable; at least two outputs required")

    return {
        "scenario": scenario,
        "passed": not any(item["passed"] is False for item in checks),
        "source_rows": len(source_rows),
        "expected_rows": len(expected),
        "output_rows": len(output_rows) if output_text is not None else None,
        "source_extra_columns": extra,
        "csv_errors": {"source": source_errors, "output": output_errors, "repeats": repeat_errors},
        "source_rejections": rejected,
        "new_invalid_details": new_invalid_details,
        "validation_errors": validation_errors,
        "comparison": comparison,
        "checks": checks,
    }


def read_uri(uri):
    # A missing Windows path still has a drive; urlparse would call "C:" a
    # URI scheme and hide the useful FileNotFoundError diagnostic.
    if Path(uri).is_file() or Path(uri).drive:
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
    parser.add_argument("--repeat-output", action="append", default=[], help="Further output URI; one repeat permits a consistency comparison")
    parser.add_argument("--report", help="Write JSON report to this path")
    args = parser.parse_args()
    if bool(args.output) == args.output_missing:
        parser.error("supply exactly one of --output or --output-missing")
    source_text = read_uri(args.source)
    retrieval_errors = []
    try:
        output_text = read_uri(args.output) if args.output else None
    except Exception as exc:
        output_text = None
        retrieval_errors.append({"role": "output", "uri": args.output, "error": f"{type(exc).__name__}: {exc}"})
    repeats = []
    for index, uri in enumerate(args.repeat_output):
        try:
            repeats.append(read_uri(uri))
        except Exception as exc:
            repeats.append(None)
            retrieval_errors.append({"role": "repeat_output", "index": index, "uri": uri,
                                     "error": f"{type(exc).__name__}: {exc}"})
    report = validate(source_text, output_text, args.scenario, repeats)
    report["source_uri"] = args.source
    report["output_uri"] = args.output
    if retrieval_errors:
        report["retrieval_errors"] = retrieval_errors
        primary_error = next((item for item in retrieval_errors if item["role"] == "output"), None)
        if primary_error:
            report["retrieval_error"] = primary_error["error"]
        report["checks"].append({"name": "output_retrieval", "passed": False, "detail": retrieval_errors})
        report["passed"] = False
    encoded = json.dumps(report, indent=2, ensure_ascii=False)
    if args.report:
        destination = Path(args.report)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(encoded + "\n", encoding="utf-8")
    print(encoded)
    return 0 if report["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
