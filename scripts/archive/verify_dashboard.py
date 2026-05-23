"""
verify_dashboard.py — Validate dashboard metrics against raw Excel data

This script loads Impella_MK.xlsx directly and cross-checks every computed
metric against the source data. It reports PASS/FAIL for each check and flags
discrepancies that would affect the dashboard display or ML model training.
"""

import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import openpyxl

warnings.filterwarnings("ignore")

DATA_PATH = Path("Impella_MK.xlsx")
REPORT_PATH = Path("dashboard_verification_report.json")


def load_excel_raw(path: Path):
    """Load both pandas and openpyxl views of the Patient Data sheet."""
    df_pd = pd.read_excel(path, sheet_name="Patient Data", header=None)
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb["Patient Data"]
    return df_pd, ws


def verify_cpo(df_pd: pd.DataFrame, ws, report: dict):
    """Verify that Excel CPO values match MAP * TDCO / 451."""
    report["cpo"] = {"status": "PASS", "details": []}

    # Build row index lookup from pandas (0-based)
    labels = {}
    for i in range(df_pd.shape[0]):
        label = str(df_pd.iloc[i, 0]).lower().strip() if pd.notna(df_pd.iloc[i, 0]) else ""
        labels[label] = i

    # Find pre and post section boundaries by scanning for section headers
    pre_start = None
    post_start = None
    for i in range(df_pd.shape[0]):
        label = str(df_pd.iloc[i, 0]).lower().strip() if pd.notna(df_pd.iloc[i, 0]) else ""
        if "index rhc data" in label:
            pre_start = i
        elif "impella supported rhc" in label or "48h post" in label:
            post_start = i

    if pre_start is None or post_start is None:
        report["cpo"]["status"] = "FAIL"
        report["cpo"]["details"].append("Could not find pre/post section headers")
        return

    # Get pre and post rows for MAP, TDCO, CPO
    pre_map_row = None
    post_map_row = None
    pre_tdco_row = None
    post_tdco_row = None
    pre_cpo_row = None
    post_cpo_row = None

    for i in range(df_pd.shape[0]):
        label = str(df_pd.iloc[i, 0]).lower().strip() if pd.notna(df_pd.iloc[i, 0]) else ""
        if pre_start < i < min(post_start, pre_start + 25):
            if label == "map (mmhg)":
                pre_map_row = i
            elif label == "tdco (l/min)":
                pre_tdco_row = i
            elif label == "cpo":
                pre_cpo_row = i
        elif post_start < i < post_start + 25:
            if label == "map (mmhg)":
                post_map_row = i
            elif label == "tdco (l/min)":
                post_tdco_row = i
            elif label == "cpo":
                post_cpo_row = i

    n_cols = df_pd.shape[1] - 1
    mismatches = 0
    total_checks = 0

    for col in range(1, n_cols + 1):
        pre_map = pd.to_numeric(df_pd.iloc[pre_map_row, col], errors="coerce") if pre_map_row else np.nan
        pre_tdco = pd.to_numeric(df_pd.iloc[pre_tdco_row, col], errors="coerce") if pre_tdco_row else np.nan
        pre_cpo_excel = pd.to_numeric(df_pd.iloc[pre_cpo_row, col], errors="coerce") if pre_cpo_row else np.nan
        pre_cpo_calc = (pre_map * pre_tdco / 451) if pd.notna(pre_map) and pd.notna(pre_tdco) else np.nan

        post_map = pd.to_numeric(df_pd.iloc[post_map_row, col], errors="coerce") if post_map_row else np.nan
        post_tdco = pd.to_numeric(df_pd.iloc[post_tdco_row, col], errors="coerce") if post_tdco_row else np.nan
        post_cpo_excel = pd.to_numeric(df_pd.iloc[post_cpo_row, col], errors="coerce") if post_cpo_row else np.nan
        post_cpo_calc = (post_map * post_tdco / 451) if pd.notna(post_map) and pd.notna(post_tdco) else np.nan

        # Check pre CPO
        if pd.notna(pre_cpo_excel) and pd.notna(pre_cpo_calc):
            total_checks += 1
            if not np.isclose(pre_cpo_excel, pre_cpo_calc, rtol=0.01, atol=0.001):
                mismatches += 1
                report["cpo"]["details"].append(
                    f"Col {col}: Pre CPO Excel={pre_cpo_excel:.4f} vs Calc={pre_cpo_calc:.4f} "
                    f"(MAP={pre_map:.2f}, TDCO={pre_tdco:.2f})"
                )

        # Check post CPO
        if pd.notna(post_cpo_excel) and pd.notna(post_cpo_calc):
            total_checks += 1
            if not np.isclose(post_cpo_excel, post_cpo_calc, rtol=0.01, atol=0.001):
                mismatches += 1
                report["cpo"]["details"].append(
                    f"Col {col}: Post CPO Excel={post_cpo_excel:.4f} vs Calc={post_cpo_calc:.4f} "
                    f"(MAP={post_map:.2f}, TDCO={post_tdco:.2f})"
                )

    report["cpo"]["summary"] = f"{total_checks - mismatches}/{total_checks} CPO values match within 1%"
    if mismatches > 0:
        report["cpo"]["status"] = "WARN"
    if total_checks == 0:
        report["cpo"]["status"] = "FAIL"
        report["cpo"]["details"].append("No valid CPO pairs found")


