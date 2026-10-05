"""Local contracts for the prepared controlled schema fixtures.

The structural checks use only the standard library. The inference checks need
pandas (verified with 3.0.0) and skip only when pandas is not installed. These
tests inspect saved CSVs; they do not execute a Rhombus pipeline.
"""

import csv
from decimal import Decimal
import hashlib
from pathlib import Path
import unittest

try:
    import pandas as pd
except ModuleNotFoundError as error:
    if error.name != "pandas":
        raise
    pd = None


ROOT = Path(__file__).resolve().parents[2]
DATASETS = ROOT / "datasets"
BASELINE = "controlled-schema-baseline.csv"
ORIGINAL_SHA256 = {
    "baseline.csv": "6bc9a17c1734676986c1d48ad1122b132e3d71e1b60c3867f6687b3d8d08139e",
    "schema-add-column.csv": "489af7a455fd93c92883eb706d5d710cf6c68410df9aa5515631e19d8f86c1cf",
    "schema-change-type.csv": "8dea4e6f523998454a0c2947878110064acbea187e9108ee6cd96f9f43a17043",
    "schema-combined.csv": "db324a214ae4f86757ca3a9ebd4724867a7055957c349003cd3de34e852a2e57",
    "schema-drop-column.csv": "b1badb6e1f38a6e09947444add5f49f3c58a087aa77955c793a8265f41252e3e",
    "schema-rename-column.csv": "0ec56161346bdc3d1307784ff7e73de7ccd5ff6af7e165dc2d7589a988c0c0b6",
    "semantic-cents.csv": "1b3755cbc27da11fe6ff9bb509fd463c0d5b39d4cc4d41de369742fa306c09ec",
    "semantic-day-month.csv": "2a2752026188ea3c5ae0c7995167bec2cd6bcc2239f0e71dcfe4d8382e7ce99a",
}


