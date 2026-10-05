# Dataset families

All `controlled-schema-*` files were prepared locally on 5 October 2026. They have not been uploaded or executed in Rhombus. Original CSVs and saved cloud evidence are unchanged.

## Original family

`baseline.csv`, the five `schema-*.csv` files and the two `semantic-*.csv` files retain their original contents and expectations. The recorded manual baseline evidence belongs to this family.

The original baseline includes `amount_usd=not-a-number` for order `1004`. With default `pandas.read_csv` inference in pandas 3.0.0, both `baseline.csv` and `schema-change-type.csv` therefore have a string `amount_usd` dtype (`str`). The original type case adds another invalid amount; it does not demonstrate an inferred column dtype transition.

The original combined case also differs from the individual cases: it drops `country`, renames to `contact_email` and adds `loyalty_tier`, while the individual files drop `amount_usd`, rename to `email` and add `coupon_code`. It is a separate multi-change input rather than the exact combination of those individual variants.

## Controlled schema family

The controlled baseline copies all six headers and nine rows from the original baseline, changing only order `1004`'s invalid amount to synthetic `64.00`. This value is a fixture control, not a recovered real amount. Duplicate rows, missing email/name, country spellings and the invalid date remain, so this is a numeric amount baseline rather than an already-cleaned export.

Each individual variant changes only the stated feature of that controlled baseline:

| File | Change from controlled baseline | Local `amount_usd` dtype, pandas 3.0.0 |
| --- | --- | --- |
| [controlled-schema-baseline.csv](controlled-schema-baseline.csv) | Numeric amount control | `float64` |
| [controlled-schema-drop-column.csv](controlled-schema-drop-column.csv) | Drop `country`; retain `amount_usd` | `float64` |
| [controlled-schema-rename-column.csv](controlled-schema-rename-column.csv) | Rename `customer_email` to `email`; retain all values | `float64` |
| [controlled-schema-change-type.csv](controlled-schema-change-type.csv) | Change order `1006` from `120.00` to `one hundred twenty` | `str` |
| [controlled-schema-add-column.csv](controlled-schema-add-column.csv) | Add `coupon_code`: `SPRING10` for `1001`, empty elsewhere | `float64` |
| [controlled-schema-combined.csv](controlled-schema-combined.csv) | Apply exactly all four individual changes | `str` |

Dropping `country` leaves the amount column available for the combined type change. The combined file uses the same email name, coupon values and amount replacement as the individual files. All six files retain nine rows in the original order.

Under the documented original cleaning rules, the controlled baseline would keep six orders (`1001, 1002, 1004, 1006, 1007, 1008`); the controlled type case would keep five (`1001, 1002, 1004, 1007, 1008`). These are expectations, not observed exports. Drop, rename and combined cases need explicit missing-field/mapping handling before their output can be assessed. A future scheduled assessment needs a successful automatic baseline from this controlled family first.

## Reproduce local checks

From the repository root:

```bash
python -m unittest discover -s data-validation/tests -p test_schema_fixtures.py -v
```

Structural and original-file preservation checks use Python's standard library. Two dtype characterization tests additionally require pandas and skip only when pandas is absent. To reproduce the recorded inference result in an environment with pandas installed:

```bash
python -m pip install pandas==3.0.0
python -c "import pandas as pd; print(pd.__version__); print(pd.read_csv('datasets/controlled-schema-baseline.csv')['amount_usd'].dtype); print(pd.read_csv('datasets/controlled-schema-change-type.csv')['amount_usd'].dtype)"
```

The local dtype result describes pandas inference; Rhombus ingestion and drift handling remain unassessed. Existing validator scenario labels and their comparison baseline continue to describe the original family. This addition does not introduce controlled-family CLI scenarios or validate an actual controlled-family export.
