"""
sandbox_model_comparison.py — Experiment with alternative ML models in a sandbox.

Tests multiple model families, imputation strategies, feature selection methods,
and hyperparameter configurations — without modifying any production artifacts.

Output: ml_output/sandbox_results.json  (comparison table only)
"""

import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

from sklearn.impute import SimpleImputer, KNNImputer
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import StratifiedKFold, cross_val_predict, GridSearchCV
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
)
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import (
    RandomForestClassifier, GradientBoostingClassifier, ExtraTreesClassifier,
)
from sklearn.svm import SVC
from sklearn.feature_selection import SelectKBest, f_classif, RFE

warnings.filterwarnings("ignore")

DATA_PATH = Path("Impella_MK.xlsx")
OUTPUT_DIR = Path("ml_output")
RANDOM_STATE = 42
N_SPLITS = 5

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
        return float(obj)
    return obj


def evaluate_cv(model, X, y, cv) -> dict:
    """Stratified CV evaluation returning standard metrics."""
    try:
        y_proba = cross_val_predict(model, X, y, cv=cv, method="predict_proba")[:, 1]
    except Exception:
        return {"auc": None, "accuracy": None, "precision": None, "recall": None, "f1": None, "error": str(e)}

    y_pred = (y_proba >= 0.5).astype(int)
    return {
        "auc": float(roc_auc_score(y, y_proba)),
        "accuracy": float(accuracy_score(y, y_pred)),
        "precision": float(precision_score(y, y_pred, zero_division=0)),
        "recall": float(recall_score(y, y_pred, zero_division=0)),
        "f1": float(f1_score(y, y_pred, zero_division=0)),
    }


def try_thresholds(y_true, y_proba) -> dict:
    """Find best classification threshold for maximizing F1."""
    best_f1 = 0
    best_thresh = 0.5
    for t in np.linspace(0.1, 0.9, 17):
        y_pred = (y_proba >= t).astype(int)
        f1 = f1_score(y_true, y_pred, zero_division=0)
        if f1 > best_f1:
            best_f1 = f1
            best_thresh = t
    y_pred = (y_proba >= best_thresh).astype(int)
    return {
        "auc": float(roc_auc_score(y_true, y_proba)),
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(best_f1),
        "best_threshold": float(best_thresh),
        "note": f"threshold_optimized",
    }