class SchemaFixtureTests(unittest.TestCase):
    def fixture(self, name):
        path = DATASETS / name
        self.assertTrue(path.is_file(), f"Prepared fixture is missing: {name}")
        with path.open(encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            headers = reader.fieldnames
            rows = list(reader)
        self.assertIsNotNone(headers)
        self.assertEqual(len(headers), len(set(headers)), name)
        for row in rows:
            self.assertNotIn(None, row, f"Extra cells in {name}")
            self.assertNotIn(None, row.values(), f"Missing cells in {name}")
        return headers, rows

    def test_original_csv_bytes_are_preserved(self):
        for name, expected_hash in ORIGINAL_SHA256.items():
            with self.subTest(name=name):
                actual_hash = hashlib.sha256((DATASETS / name).read_bytes()).hexdigest()
                self.assertEqual(actual_hash, expected_hash)

    def test_controlled_baseline_only_replaces_the_existing_invalid_amount(self):
        original_headers, original_rows = self.fixture("baseline.csv")
        headers, rows = self.fixture(BASELINE)
        self.assertEqual(headers, original_headers)
        self.assertEqual(len(rows), 9)
        expected_rows = [row.copy() for row in original_rows]
        expected_rows[4]["amount_usd"] = "64.00"
        self.assertEqual(rows, expected_rows)
        for row in rows:
            amount = Decimal(row["amount_usd"])
            self.assertTrue(amount.is_finite() and amount > 0, row)

    def test_controlled_drop_removes_only_country_and_retains_amount(self):
        baseline_headers, baseline_rows = self.fixture(BASELINE)
        headers, rows = self.fixture("controlled-schema-drop-column.csv")
        self.assertEqual(headers, [name for name in baseline_headers if name != "country"])
        expected_rows = [{name: value for name, value in row.items() if name != "country"}
                         for row in baseline_rows]
        self.assertEqual(rows, expected_rows)

    def test_controlled_rename_preserves_email_values(self):
        baseline_headers, baseline_rows = self.fixture(BASELINE)
        headers, rows = self.fixture("controlled-schema-rename-column.csv")
        self.assertEqual(headers, ["order_id", "email", "customer_name", "amount_usd",
                                   "order_date", "country"])
        self.assertIn("customer_email", baseline_headers)
        restored_rows = [{("customer_email" if name == "email" else name): value
                          for name, value in row.items()} for row in rows]
        self.assertEqual(restored_rows, baseline_rows)

    def test_controlled_add_uses_coupon_code_and_preserves_existing_cells(self):
        baseline_headers, baseline_rows = self.fixture(BASELINE)
        headers, rows = self.fixture("controlled-schema-add-column.csv")
        self.assertEqual(headers, baseline_headers + ["coupon_code"])
        self.assertEqual([row["coupon_code"] for row in rows], ["SPRING10"] + [""] * 8)
        without_coupon = [{name: value for name, value in row.items() if name != "coupon_code"}
                          for row in rows]
        self.assertEqual(without_coupon, baseline_rows)

    def test_controlled_type_changes_only_order_1006_amount_to_words(self):
        baseline_headers, baseline_rows = self.fixture(BASELINE)
        headers, rows = self.fixture("controlled-schema-change-type.csv")
        self.assertEqual(headers, baseline_headers)
        expected_rows = [row.copy() for row in baseline_rows]
        self.assertEqual(expected_rows[5]["order_id"], "1006")
        self.assertEqual(expected_rows[5]["amount_usd"], "120.00")
        expected_rows[5]["amount_usd"] = "one hundred twenty"
        self.assertEqual(rows, expected_rows)

    def test_controlled_combined_is_the_composition_of_the_individual_changes(self):
        _, drop_rows = self.fixture("controlled-schema-drop-column.csv")
        _, rename_rows = self.fixture("controlled-schema-rename-column.csv")
        _, type_rows = self.fixture("controlled-schema-change-type.csv")
        _, add_rows = self.fixture("controlled-schema-add-column.csv")
        headers, rows = self.fixture("controlled-schema-combined.csv")
        self.assertEqual(headers, ["order_id", "email", "customer_name", "amount_usd",
                                   "order_date", "coupon_code"])
        self.assertEqual(len(rows), 9)
        expected_rows = []
        for index, row in enumerate(drop_rows):
            expected = row.copy()
            del expected["customer_email"]
            expected["email"] = rename_rows[index]["email"]
            expected["amount_usd"] = type_rows[index]["amount_usd"]
            expected["coupon_code"] = add_rows[index]["coupon_code"]
            expected_rows.append(expected)
        self.assertEqual(rows, expected_rows)

    @unittest.skipIf(pd is None, "Install pandas to reproduce CSV dtype inference")
    def test_controlled_amount_has_an_actual_numeric_to_string_dtype_transition(self):
        for name in [BASELINE, "controlled-schema-drop-column.csv",
                     "controlled-schema-rename-column.csv", "controlled-schema-add-column.csv"]:
            with self.subTest(name=name):
                self.fixture(name)
                amount = pd.read_csv(DATASETS / name)["amount_usd"]
                self.assertTrue(pd.api.types.is_numeric_dtype(amount.dtype), str(amount.dtype))
        for name in ["controlled-schema-change-type.csv", "controlled-schema-combined.csv"]:
            with self.subTest(name=name):
                self.fixture(name)
                amount = pd.read_csv(DATASETS / name)["amount_usd"]
                self.assertFalse(pd.api.types.is_numeric_dtype(amount.dtype), str(amount.dtype))
                self.assertTrue(pd.api.types.is_string_dtype(amount), str(amount.dtype))
                self.assertEqual(amount.iloc[5], "one hundred twenty")

    @unittest.skipIf(pd is None, "Install pandas to reproduce CSV dtype inference")
    def test_original_type_case_is_invalid_value_drift_without_a_dtype_transition(self):
        for name in ["baseline.csv", "schema-change-type.csv"]:
            with self.subTest(name=name):
                amount = pd.read_csv(DATASETS / name)["amount_usd"]
                self.assertFalse(pd.api.types.is_numeric_dtype(amount.dtype), str(amount.dtype))
                self.assertTrue(pd.api.types.is_string_dtype(amount), str(amount.dtype))


if __name__ == "__main__":
    unittest.main()
