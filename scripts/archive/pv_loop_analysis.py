"""
pv_loop_analysis.py — Focused PV Loop analysis for MCS Escalation

This script:
1. Trains a PV-loop-only logistic regression (interpretable)
2. Generates SHAP values for the full escalation RandomForest model
3. Creates a scatter plot of Ees/Ea vs escalation
4. Exports everything as JSON for the frontend

Usage:
    python pv_loop_analysis.py
"""

import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, roc_curve

import shap
import joblib

warnings.filterwarnings("ignore")

DATA_PATH = Path("Impella_MK.xlsx")
OUTPUT_DIR = Path("ml_output")
OUTPUT_DIR.mkdir(exist_ok=True)

RANDOM_STATE = 42


def sanitize_json(obj):
    """Replace NaN/Inf with None for valid JSON serialization."""
    if isinstance(obj, dict):
        return {k: sanitize_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_json(v) for v in obj]
    elif isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    return obj

# Import existing pipeline helpers
import sys
sys.path.insert(0, str(Path(__file__).parent))
from ml_pipeline import load_patient_data, load_cohort, build_targets, engineer_features


def train_pv_loop_model(df: pd.DataFrame) -> dict:
    """Train PV-loop-only logistic regression for escalation."""
    pv_cols = ["ees_ea", "esp", "edp", "pmax"]
    available = [c for c in pv_cols if c in df.columns]

    df_model = df[available + ["target_escalation"]].dropna()
    if len(df_model) < 10 or df_model["target_escalation"].nunique() < 2:
        print("  [PV] Insufficient data for PV-loop model")
        return {}

    X = df_model[available].values
    y = df_model["target_escalation"].astype(int).values

    imputer = SimpleImputer(strategy="median")
    scaler = StandardScaler()
    X_imp = imputer.fit_transform(X)
    X_scl = scaler.fit_transform(X_imp)

    model = LogisticRegression(max_iter=1000, random_state=RANDOM_STATE, class_weight="balanced")
    model.fit(X_scl, y)
    probs = model.predict_proba(X_scl)[:, 1]
    auc = roc_auc_score(y, probs)

    # Per-feature coefficients (on standardized scale)
    coefficients = {available[i]: float(model.coef_[0][i]) for i in range(len(available))}
    intercept = float(model.intercept_[0])

    # Odds ratios (per 1-SD change)
    odds_ratios = {k: float(np.exp(v)) for k, v in coefficients.items()}

    print(f"  [PV] PV-loop escalation model: AUC = {auc:.3f}, n = {len(y)}, pos = {y.sum()}")

    # ROC curve data
    fpr, tpr, thresholds = roc_curve(y, probs)
    # Replace infinite thresholds with a sentinel for JSON safety
    thresholds_safe = [float("nan") if np.isinf(t) else float(t) for t in thresholds]

    result = {
        "auc": float(auc),
        "n": int(len(y)),
        "n_pos": int(y.sum()),
        "feature_names": available,
        "coefficients": coefficients,
        "intercept": intercept,
        "odds_ratios": odds_ratios,
        "scaler_mean": scaler.mean_.tolist(),
        "scaler_scale": scaler.scale_.tolist(),
        "imputer_statistics": imputer.statistics_.tolist(),
        "roc": {
            "fpr": fpr.tolist(),
            "tpr": tpr.tolist(),
            "thresholds": thresholds_safe,
        },
        "predictions": [
            {"index": int(i), "actual": int(y[i]), "probability": float(probs[i])}
            for i in range(len(y))
        ],
    }

    # Save model artifact
    joblib.dump({"model": model, "imputer": imputer, "scaler": scaler, "feature_names": available},
                OUTPUT_DIR / "model_pv_loop_escalation.joblib")

    with open(OUTPUT_DIR / "pv_loop_escalation_model.json", "w") as f:
        json.dump(sanitize_json(result), f, indent=2)

    return result


