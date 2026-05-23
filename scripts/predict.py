"""
predict.py — Standalone prediction script for Node.js integration.

Reads patient data as JSON from stdin, loads trained joblib models,
returns risk scores as JSON to stdout.

Usage:
    echo '{"patients": [...]}' | python predict.py
"""

import json
import sys
import warnings
from pathlib import Path

try:
    import numpy as np
    import pandas as pd
    import joblib
except ImportError as e:
    print(json.dumps({"error": f"Missing Python package: {e}. Please install: pip install pandas scikit-learn joblib"}), flush=True)
    sys.exit(1)

warnings.filterwarnings("ignore")

OUTPUT_DIR = Path("ml_output")

# Feature engineering (must match ml_pipeline.py)
def engineer_patient_features(record: dict) -> dict:
    """Compute derived features for a single patient record."""
    f = dict(record)

    # BMI
    f["bmi"] = f.get("weight_kg", np.nan) / ((f.get("height_cm", np.nan) / 100) ** 2)

    # Delta & ratio for RHC
    rhc_vars = [
        "ra", "rvsp", "rvdp", "pasp", "padp", "map", "pcwp", "pvr",
        "sbp", "dbp", "hr", "tdco", "sv", "pa_o2", "sp_o2", "papi",
        "cpo", "rv_cpo",
    ]
    for v in rhc_vars:
        pre = f.get(f"pre_{v}")
        post = f.get(f"post_{v}")
        if pre is not None and post is not None and not (pd.isna(pre) or pd.isna(post)):
            f[f"delta_{v}"] = post - pre
            f[f"ratio_{v}"] = post / pre if pre != 0 else np.nan
        else:
            f[f"delta_{v}"] = np.nan
            f[f"ratio_{v}"] = np.nan

    # Echo deltas
    echo_vars = ["rvedd", "tapse", "rv_s", "rv_fs", "tr_severity", "echo_pasp", "lvedd"]
    for v in echo_vars:
        pre = f.get(f"pre_{v}")
        post = f.get(f"post_{v}")
        if pre is not None and post is not None and not (pd.isna(pre) or pd.isna(post)):
            f[f"delta_{v}"] = post - pre
            f[f"ratio_{v}"] = post / pre if pre != 0 else np.nan
        else:
            f[f"delta_{v}"] = np.nan
            f[f"ratio_{v}"] = np.nan

    # Lab deltas
    lab_vars = ["sodium", "potassium", "hco3", "creatinine", "egfr",
                "hemoglobin", "wbc", "ast", "alt", "bili", "lactate", "ph"]
    for v in lab_vars:
        pre = f.get(f"pre_{v}")
        post = f.get(f"post_{v}")
        if pre is not None and post is not None and not (pd.isna(pre) or pd.isna(post)):
            f[f"delta_{v}"] = post - pre
        else:
            f[f"delta_{v}"] = np.nan

    # Composite
    pre_cpo = f.get("pre_cpo", np.nan)
    post_cpo = f.get("post_cpo", np.nan)
    f["delta_cpo"] = post_cpo - pre_cpo if not (pd.isna(pre_cpo) or pd.isna(post_cpo)) else np.nan
    f["recovery_score"] = np.clip((f["delta_cpo"] + 0.5) * 100, 0, 100) if not pd.isna(f["delta_cpo"]) else np.nan

    vis = f.get("vis_score", np.nan)
    f["vis_high"] = 1 if vis > 15 else 0 if not pd.isna(vis) else np.nan

    inotrope_cols = ["dopamine", "dobutamine", "epinephrine", "milrinone", "norepinephrine", "vasopressin"]
    f["inotrope_count"] = sum(1 for c in inotrope_cols if f.get(c, 0) > 0)

    scai_map = {"b": 1, "c": 2, "d": 3, "e": 4}
    scai = str(f.get("scai_stage", "")).lower()
    f["scai_numeric"] = scai_map.get(scai, np.nan)
    # Ensure scai_stage is numeric for model compatibility (training data reads it as a number)
    f["scai_stage"] = f["scai_numeric"]

    f["shock_cause_numeric"] = pd.to_numeric(f.get("cause_of_shock"), errors="coerce")
    f["gender_numeric"] = pd.to_numeric(f.get("gender"), errors="coerce")
    f["race_numeric"] = pd.to_numeric(f.get("race"), errors="coerce")

    return f


def load_model(target_name: str):
    path = OUTPUT_DIR / f"model_{target_name}.joblib"
    if not path.exists():
        return None
    artifact = joblib.load(path)
    return artifact


def predict_patient(patient: dict, artifacts: dict) -> dict:
    """Return dict of risk scores for one patient."""
    f = engineer_patient_features(patient)
    scores = {}
    for target_name, artifact in artifacts.items():
        model = artifact["model"]
        imputer = artifact["imputer"]
        scaler = artifact["scaler"]
        feature_names = artifact["feature_names"]

        row = {name: f.get(name, np.nan) for name in feature_names}
        X = pd.DataFrame([row])
        X_imp = imputer.transform(X)
        X_scl = scaler.transform(X_imp)

        proba = model.predict_proba(X_scl)[0][1]
        scores[target_name] = float(proba)
    return scores


def main():
    raw = sys.stdin.read()
    if not raw:
        print(json.dumps({"error": "No input"}), file=sys.stderr)
        sys.exit(1)

    data = json.loads(raw)
    patients = data.get("patients", [])

    # Load all available models
    artifacts = {}
    for target in ["survival", "escalation", "rv_dysfunction"]:
        art = load_model(target)
        if art:
            artifacts[target] = art

    if not artifacts:
        print(json.dumps({"error": "No trained models found in ml_output/"}), file=sys.stderr)
        sys.exit(1)

    predictions = []
    for p in patients:
        scores = predict_patient(p, artifacts)
        predictions.append({
            "patientId": p.get("id", "unknown"),
            "scores": scores,
        })

    print(json.dumps({"predictions": predictions}))


if __name__ == "__main__":
    main()
