"""Offline regressions: expected results are independent of the validator."""

import csv
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data-validation"))
from validate import COLUMNS, validate  # noqa: E402


def csv_text(rows, columns=COLUMNS):
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(columns)
    writer.writerows(rows)
    return stream.getvalue()


def check(report, name):
    return next(item for item in report["checks"] if item["name"] == name)


def baseline_source():
    return (ROOT / "datasets/baseline.csv").read_text(encoding="utf-8")


def baseline_output():
    return (ROOT / "data-validation/tests/fixtures/expected-baseline-output.csv").read_text(encoding="utf-8")


class CSVIntegrityTests(unittest.TestCase):
    def test_duplicate_source_header_cannot_silently_overwrite(self):
        rows = list(csv.reader(io.StringIO(baseline_source())))
        malformed = csv_text([row + [row[0]] for row in rows[1:]], COLUMNS + ["order_id"])
        report = validate(malformed, baseline_output(), "baseline")
        self.assertFalse(check(report, "source_schema")["passed"])
        self.assertEqual(report["csv_errors"]["source"][0]["code"], "duplicate_headers")
        self.assertIsNone(check(report, "cleaning_rules")["passed"])

    def test_extra_unheaded_source_cell_is_reported(self):
        rows = list(csv.reader(io.StringIO(baseline_source())))
        rows[1].append("unheaded")
        report = validate(csv_text(rows[1:]), baseline_output(), "baseline")
        self.assertFalse(check(report, "source_schema")["passed"])
        error = report["csv_errors"]["source"][0]
        self.assertEqual((error["code"], error["row"], error["expected_fields"], error["actual_fields"]),
                         ("row_width", 2, 6, 7))

    def test_missing_source_cell_is_not_treated_as_missing_value(self):
        rows = list(csv.reader(io.StringIO(baseline_source())))
        rows[1].pop()
        report = validate(csv_text(rows[1:]), baseline_output(), "baseline")
        self.assertFalse(check(report, "source_schema")["passed"])
        self.assertEqual(report["csv_errors"]["source"][0]["actual_fields"], 5)

    def test_intentional_named_extra_column_and_quoted_text_remain_valid(self):
        source = csv_text([["2001", " USER@Example.com ", "Two,\nLines", "2.50", "04/05/2026", "usa", ""]],
                          COLUMNS + ["coupon_code"])
        output = csv_text([["2001", "user@example.com", "Two,\nLines", "2.5", "2026-04-05", "US"]])
        report = validate(source, output, "schema-add-column")
        self.assertTrue(report["passed"], report)
        self.assertEqual(report["source_extra_columns"], ["coupon_code"])

    def test_malformed_output_has_clear_width_diagnostic(self):
        malformed = baseline_output().replace("US", "US,unheaded", 1)
        report = validate(baseline_source(), malformed, "baseline")
        self.assertFalse(check(report, "output_schema")["passed"])
        self.assertEqual(report["csv_errors"]["output"][0]["code"], "row_width")

    def test_unterminated_quote_returns_report(self):
        report = validate(",".join(COLUMNS) + '\n1001,"unterminated', baseline_output(), "baseline")
        self.assertFalse(check(report, "source_schema")["passed"])
        self.assertEqual(report["csv_errors"]["source"][0]["code"], "csv_syntax")


class InputAlertTests(unittest.TestCase):
    def test_first_valid_duplicate_identity_becoming_invalid_is_alerted(self):
        changed = baseline_source().replace("Bob Lee,42.50", "Bob Lee,invalid", 1)
        rows = list(csv.reader(io.StringIO(baseline_output())))[1:]
        output = csv_text([row for row in rows if row[0] != "1002"])
        report = validate(changed, output, "schema-change-type")
        self.assertFalse(check(report, "new_invalid_values")["passed"])
        self.assertIn("1002", report["new_invalid_details"]["lost_valid_order_ids"])
        self.assertTrue(check(report, "cleaning_rules")["passed"])
        self.assertTrue(check(report, "row_count")["passed"])

    def test_changed_rejection_reason_is_alerted(self):
        changed = baseline_source().replace("not-a-number,04/07/2026", "20.00,impossible")
        report = validate(changed, baseline_output(), "baseline")
        self.assertFalse(check(report, "new_invalid_values")["passed"])
        self.assertIn({"order_id": "1004", "reason": "invalid date"},
                      report["new_invalid_details"]["new_rejection_reasons"])
        self.assertTrue(check(report, "cleaning_rules")["passed"])

    def test_unchanged_baseline_rejections_are_not_new_input_alerts(self):
        self.assertTrue(check(validate(baseline_source(), baseline_output(), "baseline"),
                              "new_invalid_values")["passed"])