def generate_pv_loop_scatter(df: pd.DataFrame):
    """Scatter plot of Ees/Ea vs escalation with logistic fit."""
    df_plot = df[["ees_ea", "target_escalation", "first_name", "last_name", "mrn"]].dropna()
    if len(df_plot) < 5:
        print("  [PV] Insufficient data for scatter plot")
        return

    fig, ax = plt.subplots(figsize=(8, 5))

    escalated = df_plot[df_plot["target_escalation"] == 1]
    not_escalated = df_plot[df_plot["target_escalation"] == 0]

    ax.scatter(not_escalated["ees_ea"], np.zeros(len(not_escalated)) - 0.02,
               alpha=0.6, s=80, color="#22c55e", label="Not Escalated", marker="o", edgecolors="white", linewidth=0.5)
    ax.scatter(escalated["ees_ea"], np.ones(len(escalated)) + 0.02,
               alpha=0.8, s=100, color="#ef4444", label="Escalated", marker="X", edgecolors="white", linewidth=0.5)

    # Use the multivariate PV-loop model for the curve so the S-shape is visible.
    # The univariate Ees/Ea model is too weak (AUC ~0.59) and its sigmoid is so
    # stretched that it looks flat over the data range.
    artifact_path = OUTPUT_DIR / "model_pv_loop_escalation.joblib"
    if artifact_path.exists():
        artifact = joblib.load(artifact_path)
        model = artifact["model"]
        imputer = artifact["imputer"]
        scaler = artifact["scaler"]
        feature_names = artifact["feature_names"]

        medians = df[feature_names].median().to_dict()

        # Build a grid of Ees/Ea values that extends well beyond the data so the
        # sigmoid tails (p -> 0 and p -> 1) are visible.
        data_min = float(df_plot["ees_ea"].min())
        data_max = float(df_plot["ees_ea"].max())
        span = data_max - data_min
        # Start at 0 (Ees/Ea can't be negative) and extend 1.5x the data span
        # past the maximum so the asymptotic tail is visible without wasting space.
        x_min = 0.0
        x_max = data_max + 1.5 * span
        x_range = np.linspace(x_min, x_max, 500)

        grid_rows = []
        for val in x_range:
            row = dict(medians)
            row["ees_ea"] = val
            grid_rows.append(row)

        grid_df = pd.DataFrame(grid_rows, columns=feature_names)
        grid_imp = imputer.transform(grid_df)
        grid_scl = scaler.transform(grid_imp)
        y_prob = model.predict_proba(grid_scl)[:, 1]
        ax.plot(x_range, y_prob, color="#3b82f6", linewidth=2.5, label="Logistic fit")
    else:
        # Fallback: univariate model on raw Ees/Ea (will look nearly flat)
        X = df_plot["ees_ea"].values.reshape(-1, 1)
        y = df_plot["target_escalation"].values
        fit_model = LogisticRegression(max_iter=1000)
        fit_model.fit(X, y)
        x_range = np.linspace(df_plot["ees_ea"].min() * 0.9, df_plot["ees_ea"].max() * 1.1, 200)
        y_prob = fit_model.predict_proba(x_range.reshape(-1, 1))[:, 1]
        ax.plot(x_range, y_prob, color="#3b82f6", linewidth=2.5, label="Logistic fit")

    # Threshold lines
    ax.axvline(0.40, color="#f59e0b", linestyle="--", alpha=0.7, linewidth=1.5, label="Threshold 0.40")
    ax.axvline(0.60, color="#22c55e", linestyle="--", alpha=0.7, linewidth=1.5, label="Threshold 0.60")

    ax.set_xlabel("Ees / Ea (Ventricular-Arterial Coupling)", fontsize=11)
    ax.set_ylabel("Probability of MCS Escalation", fontsize=11)
    ax.set_title("PV Loop Coupling vs MCS Escalation", fontsize=13, fontweight="bold")
    ax.legend(loc="center right", fontsize=9)
    ax.set_ylim(-0.1, 1.1)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(True, alpha=0.2)

    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "pv_loop_scatter.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("  [PV] Saved scatter plot to ml_output/pv_loop_scatter.png")