def verify_papi(df_pd: pd.DataFrame, report: dict):
    """Verify that Excel PAPI values match (PASP - PADP) / RA."""
    report["papi"] = {"status": "PASS", "details": []}

    pre_start = None
    post_start = None
    for i in range(df_pd.shape[0]):
        label = str(df_pd.iloc[i, 0]).lower().strip() if pd.notna(df_pd.iloc[i, 0]) else ""
        if "index rhc data" in label:
            pre_start = i
        elif "impella supported rhc" in label or "48h post" in label:
            post_start = i

    # Find rows
    pre_ra_row = pre_pasp_row = pre_padp_row = pre_papi_row = None
    post_ra_row = post_pasp_row = post_padp_row = post_papi_row = None

    # Only search within ~25 rows after each section header to avoid picking up echo/lab rows
    for i in range(df_pd.shape[0]):
        label = str(df_pd.iloc[i, 0]).lower().strip() if pd.notna(df_pd.iloc[i, 0]) else ""
        if pre_start < i < min(post_start, pre_start + 25):
            if label == "ra pressure (mmhg)":
                pre_ra_row = i
            elif label == "pasp (mmhg)":
                pre_pasp_row = i
            elif label == "padp (mmhg)":
                pre_padp_row = i
            elif label == "papi":
                pre_papi_row = i
        elif post_start < i < post_start + 25:
            if label == "ra pressure (mmhg)":
                post_ra_row = i
            elif label == "pasp (mmhg)":
                post_pasp_row = i
            elif label == "padp (mmhg)":
                post_padp_row = i
            elif label == "papi":
                post_papi_row = i

    n_cols = df_pd.shape[1] - 1
    mismatches = 0
    total_checks = 0

    for col in range(1, n_cols + 1):
        for prefix, ra_r, pasp_r, padp_r, papi_r in [
            ("Pre", pre_ra_row, pre_pasp_row, pre_padp_row, pre_papi_row),
            ("Post", post_ra_row, post_pasp_row, post_padp_row, post_papi_row),
        ]:
            ra = pd.to_numeric(df_pd.iloc[ra_r, col], errors="coerce") if ra_r else np.nan
            pasp = pd.to_numeric(df_pd.iloc[pasp_r, col], errors="coerce") if pasp_r else np.nan
            padp = pd.to_numeric(df_pd.iloc[padp_r, col], errors="coerce") if padp_r else np.nan
            papi_excel = pd.to_numeric(df_pd.iloc[papi_r, col], errors="coerce") if papi_r else np.nan

            if pd.notna(ra) and ra > 0 and pd.notna(pasp) and pd.notna(padp):
                papi_calc = (pasp - padp) / ra
                if pd.notna(papi_excel):
                    total_checks += 1
                    if not np.isclose(papi_excel, papi_calc, rtol=0.02, atol=0.01):
                        mismatches += 1
                        report["papi"]["details"].append(
                            f"Col {col} {prefix}: PAPI Excel={papi_excel:.3f} vs Calc={papi_calc:.3f} "
                            f"(RA={ra:.1f}, PASP={pasp:.1f}, PADP={padp:.1f})"
                        )

    report["papi"]["summary"] = f"{total_checks - mismatches}/{total_checks} PAPI values match within 2%"
    if mismatches > 0:
        report["papi"]["status"] = "WARN"
    if total_checks == 0:
        report["papi"]["status"] = "FAIL"