def main():
    print("=" * 60)
    print("Sandbox: Alternative ML Model Comparison")
    print("=" * 60)
    print("  Tests multiple models/techniques WITHOUT modifying any")
    print("  production artifacts (.joblib, model_report.md, etc.)")
    print()

    # ── Load data ──
    print("[1/4] Loading data...")
    df_pd = load_patient_data(DATA_PATH)
    df_cohort = load_cohort(DATA_PATH)
    df = df_pd.merge(df_cohort, on="mrn", how="outer")
    df = build_targets(df)
    df = engineer_features(df)

    exclude = {"mrn", "first_name", "last_name", "general_notes", "date_of_implant",
               "cohort_outcome", "cohort_age", "cohort_gender", "indication",
               "physician", "rhc_prior_72h", "rhc_timing_days", "support_days",
               "target_survival", "target_escalation", "target_rv_dysfunction",
               "pre_septal_flattening", "pre_atrial_bowing",
               "post_septal_flattening", "post_atrial_bowing"}
    feature_cols = [c for c in df.columns if c not in exclude and pd.api.types.is_numeric_dtype(df[c])]
    print(f"  Using {len(feature_cols)} numeric features across {len(df)} patients")

    targets = {
        "survival": "target_survival",
        "escalation": "target_escalation",
        "rv_dysfunction": "target_rv_dysfunction",
    }

    cv = StratifiedKFold(n_splits=N_SPLITS, shuffle=True, random_state=RANDOM_STATE)
    all_results = {}

    # ── Model configurations ──
    model_configs = {
        # Baseline — current production configs
        "LR (L2, balanced)": LogisticRegression(max_iter=2000, random_state=RANDOM_STATE, class_weight="balanced"),
        "RF (200, d6, balanced)": RandomForestClassifier(n_estimators=200, max_depth=6, random_state=RANDOM_STATE, class_weight="balanced"),

        # LR variants
        "LR (L1, balanced)": LogisticRegression(max_iter=2000, random_state=RANDOM_STATE, class_weight="balanced", penalty="l1", solver="saga"),
        "LR (L2, no weight)": LogisticRegression(max_iter=2000, random_state=RANDOM_STATE),
        "LR (L1, no weight)": LogisticRegression(max_iter=2000, random_state=RANDOM_STATE, penalty="l1", solver="saga"),

        # Ensemble variants
        "GradientBoosting (d3, lr0.05)": GradientBoostingClassifier(n_estimators=200, max_depth=3, learning_rate=0.05, random_state=RANDOM_STATE),
        "GradientBoosting (d2, lr0.1)": GradientBoostingClassifier(n_estimators=200, max_depth=2, learning_rate=0.1, random_state=RANDOM_STATE),
        "ExtraTrees (200, d6)": ExtraTreesClassifier(n_estimators=200, max_depth=6, random_state=RANDOM_STATE, class_weight="balanced"),
        "ExtraTrees (200, d4)": ExtraTreesClassifier(n_estimators=200, max_depth=4, random_state=RANDOM_STATE, class_weight="balanced"),

        # Non-linear boundary
        "SVC (rbf, balanced)": SVC(probability=True, random_state=RANDOM_STATE, class_weight="balanced"),
    }

    # Feature selection + imputation configs
    preprocessing_configs = {
        "median_imputer": lambda X: SimpleImputer(strategy="median").fit_transform(X),
        "knn_imputer_5": lambda X: KNNImputer(n_neighbors=5).fit_transform(X),
    }

    # ── Run experiments ──
    print("\n[2/4] Running model experiments...")

    for target_name, target_col in targets.items():
        print(f"\n  ── {target_name} ──")
        df_target = df.dropna(subset=[target_col])
        y = df_target[target_col].astype(int)
        n = len(y)
        pos = int(y.sum())
        print(f"  n={n}, pos={pos}, imbalance={n/pos:.1f}:1")

        X_raw = df_target[feature_cols].copy()
        all_nan = X_raw.columns[X_raw.isna().all()].tolist()
        if all_nan:
            X_raw = X_raw.drop(columns=all_nan)
        valid_cols = X_raw.columns.tolist()

        target_results = {}

        for cfg_name, model in model_configs.items():
            try:
                X_imp = SimpleImputer(strategy="median").fit_transform(X_raw)
                scaler = StandardScaler()
                X = scaler.fit_transform(X_imp)
                X = pd.DataFrame(X, columns=valid_cols, index=X_raw.index)
                metrics = evaluate_cv(model, X, y, cv)
                target_results[cfg_name] = metrics
                auc_str = f"{metrics['auc']:.3f}" if metrics['auc'] is not None else "ERR"
                f1_str = f"{metrics['f1']:.3f}" if metrics['f1'] is not None else "ERR"
                print(f"    {cfg_name:<35s} AUC={auc_str}  F1={f1_str}")
            except Exception as e:
                target_results[cfg_name] = {"auc": None, "f1": None, "error": str(e)}
                print(f"    {cfg_name:<35s} FAILED: {e}")

        # ── KNN imputer on best model ──
        print(f"    {'─'*50}")
        for imp_name, imp_fn in preprocessing_configs.items():
            if imp_name == "median_imputer":
                continue  # already tested above
            try:
                X_imp = imp_fn(X_raw)
                X = pd.DataFrame(StandardScaler().fit_transform(X_imp), columns=valid_cols, index=X_raw.index)
                model = LogisticRegression(max_iter=2000, random_state=RANDOM_STATE, class_weight="balanced")
                metrics = evaluate_cv(model, X, y, cv)
                label = f"LR (L2, balanced) + {imp_name}"
                target_results[label] = metrics
                auc_str = f"{metrics['auc']:.3f}" if metrics['auc'] is not None else "ERR"
                print(f"    {label:<35s} AUC={auc_str}")
            except Exception as e:
                print(f"    LR + {imp_name:<20s} FAILED: {e}")

        # ── Feature selection on LR ──
        for k in [20, 30, 50]:
            try:
                selector = SelectKBest(f_classif, k=k)
                X_imp = SimpleImputer(strategy="median").fit_transform(X_raw)
                X_sel = selector.fit_transform(X_imp, y)
                X = pd.DataFrame(StandardScaler().fit_transform(X_sel))
                model = LogisticRegression(max_iter=2000, random_state=RANDOM_STATE, class_weight="balanced")
                metrics = evaluate_cv(model, X, y, cv)
                label = f"LR + SelectKBest(k={k})"
                target_results[label] = metrics
                print(f"    {label:<35s} AUC={metrics['auc']:.3f}  F1={metrics['f1']:.3f}")
            except Exception as e:
                print(f"    SelectKBest(k={k}): FAILED {e}")

        for k in [10, 20]:
            try:
                X_imp = SimpleImputer(strategy="median").fit_transform(X_raw)
                X_imp_df = pd.DataFrame(X_imp, columns=valid_cols)
                selector = RFE(LogisticRegression(max_iter=2000, random_state=RANDOM_STATE), n_features_to_select=k)
                X_sel = selector.fit_transform(X_imp_df, y)
                X = pd.DataFrame(StandardScaler().fit_transform(X_sel))
                model = LogisticRegression(max_iter=2000, random_state=RANDOM_STATE, class_weight="balanced")
                metrics = evaluate_cv(model, X, y, cv)
                label = f"LR + RFE(k={k})"
                target_results[label] = metrics
                print(f"    {label:<35s} AUC={metrics['auc']:.3f}  F1={metrics['f1']:.3f}")
            except Exception as e:
                print(f"    RFE(k={k}): FAILED {e}")

        # ── GridSearch on LR ──
        try:
            X_imp = SimpleImputer(strategy="median").fit_transform(X_raw)
            X = pd.DataFrame(StandardScaler().fit_transform(X_imp), columns=valid_cols, index=X_raw.index)
            grid = GridSearchCV(
                LogisticRegression(max_iter=2000, random_state=RANDOM_STATE, class_weight="balanced"),
                param_grid={"C": [0.01, 0.1, 1, 10, 100], "penalty": ["l2"]},
                cv=cv, scoring="roc_auc",
            )
            grid.fit(X, y)
            best_lr = grid.best_estimator_
            metrics = evaluate_cv(best_lr, X, y, cv)
            label = f"LR GridSearch (best C={grid.best_params_['C']})"
            target_results[label] = metrics
            print(f"    {label:<35s} AUC={metrics['auc']:.3f}  F1={metrics['f1']:.3f}")
        except Exception as e:
            print(f"    LR GridSearch: FAILED {e}")

        # ── GridSearch on RF ──
        try:
            grid_rf = GridSearchCV(
                RandomForestClassifier(random_state=RANDOM_STATE, class_weight="balanced"),
                param_grid={"n_estimators": [100, 200], "max_depth": [3, 6, 10]},
                cv=cv, scoring="roc_auc",
            )
            grid_rf.fit(X, y)
            best_rf = grid_rf.best_estimator_
            metrics = evaluate_cv(best_rf, X, y, cv)
            label = f"RF GridSearch (best params)"
            target_results[label] = metrics
            target_results[label]["best_params"] = grid_rf.best_params_
            print(f"    {label:<35s} AUC={metrics['auc']:.3f}  F1={metrics['f1']:.3f}  params={grid_rf.best_params_}")
        except Exception as e:
            print(f"    RF GridSearch: FAILED {e}")

        # ── Threshold optimization on best model ──
        best_config = max(target_results, key=lambda k: (target_results[k].get("auc") or 0))
        try:
            X_imp = SimpleImputer(strategy="median").fit_transform(X_raw)
            X = pd.DataFrame(StandardScaler().fit_transform(X_imp), columns=valid_cols, index=X_raw.index)
            y_proba = cross_val_predict(model_configs.get(best_config, LogisticRegression()), X, y, cv=cv, method="predict_proba")[:, 1]
            thresh_metrics = try_thresholds(y, y_proba)
            label = f"{best_config} + opt_threshold"
            target_results[label] = thresh_metrics
            print(f"    {label:<35s} AUC={thresh_metrics['auc']:.3f}  F1={thresh_metrics['f1']:.3f}  thr={thresh_metrics['best_threshold']:.2f}")
        except Exception as e:
            print(f"    Threshold opt: FAILED {e}")

        all_results[target_name] = target_results

    # ── Summary ──
    print(f"\n[3/4] Summary of best per-target configurations:")
    print(f"  {'Target':<20s} {'Best Config':<40s} {'AUC':<8s} {'F1':<8s}")
    print(f"  {'─'*76}")
    for target_name in targets:
        results = all_results[target_name]
        best = max(results, key=lambda k: (results[k].get("auc") or 0))
        m = results[best]
        print(f"  {target_name:<20s} {best:<40s} {m.get('auc', 0):.3f}    {m.get('f1', 0):.3f}")

    # Also show current production baseline for comparison
    print(f"\n  Production baselines (from model_report.md):")
    print(f"  {'Target':<20s} {'Best Model':<20s} {'AUC':<8s}")
    print(f"  {'─'*48}")
    print(f"  {'survival':<20s} {'LR (balanced)':<20s} 0.537")
    print(f"  {'escalation':<20s} {'RF (200, d6)':<20s} 0.950")
    print(f"  {'rv_dysfunction':<20s} {'RF (200, d6)':<20s} {'(see report)'}")

    # ── Save ──
    print(f"\n[4/4] Saving results...")
    path = OUTPUT_DIR / "sandbox_results.json"
    with open(path, "w") as f:
        json.dump(sanitize(all_results), f, indent=2)
    print(f"  Saved to {path}")
    print("\nDone. Production artifacts untouched.")
    print(f"  Run `python3 scripts/ml_pipeline.py` to verify no side effects.")


if __name__ == "__main__":
    main()