def generate_shap_for_escalation(df: pd.DataFrame, feature_cols: list):
    """Generate SHAP values for the full escalation RandomForest model."""
    df_target = df.dropna(subset=["target_escalation"])
    y = df_target["target_escalation"].astype(int)
    if y.nunique() < 2 or len(y) < 10:
        print("  [PV] Skipping SHAP: insufficient data")
        return {}

    # Use same preprocessing as ml_pipeline
    X_raw = df_target[feature_cols].copy()
    imputer = SimpleImputer(strategy="median")
    scaler = StandardScaler()
    X_imp = imputer.fit_transform(X_raw)
    # Track which columns survived imputation (all-NaN columns are dropped)
    valid_cols = [c for c in feature_cols if X_raw[c].notna().any()]
    X_scl = scaler.fit_transform(X_imp)
    X = pd.DataFrame(X_scl, columns=valid_cols, index=df_target.index)

    model = RandomForestClassifier(n_estimators=200, max_depth=6, random_state=RANDOM_STATE, class_weight="balanced")
    model.fit(X, y)

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)

    # TreeExplainer may return (n_samples, n_features, n_classes) or list of arrays
    shap_values_arr = np.array(shap_values)
    if shap_values_arr.ndim == 3:
        shap_values_class1 = shap_values_arr[:, :, 1]
    elif isinstance(shap_values, list):
        shap_values_class1 = np.array(shap_values[1])
    else:
        shap_values_class1 = shap_values_arr

    # Feature importance by mean absolute SHAP
    mean_abs_shap = np.abs(shap_values_class1).mean(axis=0).flatten()
    importance = {valid_cols[i]: float(mean_abs_shap[i]) for i in range(len(valid_cols))}
    importance_sorted = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))

    # Rank of Ees/Ea
    ees_ea_rank = list(importance_sorted.keys()).index("ees_ea") + 1 if "ees_ea" in importance_sorted else None

    # Per-patient SHAP values for Ees/Ea
    ees_ea_idx = valid_cols.index("ees_ea") if "ees_ea" in valid_cols else None
    patient_shap = []
    if ees_ea_idx is not None:
        for i, idx in enumerate(df_target.index):
            patient_shap.append({
                "mrn": str(df_target.loc[idx, "mrn"]),
                "name": f"{df_target.loc[idx, 'first_name']} {df_target.loc[idx, 'last_name']}".strip(),
                "ees_ea_value": float(df_target.loc[idx, "ees_ea"]) if pd.notna(df_target.loc[idx, "ees_ea"]) else None,
                "ees_ea_shap": float(np.asarray(shap_values_class1)[i, ees_ea_idx]),
                "prediction_probability": float(model.predict_proba(X.iloc[[i]])[0, 1]),
                "actual": int(y.iloc[i]),
            })

    result = {
        "feature_importance": importance_sorted,
        "ees_ea_rank": ees_ea_rank,
        "n_features": len(valid_cols),
        "patient_shap": patient_shap,
    }

    with open(OUTPUT_DIR / "pv_loop_shap.json", "w") as f:
        json.dump(sanitize_json(result), f, indent=2)

    # SHAP summary plot
    fig, ax = plt.subplots(figsize=(8, 10))
    shap.summary_plot(shap_values_class1, X, feature_names=valid_cols, show=False, max_display=20)
    fig.savefig(OUTPUT_DIR / "shap_escalation_full.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("  [PV] Saved SHAP summary to ml_output/shap_escalation_full.png")

    # SHAP dependence plot for Ees/Ea
    if ees_ea_idx is not None:
        fig, ax = plt.subplots(figsize=(7, 5))
        shap.dependence_plot("ees_ea", shap_values_class1, X, feature_names=valid_cols, show=False, ax=ax)
        fig.savefig(OUTPUT_DIR / "shap_dependence_ees_ea.png", dpi=150, bbox_inches="tight")
        plt.close(fig)
        print("  [PV] Saved SHAP dependence plot to ml_output/shap_dependence_ees_ea.png")

    return result


def generate_coefficient_plot(pv_result: dict):
    """Bar chart of PV-loop logistic regression coefficients."""
    if not pv_result or "coefficients" not in pv_result:
        return

    features = list(pv_result["coefficients"].keys())
    coeffs = list(pv_result["coefficients"].values())
    colors = ["#ef4444" if c > 0 else "#22c55e" for c in coeffs]

    fig, ax = plt.subplots(figsize=(7, 4))
    bars = ax.barh(features, coeffs, color=colors, alpha=0.85, edgecolor="white", linewidth=0.5)
    ax.axvline(0, color="white", linewidth=0.8)
    ax.set_xlabel("Log-Odds Coefficient (standardized)", fontsize=11)
    ax.set_title("PV-Loop Logistic Regression: Coefficients for MCS Escalation", fontsize=12, fontweight="bold")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(True, alpha=0.2, axis="x")

    for bar, coeff in zip(bars, coeffs):
        ax.text(coeff + (0.02 if coeff > 0 else -0.02), bar.get_y() + bar.get_height()/2,
                f"{coeff:.2f}", va="center", ha="left" if coeff > 0 else "right", fontsize=9, color="white")

    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "pv_loop_coefficients.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("  [PV] Saved coefficient plot to ml_output/pv_loop_coefficients.png")


def main():
    print("=" * 60)
    print("PV Loop Analysis for MCS Escalation")
    print("=" * 60)

    print("\n[1/4] Loading data...")
    df_pd = load_patient_data(DATA_PATH)
    df_cohort = load_cohort(DATA_PATH)
    df = df_pd.merge(df_cohort, on="mrn", how="outer")
    print(f"  Merged dataset: {len(df)} patients")

    print("\n[2/4] Engineering targets and features...")
    df = build_targets(df)
    df = engineer_features(df)
    print(f"  Escalation positives: {df['target_escalation'].sum()} / {len(df)}")

    exclude = {"mrn", "first_name", "last_name", "general_notes", "date_of_implant",
               "cohort_outcome", "cohort_age", "cohort_gender", "indication",
               "physician", "rhc_prior_72h", "rhc_timing_days", "support_days",
               "target_survival", "target_escalation", "target_rv_dysfunction",
               "mcs_escalation",
               "pre_septal_flattening", "pre_atrial_bowing",
               "post_septal_flattening", "post_atrial_bowing"}
    feature_cols = [c for c in df.columns if c not in exclude and pd.api.types.is_numeric_dtype(df[c])]

    print("\n[3/4] Training PV-loop-only logistic regression...")
    pv_result = train_pv_loop_model(df)
    if pv_result:
        generate_coefficient_plot(pv_result)
        generate_pv_loop_scatter(df)

    print("\n[4/4] Generating SHAP explainability for full escalation model...")
    generate_shap_for_escalation(df, feature_cols)

    print("\nDone. Outputs in ml_output/")
    print("  - pv_loop_escalation_model.json")
    print("  - pv_loop_scatter.png")
    print("  - pv_loop_coefficients.png")
    print("  - pv_loop_shap.json")
    print("  - shap_escalation_full.png")
    print("  - shap_dependence_ees_ea.png")


if __name__ == "__main__":
    main()