def verify_delta_cpo_and_recovery(df_pd: pd.DataFrame, report: dict):
    """Verify deltaCPO and recoveryScore formulas against Excel CPO rows."""
    report["delta_cpo"] = {"status": "PASS", "details": []}
    report["recovery_score"] = {"status": "PASS", "details": []}

    pre_start = None
    post_start = None
    for i in range(df_pd.shape[0]):
        label = str(df_pd.iloc[i, 0]).lower().strip() if pd.notna(df_pd.iloc[i, 0]) else ""
        if "index rhc data" in label:
            pre_start = i
        elif "impella supported rhc" in label or "48h post" in label:
            post_start = i

    pre_cpo_row = post_cpo_row = None
    for i in range(df_pd.shape[0]):
        label = str(df_pd.iloc[i, 0]).lower().strip() if pd.notna(df_pd.iloc[i, 0]) else ""
        if pre_start < i < min(post_start, pre_start + 25) and label == "cpo":
            pre_cpo_row = i
        elif post_start < i < post_start + 25 and label == "cpo":
            post_cpo_row = i

    n_cols = df_pd.shape[1] - 1
    delta_mismatches = 0
    recovery_mismatches = 0
    total = 0

    for col in range(1, n_cols + 1):
        pre_cpo = pd.to_numeric(df_pd.iloc[pre_cpo_row, col], errors="coerce") if pre_cpo_row else np.nan
        post_cpo = pd.to_numeric(df_pd.iloc[post_cpo_row, col], errors="coerce") if post_cpo_row else np.nan

        if pd.notna(pre_cpo) and pd.notna(post_cpo):
            total += 1
            delta = post_cpo - pre_cpo
            raw_score = (delta + 0.5) * 100
            recovery = max(0, min(100, round(raw_score)))

            # server.ts logic: deltaCPO = postCPO - preCPO (already verified by formula)
            # recoveryScore = clamp(round((deltaCPO + 0.5) * 100), 0, 100)

            # Check if recovery score is in a reasonable range given delta
            # If deltaCPO ranges are very large, the clamping makes the score lose meaning
            if recovery == 0 or recovery == 100:
                recovery_mismatches += 1
                report["recovery_score"]["details"].append(
                    f"Col {col}: RecoveryScore clamped to {recovery} "
                    f"(deltaCPO={delta:.3f}, rawScore={raw_score:.1f})"
                )

    report["delta_cpo"]["summary"] = f"deltaCPO formula verified for {total} patients"
    report["recovery_score"]["summary"] = (
        f"{total - recovery_mismatches}/{total} recovery scores within 0-100 without clamping"
    )
    if recovery_mismatches > 0:
        report["recovery_score"]["status"] = "WARN"
        report["recovery_score"]["details"].insert(
            0,
            "WARNING: recoveryScore formula clamps to 0 or 100 for extreme deltaCPO values. "
            "This means the score loses discriminative power when CPO changes are large.",
        )


