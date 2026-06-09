"""
generate_decision_support.py — Bootstrap CIs + trajectory matching for the Decision Support Page.

Generates:
  ml_output/decision_support_bootstrap.json
    — Per-patient prediction means and 95% bootstrap CIs for all 3 targets
  ml_output/patient_trajectories.json
    — Per-patient k-NN trajectory matching (similar pre-implant profiles → delta CPO distribution)
  ml_output/global_model_metrics.json
    — Global AUC + bootstrapped AUC CI for each model

Usage:
    python3 scripts/generate_decision_support.py
"""

import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold

import joblib

warnings.filterwarnings("ignore")

DATA_PATH = Path("Impella_MK.xlsx")
OUTPUT_DIR = Path("ml_output")
RANDOM_STATE = 42
N_BOOTSTRAP = 500

# Import shared data loading
import sys
sys.path.insert(0, "scripts")
from ml_pipeline import load_patient_data, load_cohort, build_targets, engineer_features


def sanitize(obj):
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize(v) for v in obj]
    elif isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        val = float(obj)
        return None if np.isnan(val) else val
    return obj


def _clone_model(model):
    """Create a new unfitted instance of the same model type with identical hyperparameters."""
    params = model.get_params()
    # Remove fitted-only params that shouldn't be passed to constructor
    params.pop("classes_", None)
    params.pop("n_features_in_", None)
    params.pop("feature_names_in_", None)
    model_type = type(model)
    return model_type(**params)


def stratified_cv_auc(model, X: np.ndarray, y: np.ndarray, n_splits: int = 5) -> dict:
    """
    Run stratified k-fold cross-validation matching the training pipeline methodology.
    Returns mean AUC + per-fold results. Uses the original model directly (already fitted).
    """
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=RANDOM_STATE)
    fold_aucs = []
    for train_idx, val_idx in skf.split(X, y):
        X_train, X_val = X[train_idx], X[val_idx]
        y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]
        clf = _clone_model(model)
        clf.set_params(random_state=RANDOM_STATE)
        try:
            clf.fit(X_train, y_train)
            probs = clf.predict_proba(X_val)[:, 1]
            if y_val.nunique() > 1:
                fold_aucs.append(roc_auc_score(y_val, probs))
        except Exception:
            continue
    if len(fold_aucs) == 0:
        return {"mean": 0.5, "folds": [], "n_folds": 0}
    return {
        "mean": float(np.mean(fold_aucs)),
        "folds": [float(a) for a in fold_aucs],
        "n_folds": len(fold_aucs),
    }


def bootstrap_ci(model, X: np.ndarray, y: np.ndarray, n_iterations: int = N_BOOTSTRAP,
                 patients: list = None, patient_ids: list = None) -> dict:
    """
    Bootstrap resample the training data, retrain the same model type on each sample,
    predict on ALL patients, store distributions.
    Returns patient-level CIs and global AUC CI.
    """
    n_samples = X.shape[0]
    rng = np.random.RandomState(RANDOM_STATE)

    # Collect predictions across iterations: [n_bootstrap, n_patients]
    all_probs = np.zeros((n_iterations, X.shape[0]))

    global_aucs = []

    for i in range(n_iterations):
        idx = rng.choice(n_samples, size=n_samples, replace=True)
        X_boot = X[idx]
        y_boot = y[idx]

        # OOB mask: samples not selected in this bootstrap draw
        oob_mask = np.ones(n_samples, dtype=bool)
        oob_mask[idx] = False
        oob_idx = np.where(oob_mask)[0]

        clf = _clone_model(model)
        clf.set_params(random_state=rng.randint(0, 10000))
        try:
            clf.fit(X_boot, y_boot)
            probs = clf.predict_proba(X)[:, 1]
            all_probs[i] = probs
            # AUC on OOB samples only for unbiased generalization estimate
            if len(oob_idx) >= 10 and y.iloc[oob_idx].nunique() > 1:
                auc = roc_auc_score(y.iloc[oob_idx], probs[oob_idx])
                global_aucs.append(auc)
        except Exception:
            all_probs[i] = np.full(X.shape[0], np.nan)

    # Global AUC CI
    aucs_arr = np.array(global_aucs)
    global_auc_mean = float(np.nanmean(aucs_arr))
    global_auc_lower = float(np.nanpercentile(aucs_arr, 2.5))
    global_auc_upper = float(np.nanpercentile(aucs_arr, 97.5))

    # Per-patient CIs
    patients_out = []
    for j in range(X.shape[0]):
        vals = all_probs[:, j]
        vals = vals[~np.isnan(vals)]
        if len(vals) == 0:
            patients_out.append({
                "patientId": patient_ids[j] if patient_ids else str(j),
                "prediction_mean": None,
                "ci_lower": None,
                "ci_upper": None,
            })
            continue
        mean_val = float(np.mean(vals))
        ci_low = float(np.percentile(vals, 2.5))
        ci_high = float(np.percentile(vals, 97.5))
        patients_out.append({
            "patientId": patient_ids[j] if patient_ids else str(j),
            "prediction_mean": mean_val,
            "ci_lower": ci_low,
            "ci_upper": ci_high,
        })

    return {
        "patients": patients_out,
        "global_auc_mean": global_auc_mean,
        "global_auc_ci_lower": global_auc_lower,
        "global_auc_ci_upper": global_auc_upper,
        "n_bootstrap": n_iterations,
        "confidence_level": 0.95,
    }