class RepeatTests(unittest.TestCase):
    def test_two_identical_outputs_prove_repeat_consistency(self):
        output = baseline_output()
        report = validate(baseline_source(), output, "baseline", [output])
        self.assertTrue(check(report, "determinism")["passed"])
        self.assertEqual(report["comparison"]["available_outputs"], 2)

    def test_two_different_outputs_report_real_variation(self):
        report = validate(baseline_source(), baseline_output(), "baseline", [csv_text([])])
        self.assertFalse(check(report, "determinism")["passed"])
        self.assertEqual(report["comparison"]["status"], "different")

    def test_one_available_output_is_unevaluated_not_variation(self):
        report = validate(baseline_source(), baseline_output(), "baseline", [None])
        self.assertIsNone(check(report, "determinism")["passed"])
        self.assertEqual(report["comparison"]["status"], "insufficient_evidence")

    def test_available_repeats_are_compared_despite_an_unavailable_repeat(self):
        output = baseline_output()
        report = validate(baseline_source(), output, "baseline", [None, output])
        self.assertTrue(check(report, "determinism")["passed"])
        self.assertEqual(report["comparison"]["unavailable_outputs"], 1)

    def test_missing_repeat_cli_retains_primary_results_and_json_file(self):
        with tempfile.TemporaryDirectory() as directory:
            report_path = Path(directory) / "report.json"
            missing_path = Path(directory) / "missing.csv"
            completed = subprocess.run([
                sys.executable, str(ROOT / "data-validation/validate.py"),
                "--scenario", "baseline", "--source", str(ROOT / "datasets/baseline.csv"),
                "--output", str(ROOT / "data-validation/tests/fixtures/expected-baseline-output.csv"),
                "--repeat-output", str(missing_path), "--report", str(report_path),
            ], capture_output=True, text=True)
            self.assertEqual(completed.returncode, 2)
            self.assertNotIn("Traceback", completed.stderr)
            report = json.loads(completed.stdout)
            self.assertEqual(json.loads(report_path.read_text(encoding="utf-8")), report)
            self.assertTrue(check(report, "cleaning_rules")["passed"])
            self.assertIsNone(check(report, "determinism")["passed"])
            error = report["retrieval_errors"][0]
            self.assertEqual((error["role"], error["uri"]), ("repeat_output", str(missing_path)))
            self.assertIn("FileNotFoundError", error["error"])


class DateAndAmountTests(unittest.TestCase):
    def test_iso_input_date_is_accepted(self):
        source = csv_text([["2001", "user@example.com", "User", "2.50", "2026-04-05", "US"]])
        output = csv_text([["2001", "user@example.com", "User", "2.50", "2026-04-05", "US"]])
        self.assertTrue(validate(source, output, "baseline")["passed"])

    def test_slash_date_meaning_depends_on_declared_semantic_case(self):
        source = csv_text([["2001", "user@example.com", "User", "2.50", "04/05/2026", "US"]])
        for scenario, expected_date in [("baseline", "2026-04-05"), ("semantic-day-month", "2026-05-04")]:
            with self.subTest(scenario=scenario):
                output = csv_text([["2001", "user@example.com", "User", "2.50", expected_date, "US"]])
                self.assertTrue(validate(source, output, scenario)["passed"])

    def test_large_finite_amount_can_be_rounded_without_default_precision_loss(self):
        amount = "100000000000000000000000000000000000000000000000000.12"
        source = csv_text([["2001", "user@example.com", "User", amount, "04/05/2026", "US"]])
        output = csv_text([["2001", "user@example.com", "User", amount, "2026-04-05", "US"]])
        self.assertTrue(validate(source, output, "baseline")["passed"])

    def test_extreme_exponent_reports_limit_instead_of_overflow(self):
        source = csv_text([["2001", "user@example.com", "User", "1e999999999", "04/05/2026", "US"]])
        report = validate(source, csv_text([]), "semantic-cents")
        self.assertFalse(report["passed"])
        self.assertEqual(report["validation_errors"][0]["code"], "amount_range")
        self.assertIsNone(check(report, "cleaning_rules")["passed"])
        json.dumps(report)

    def test_numeric_literal_beyond_decimal_representation_is_not_an_invalid_row(self):
        for amount in ["1e9999999999999999999", "1e-9999999999999999999"]:
            with self.subTest(amount=amount):
                source = csv_text([["2001", "user@example.com", "User", amount, "04/05/2026", "US"]])
                report = validate(source, csv_text([]), "baseline")
                self.assertEqual(report["validation_errors"][0]["code"], "amount_range")
                self.assertIsNone(check(report, "cleaning_rules")["passed"])


class SavedAICleaningTests(unittest.TestCase):
    def test_blank_order_id_is_rejected_independently_of_ai_code(self):
        fixture = ROOT / "data-validation/tests/fixtures/whitespace-order-id-source.csv"
        expected = ROOT / "data-validation/tests/fixtures/whitespace-order-id-expected.csv"
        source = fixture.read_text(encoding="utf-8")
        clean_output = expected.read_text(encoding="utf-8")
        self.assertTrue(check(validate(source, clean_output, "baseline"), "cleaning_rules")["passed"])
        bad_output = csv_text([["", "blank@example.com", "Blank ID", "5.00", "2026-04-05", "US"],
                               ["2001", "valid@example.com", "Valid ID", "10.00", "2026-04-06", "US"]])
        self.assertFalse(check(validate(source, bad_output, "baseline"), "cleaning_rules")["passed"])

    def test_historical_ai_code_retains_blank_id_and_validator_detects_it(self):
        try:
            import pandas as pd
        except ImportError:
            self.skipTest("pandas is needed only for replaying the saved AI code")
        source = (ROOT / "data-validation/tests/fixtures/whitespace-order-id-source.csv").read_text(encoding="utf-8")
        artifact = ROOT / "observations/evidence/ui-journey/2026-10-03T09-03-59-050Z/generated-code.txt"
        namespace = {"pd": pd, "input_df_1": pd.read_csv(io.StringIO(source), dtype=object)}
        # Reviewed, unmodified historical code: local dataframe operations only.
        exec(compile(artifact.read_text(encoding="utf-8"), str(artifact), "exec"), namespace)
        output = namespace["output_df"].to_csv(index=False)
        self.assertEqual(namespace["output_df"]["order_id"].tolist(), ["", "2001"])
        report = validate(source, output, "baseline")
        self.assertFalse(check(report, "cleaning_rules")["passed"])
        self.assertFalse(check(report, "row_count")["passed"])


if __name__ == "__main__":
    unittest.main()