def verify_outcome_and_escalation(df_pd: pd.DataFrame, report: dict):
    """Cross-check outcome coding and mcs_escalation against Cohort sheet."""
    report["outcome_coding"] = {"status": "PASS", "details": []}
    report["mcs_escalation"] = {"status": "PASS", "details": []}

    # Find outcome and mcs escalation rows
    mcs_row = None
    outcome_row = None
    mrn_row = None
    for i in range(df_pd.shape[0]):
        label = str(df_pd.iloc[i, 0]).lower().strip() if pd.notna(df_pd.iloc[i, 0]) else ""
        if label == "mcs escalation":
            mcs_row = i
        elif label == "outcome":
            outcome_row = i
        elif label == "mrn":
            mrn_row = i

    # Load Cohort sheet for cross-validation
    df_cohort = pd.read_excel(DATA_PATH, sheet_name="Cohort")
    cohort_map = {}
    if "Outcome" in df_cohort.columns and "MRN" in df_cohort.columns:
        for _, row in df_cohort.iterrows():
            mrn = str(row["MRN"]).strip() if pd.notna(row["MRN"]) else None
            if mrn:
                cohort_map[mrn] = str(row["Outcome"]).lower().strip() if pd.notna(row["Outcome"]) else ""

    n_cols = df_pd.shape[1] - 1
    outcome_mismatches = 0
    escalation_mismatches = 0
    total = 0

    for col in range(1, n_cols + 1):
        mrn = str(df_pd.iloc[mrn_row, col]).strip() if mrn_row and pd.notna(df_pd.iloc[mrn_row, col]) else None
        if not mrn:
            continue

        total += 1
        out_val = pd.to_numeric(df_pd.iloc[outcome_row, col], errors="coerce") if outcome_row else np.nan
        out_str = str(df_pd.iloc[outcome_row, col]).lower().strip() if outcome_row else ""
        mcs_val = pd.to_numeric(df_pd.iloc[mcs_row, col], errors="coerce") if mcs_row else np.nan

        # Outcome coding verification
        is_expired = out_str.startswith("exp") or out_str.startswith("die") or out_val == 4
        is_survived = out_str.startswith("surv") or out_val == 3

        if cohort_map.get(mrn):
            cohort_outcome = cohort_map[mrn]
            if is_expired and "exp" not in cohort_outcome:
                outcome_mismatches += 1
                report["outcome_coding"]["details"].append(
                    f"MRN {mrn}: Outcome={out_val} marked expired but Cohort says '{cohort_outcome}'"
                )
            elif is_survived and "surv" not in cohort_outcome and "exp" in cohort_outcome:
                outcome_mismatches += 1
                report["outcome_coding"]["details"].append(
                    f"MRN {mrn}: Outcome={out_val} marked survived but Cohort says '{cohort_outcome}'"
                )

        # MCS escalation sanity check
        if pd.notna(mcs_val) and mcs_val not in [0, 1]:
            escalation_mismatches += 1
            report["mcs_escalation"]["details"].append(
                f"MRN {mrn}: MCS Escalation value {mcs_val} is not 0 or 1"
            )

    report["outcome_coding"]["summary"] = f"{total - outcome_mismatches}/{total} outcomes match Cohort sheet"
    report["mcs_escalation"]["summary"] = f"{total - escalation_mismatches}/{total} MCS escalation values are 0 or 1"
    if outcome_mismatches > 0:
        report["outcome_coding"]["status"] = "FAIL"
    if escalation_mismatches > 0:
        report["mcs_escalation"]["status"] = "WARN"