def compute_trajectories(df: pd.DataFrame, target_escalation: pd.Series) -> dict:
    """
    For each patient, find top-20 most similar patients by pre-implant features.
    Use cosine distance on standardized pre-CPO, pre-PAPI, pre-lactate, pre-RA, pre-eGFR, age.
    Report delta CPO, delta PAPI, and delta lactate distributions + outcome rates among matches.
    Also populates cluster_id from the clustering pipeline output.
    """
    pre_features = ["pre_cpo", "pre_papi", "pre_lactate", "pre_ra", "pre_egfr", "age"]
    available = [f for f in pre_features if f in df.columns]

    df_work = df[available + ["mrn", "first_name", "last_name", "post_cpo", "post_papi", "post_lactate"]].copy()
    df_work = df_work.dropna(subset=available, how="all")

    # Load cluster assignments to populate cluster_id and cluster_name
    cluster_map = {}
    cluster_name_map = {}
    cluster_path = OUTPUT_DIR / "clusters" / "cluster_assignments.csv"
    profile_path = OUTPUT_DIR / "clusters" / "cluster_profiles.json"
    if cluster_path.exists():
        cluster_df = pd.read_csv(cluster_path)
        cluster_map = dict(zip(cluster_df["mrn"].astype(str).str.strip(), cluster_df["cluster"]))
    if profile_path.exists():
        with open(profile_path) as f:
            profiles = json.load(f)
        cluster_name_map = {int(k): v.get("cluster_name", f"Cluster {k}") for k, v in profiles.items()}

    # Identify escalation outcome from dataset
    df_work["escalated"] = target_escalation.values if len(target_escalation) == len(df_work) else 0

    # Standardize pre features
    pre_data = df_work[available].values
    pre_mean = np.nanmean(pre_data, axis=0)
    pre_std = np.nanstd(pre_data, axis=0) + 1e-8
    pre_norm = (pre_data - pre_mean) / pre_std

    # Impute remaining NaNs to 0 (after normalization)
    pre_norm = np.nan_to_num(pre_norm, nan=0.0)

    n = len(df_work)
    results = []

    for i in range(n):
        vec_i = pre_norm[i]
        if np.all(vec_i == 0):
            results.append({
                "patientId": str(df_work.iloc[i].get("mrn", i)),
                "name": f"{df_work.iloc[i].get('first_name', '')} {df_work.iloc[i].get('last_name', '')}".strip(),
                "matches": 0,
                "n_valid": 0,
                "delta_cpo_mean": None,
                "delta_cpo_ci_lower": None,
                "delta_cpo_ci_upper": None,
                "delta_papi_mean": None,
                "delta_papi_ci_lower": None,
                "delta_papi_ci_upper": None,
                "delta_lactate_mean": None,
                "delta_lactate_ci_lower": None,
                "delta_lactate_ci_upper": None,
                "survival_rate": None,
                "escalation_rate": None,
                "cluster_id": None,
                "cluster_name": None,
            })
            continue

        # Cosine distances
        dot = pre_norm @ vec_i
        norm_i = np.linalg.norm(vec_i)
        norms = np.linalg.norm(pre_norm, axis=1)
        cos_sim = dot / (norm_i * norms + 1e-8)

        # Top 20 most similar (exclude self)
        cos_sim[i] = -np.inf
        k = min(20, n - 1)
        top_idx = np.argsort(-cos_sim)[:k]

        # --- Compute delta metrics among matches ---

        # Helper: mean + bootstrapped CI + valid count of a delta array
        def _delta_stats(pre_vals, post_vals):
            delta = post_vals - pre_vals
            valid = delta[~np.isnan(delta)]
            if len(valid) == 0:
                return None, None, None, 0
            mean = float(np.mean(valid))
            low = float(np.percentile(valid, 2.5)) if len(valid) > 5 else None
            high = float(np.percentile(valid, 97.5)) if len(valid) > 5 else None
            return mean, low, high, int(len(valid))

        # Delta CPO (use its valid count as n_valid for "matches with data")
        delta_cpo_mean, delta_cpo_ci_low, delta_cpo_ci_high, n_valid = _delta_stats(
            df_work["pre_cpo"].values[top_idx],
            df_work["post_cpo"].values[top_idx],
        )
        # Delta PAPI
        delta_papi_mean, delta_papi_ci_low, delta_papi_ci_high, _ = _delta_stats(
            df_work["pre_papi"].values[top_idx],
            df_work["post_papi"].values[top_idx],
        )
        # Delta Lactate
        delta_lactate_mean, delta_lactate_ci_low, delta_lactate_ci_high, _ = _delta_stats(
            df_work["pre_lactate"].values[top_idx],
            df_work["post_lactate"].values[top_idx],
        )

        # Outcome rates
        match_escalated = df_work["escalated"].values[top_idx]
        escalation_rate = float(np.mean(match_escalated)) if len(match_escalated) > 0 else None
        # Use mrn to get cohort outcome for survival
        survival_rate = None

        # Cluster assignment
        mrn_str = str(df_work.iloc[i].get("mrn", i))
        cluster_id = cluster_map.get(mrn_str) if cluster_map else None
        cluster_name = cluster_name_map.get(cluster_id, None) if (cluster_id is not None and cluster_name_map) else None

        results.append({
            "patientId": mrn_str,
            "name": f"{df_work.iloc[i].get('first_name', '')} {df_work.iloc[i].get('last_name', '')}".strip(),
            "matches": int(k),
            "n_valid": n_valid,
            "delta_cpo_mean": delta_cpo_mean,
            "delta_cpo_ci_lower": delta_cpo_ci_low,
            "delta_cpo_ci_upper": delta_cpo_ci_high,
            "delta_papi_mean": delta_papi_mean,
            "delta_papi_ci_lower": delta_papi_ci_low,
            "delta_papi_ci_upper": delta_papi_ci_high,
            "delta_lactate_mean": delta_lactate_mean,
            "delta_lactate_ci_lower": delta_lactate_ci_low,
            "delta_lactate_ci_upper": delta_lactate_ci_high,
            "escalation_rate": escalation_rate,
            "survival_rate": survival_rate,
            "cluster_id": cluster_id,
            "cluster_name": cluster_name,
        })

    return {"patients": results, "method": "cosine_knn", "k": 20, "features": available}


