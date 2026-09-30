import csv
import io
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data-validation"))
from validate import read_uri, validate  # noqa: E402


def source(name):
    return (ROOT / "datasets" / name).read_text(encoding="utf-8")


def output(rows):
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["order_id", "customer_email", "customer_name", "amount_usd", "order_date", "country"])
    writer.writerows(rows)
    return stream.getvalue()


BASELINE_ROWS = [
    ["1001", "alice@example.com", "Alice Chen", "19.95", "2026-04-05", "US"],
    ["1002", "bob@example.com", "Bob Lee", "42.50", "2026-04-06", "US"],
    ["1006", "carol@example.com", "Unknown", "120.00", "2026-04-07", "US"],
    ["1007", "dave@example.com", "Dave Kim", "8.40", "2026-04-08", "US"],
    ["1008", "eve@example.com", "Eve Ross", "199.00", "2026-04-09", "US"],
]


def check(report, name):
    return next(item for item in report["checks"] if item["name"] == name)


class ValidationTests(unittest.TestCase):
    def test_reads_absolute_local_path(self):
        self.assertEqual(read_uri(str(ROOT / "datasets" / "baseline.csv")), source("baseline.csv"))

    def test_baseline_cleaning_and_counts_pass(self):
        report = validate(source("baseline.csv"), output(BASELINE_ROWS), "baseline")
        self.assertTrue(report["passed"], report["checks"])
        self.assertEqual(report["source_rows"], 9)
        self.assertEqual(report["expected_rows"], 5)
        self.assertEqual(report["output_rows"], 5)
        self.assertTrue(check(report, "cleaning_rules")["passed"])

    def test_dropped_column_is_reported_even_without_output(self):
        report = validate(source("schema-drop-column.csv"), None, "schema-drop-column")
        self.assertFalse(report["passed"])
        self.assertIn("amount_usd", check(report, "source_schema")["detail"])
        self.assertFalse(check(report, "output_exists")["passed"])

    def test_added_column_does_not_leak_to_output(self):
        report = validate(source("schema-add-column.csv"), output(BASELINE_ROWS), "schema-add-column")
        self.assertTrue(report["passed"])
        self.assertEqual(report["source_extra_columns"], ["coupon_code"])
        leaky = output(BASELINE_ROWS).replace("country\r\n", "country,coupon_code\r\n", 1)
        self.assertFalse(check(validate(source("schema-add-column.csv"), leaky, "schema-add-column"), "output_schema")["passed"])

    def test_type_change_flags_new_invalid_value(self):
        reduced = [row for row in BASELINE_ROWS if row[0] != "1006"]
        report = validate(source("schema-change-type.csv"), output(reduced), "schema-change-type")
        self.assertFalse(check(report, "new_invalid_values")["passed"])
        self.assertIn("1006", check(report, "new_invalid_values")["detail"])

    def test_semantic_cents_catches_unchanged_numeric_interpretation(self):
        report = validate(source("semantic-cents.csv"), output(BASELINE_ROWS), "semantic-cents")
        self.assertTrue(report["passed"], report["checks"])
        wrong = [row.copy() for row in BASELINE_ROWS]
        wrong[0][3] = "1995.00"
        self.assertFalse(check(validate(source("semantic-cents.csv"), output(wrong), "semantic-cents"), "cleaning_rules")["passed"])

    def test_semantic_day_month_catches_date_reinterpretation(self):
        report = validate(source("semantic-day-month.csv"), output(BASELINE_ROWS), "semantic-day-month")
        self.assertTrue(report["passed"], report["checks"])
        wrong = [row.copy() for row in BASELINE_ROWS]
        wrong[0][4] = "2026-05-04"
        self.assertFalse(check(validate(source("semantic-day-month.csv"), output(wrong), "semantic-day-month"), "cleaning_rules")["passed"])

    def test_repeat_outputs_must_be_identical(self):
        baseline = output(BASELINE_ROWS)
        report = validate(source("baseline.csv"), baseline, "baseline", [baseline, baseline])
        self.assertTrue(check(report, "determinism")["passed"])
        changed = output(list(reversed(BASELINE_ROWS)))
        report = validate(source("baseline.csv"), baseline, "baseline", [baseline, changed])
        self.assertFalse(check(report, "determinism")["passed"])


if __name__ == "__main__":
    unittest.main()