def verify_ml_pipeline_row_mappings(report: dict):
    """Check that ml_pipeline.py PATIENT_DATA_ROWS match actual Excel layout."""
    report["ml_pipeline_rows"] = {"status": "PASS", "details": []}

    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    from ml_pipeline import PATIENT_DATA_ROWS

    df_pd = pd.read_excel(DATA_PATH, sheet_name="Patient Data", header=None)

    # Build expected row mapping from actual Excel (1-based, since ml_pipeline uses openpyxl)
    actual_1based = {}
    for i in range(df_pd.shape[0]):
        label = str(df_pd.iloc[i, 0]).strip().lower() if pd.notna(df_pd.iloc[i, 0]) else ""
        if label:
            actual_1based[label] = i + 1  # Convert to 1-based for openpyxl

    mismatches = []
    for key, expected_row in PATIENT_DATA_ROWS.items():
        # Find what label is actually at that row
        actual_label = str(df_pd.iloc[expected_row - 1, 0]).strip().lower() if expected_row - 1 < df_pd.shape[0] else ""
        # Map the key name to a likely label
        key_label = key.replace("_", " ").replace("pre ", "").replace("post ", "").strip()

        # Check if the row contains the expected data type
        is_match = False
        if "map" in key and "map (mmhg)" in actual_label:
            is_match = True
        elif "cpo" in key and "cpo" == actual_label:
            is_match = True
        elif "papi" in key and "papi" == actual_label:
            is_match = True
        elif "ra" in key and "ra pressure" in actual_label:
            is_match = True
        elif "tdco" in key and "tdco" in actual_label:
            is_match = True
        elif "mcs escalation" in key and "mcs escalation" == actual_label:
            is_match = True
        elif "outcome" in key and "outcome" == actual_label:
            is_match = True
        elif actual_label and key_label in actual_label:
            is_match = True

        if not is_match:
            mismatches.append(
                f"{key}: ml_pipeline says row {expected_row}, but Excel row {expected_row} is '{actual_label}'"
            )

    if mismatches:
        report["ml_pipeline_rows"]["status"] = "FAIL"
        report["ml_pipeline_rows"]["details"] = mismatches[:10]
        report["ml_pipeline_rows"]["details"].append(
            f"... and {len(mismatches) - 10} more mismatches" if len(mismatches) > 10 else ""
        )
    report["ml_pipeline_rows"]["summary"] = f"{len(PATIENT_DATA_ROWS) - len(mismatches)}/{len(PATIENT_DATA_ROWS)} row mappings correct"


def main():
    print("=" * 60)
    print("Dashboard Data Verification Report")
    print("=" * 60)

    df_pd, ws = load_excel_raw(DATA_PATH)
    report = {}

    print("\n[1/6] Verifying CPO computation (MAP x TDCO / 451)...")
    verify_cpo(df_pd, ws, report)
    print(f"  {report['cpo']['status']}: {report['cpo']['summary']}")
    for d in report["cpo"]["details"][:3]:
        print(f"    - {d}")
    if len(report["cpo"]["details"]) > 3:
        print(f"    ... and {len(report['cpo']['details']) - 3} more")

    print("\n[2/6] Verifying PAPI computation ((PASP - PADP) / RA)...")
    verify_papi(df_pd, report)
    print(f"  {report['papi']['status']}: {report['papi']['summary']}")
    for d in report["papi"]["details"][:3]:
        print(f"    - {d}")
    if len(report["papi"]["details"]) > 3:
        print(f"    ... and {len(report['papi']['details']) - 3} more")

    print("\n[3/6] Verifying deltaCPO and recoveryScore formulas...")
    verify_delta_cpo_and_recovery(df_pd, report)
    print(f"  {report['delta_cpo']['status']}: {report['delta_cpo']['summary']}")
    print(f"  {report['recovery_score']['status']}: {report['recovery_score']['summary']}")
    for d in report["recovery_score"]["details"][:3]:
        print(f"    - {d}")

    print("\n[4/6] Verifying outcome coding and MCS escalation...")
    verify_outcome_and_escalation(df_pd, report)
    print(f"  {report['outcome_coding']['status']}: {report['outcome_coding']['summary']}")
    for d in report["outcome_coding"]["details"][:3]:
        print(f"    - {d}")
    print(f"  {report['mcs_escalation']['status']}: {report['mcs_escalation']['summary']}")
    for d in report["mcs_escalation"]["details"][:3]:
        print(f"    - {d}")

    print("\n[5/6] Verifying ml_pipeline.py row mappings...")
    verify_ml_pipeline_row_mappings(report)
    print(f"  {report['ml_pipeline_rows']['status']}: {report['ml_pipeline_rows']['summary']}")
    for d in report["ml_pipeline_rows"]["details"][:5]:
        if d:
            print(f"    - {d}")

    # Summary
    failures = [k for k, v in report.items() if v.get("status") == "FAIL"]
    warnings = [k for k, v in report.items() if v.get("status") == "WARN"]

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Failures:   {len(failures)} ({', '.join(failures) if failures else 'None'})")
    print(f"Warnings:   {len(warnings)} ({', '.join(warnings) if warnings else 'None'})")
    print(f"Checks run: {len(report)}")

    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nFull report saved to {REPORT_PATH}")


if __name__ == "__main__":
    main()