def main():
    print("=" * 60)
    print("Decision Support Data Generator")
    print("=" * 60)

    print("\n[1/5] Loading data...")
    df_pd = load_patient_data(DATA_PATH)
    df_cohort = load_cohort(DATA_PATH)
    df = df_pd.merge(df_cohort, on="mrn", how="outer")
    df = build_targets(df)
    df = engineer_features(df)
    print(f"  Dataset: {len(df)} patients")

    # Exclude non-feature columns
    exclude = {"mrn", "first_name", "last_name", "general_notes", "date_of_implant",
               "cohort_outcome", "cohort_age", "cohort_gender", "indication",
               "physician", "rhc_prior_72h", "rhc_timing_days", "support_days",
               "target_survival", "target_escalation", "target_rv_dysfunction",
               "pre_septal_flattening", "pre_atrial_bowing",
               "post_septal_flattening", "post_atrial_bowing"}
    feature_cols = [c for c in df.columns if c not in exclude and pd.api.types.is_numeric_dtype(df[c])]

    print(f"\n[2/5] Loading trained models...")
    targets = {
        "survival": ("target_survival", "model_survival.joblib"),
        "escalation": ("target_escalation", "model_escalation.joblib"),
        "rv_dysfunction": ("target_rv_dysfunction", "model_rv_dysfunction.joblib"),
    }

    bootstrap_results = {}
    trajectory_result = None

    for target_name, (target_col, joblib_file) in targets.items():
        artifact_path = OUTPUT_DIR / joblib_file
        if not artifact_path.exists():
            print(f"  Skipping {target_name}: {joblib_file} not found")
            continue
        print(f"  Processing {target_name}...")

        artifact = joblib.load(artifact_path)
        feature_names = artifact["feature_names"]

        df_target = df.dropna(subset=[target_col])
        y = df_target[target_col].astype(int)
        if y.nunique() < 2 or len(y) < 10:
            print(f"    Skipping: insufficient classes ({y.nunique()}) or samples ({len(y)})")
            continue

        # Prepare features (same preprocessing as training)
        X_raw = df_target[feature_names].copy()
        # SimpleImputer with median
        imputer = SimpleImputer(strategy="median")
        X_imp = imputer.fit_transform(X_raw)
        scaler = StandardScaler()
        X = scaler.fit_transform(X_imp)

        patient_ids = [str(x) for x in df_target["mrn"].values]

        # Bootstrap (for per-patient prediction CIs)
        result = bootstrap_ci(artifact["model"], X, y, N_BOOTSTRAP, patient_ids=patient_ids)

        # Compute stratified 5-fold CV AUC for stable global metric (matches ml_pipeline.py)
        cv_result = stratified_cv_auc(artifact["model"], X, y)
        if cv_result["n_folds"] > 0:
            result["global_auc_mean"] = cv_result["mean"]
            result["cv_folds"] = cv_result["folds"]
            result["cv_n_folds"] = cv_result["n_folds"]
            # Also round for display — but keep raw bootstrap CI bounds
            result["global_auc_mean"] = round(cv_result["mean"], 2)

        bootstrap_results[target_name] = result

        n = len(y)
        pos = int(y.sum())
        mean_auc = result["global_auc_mean"]
        ci_auc = (result["global_auc_ci_lower"], result["global_auc_ci_upper"])
        print(f"    AUC={mean_auc:.3f} (5-fold CV), bootstrap CI: [{ci_auc[0]:.3f}-{ci_auc[1]:.3f}], n={n}, pos={pos}")

    print(f"\n[3/5] Computing trajectory matches...")
    # Use escalation target for trajectory outcome rates
    target_escalation = df["target_escalation"] if "target_escalation" in df.columns else pd.Series([0] * len(df))
    trajectory_result = compute_trajectories(df, target_escalation)
    print(f"  Trajectories for {len(trajectory_result['patients'])} patients")

    print(f"\n[4/5] Saving bootstrap results...")
    bootstrap_path = OUTPUT_DIR / "decision_support_bootstrap.json"
    with open(bootstrap_path, "w") as f:
        json.dump(sanitize(bootstrap_results), f, indent=2)
    print(f"  Saved to {bootstrap_path}")

    traj_path = OUTPUT_DIR / "patient_trajectories.json"
    with open(traj_path, "w") as f:
        json.dump(sanitize(trajectory_result), f, indent=2)
    print(f"  Saved to {traj_path}")

    # Global model metrics — use 5-fold CV AUC as primary metric
    global_metrics = {}
    for target_name, result in bootstrap_results.items():
        cv_auc = result.get("global_auc_mean", result.get("global_auc_mean", 0.5))
        global_metrics[target_name] = {
            "auc": cv_auc,
            "auc_method": "5-fold stratified CV",
            "ci_lower": result["global_auc_ci_lower"],
            "ci_upper": result["global_auc_ci_upper"],
            "n_bootstrap": result["n_bootstrap"],
            "cv_folds": result.get("cv_folds", []),
        }

    metrics_path = OUTPUT_DIR / "global_model_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(sanitize(global_metrics), f, indent=2)
    print(f"  Saved global metrics to {metrics_path}")

    print(f"\n[5/5] Summary:")
    for target_name, result in bootstrap_results.items():
        print(f"  {target_name}: AUC={result['global_auc_mean']:.3f} [{result['global_auc_ci_lower']:.3f}-{result['global_auc_ci_upper']:.3f}]")

    n_traj = len(trajectory_result["patients"])
    with_cpo = sum(1 for p in trajectory_result["patients"] if p["delta_cpo_mean"] is not None)
    print(f"  Trajectories: {n_traj} patients, {with_cpo} with delta CPO")
    print("\nDone.")


if __name__ == "__main__":
    main()