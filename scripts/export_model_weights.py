"""
Export trained scikit-learn model weights from joblib files to a single JSON file
for consumption by the JS inference engine (src/ml-models/predict.ts).

Usage: python3 scripts/export_model_weights.py

Writes: src/ml-models/model-weights.json (~200KB)
"""
import json
import joblib
import numpy as np
from pathlib import Path

ML_OUTPUT = Path("ml_output")
CLUSTERS_DIR = ML_OUTPUT / "clusters"
OUTPUT = Path("src/ml-models/model-weights.json")


def _to_json(obj):
    """Convert numpy types to plain Python types for JSON serialization."""
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    return obj


def export():
    weights = {}

    # -----------------------------------------------------------------------
    # Risk models — dynamically dispatch by model type
    # -----------------------------------------------------------------------
    risk_artifacts = {}
    for target in ["survival", "rv_dysfunction", "escalation"]:
        a = joblib.load(ML_OUTPUT / f"model_{target}.joblib")
        risk_artifacts[target] = a

    # Scaler and imputer are identical across all models, store once
    s = risk_artifacts["survival"]["scaler"]
    im = risk_artifacts["survival"]["imputer"]
    weights["scaler"] = {"mean_": _to_json(s.mean_), "scale_": _to_json(s.scale_)}
    weights["imputer"] = {"statistics_": _to_json(im.statistics_), "strategy": im.strategy}
    weights["feature_names"] = risk_artifacts["survival"]["feature_names"]

    for target, a in risk_artifacts.items():
        m = a["model"]
        model_type = type(m).__name__

        if model_type == "LogisticRegression":
            weights[target] = {
                "type": "logistic_regression",
                "coef": _to_json(m.coef_[0]),
                "intercept": _to_json(m.intercept_[0]),
            }

        elif model_type == "GradientBoostingClassifier":
            # GradientBoosting is an ensemble of regression trees
            trees = []
            for est_stage in m.estimators_:
                est = est_stage[0]  # binary classification: 1 estimator per stage
                t = est.tree_
                trees.append({
                    "children_left": _to_json(t.children_left),
                    "children_right": _to_json(t.children_right),
                    "feature": _to_json(t.feature),
                    "threshold": _to_json(t.threshold),
                    "value": _to_json(t.value),
                })
            # Store init log-odds constant (prior prediction before boosting)
            import numpy as np
            dummy = np.zeros((1, m.n_features_in_))
            init_raw = float(m._raw_predict_init(dummy)[0, 0])
            weights[target] = {
                "type": "gradient_boosting",
                "n_estimators": len(trees),
                "learning_rate": m.learning_rate,
                "init_constant": init_raw,
                "trees": trees,
            }

        elif model_type == "RandomForestClassifier":
            trees = []
            for est in m.estimators_:
                t = est.tree_
                trees.append({
                    "children_left": _to_json(t.children_left),
                    "children_right": _to_json(t.children_right),
                    "feature": _to_json(t.feature),
                    "threshold": _to_json(t.threshold),
                    "value": _to_json(t.value),
                })
            weights[target] = {
                "type": "random_forest",
                "n_estimators": len(trees),
                "trees": trees,
            }

    # -----------------------------------------------------------------------
    # Cluster model
    # -----------------------------------------------------------------------
    cluster_path = CLUSTERS_DIR / "cluster_model.joblib"
    if cluster_path.exists():
        ca = joblib.load(cluster_path)
        weights["cluster"] = {
            "feature_names": ca["feature_names"],
            "kmeans_centroids": _to_json(ca["kmeans_centroids"]),
            "imputer": {"statistics_": _to_json(ca["imputer"].statistics_), "strategy": ca["imputer"].strategy},
            "scaler": {"mean_": _to_json(ca["scaler"].mean_), "scale_": _to_json(ca["scaler"].scale_)},
        }
        if ca["pca"] is not None:
            pca = ca["pca"]
            weights["cluster"]["pca"] = {
                "components_": _to_json(pca.components_),
                "mean_": _to_json(pca.mean_),
            }
        # Load profiles
        profiles_path = CLUSTERS_DIR / "cluster_profiles.json"
        if profiles_path.exists():
            with open(profiles_path) as fp:
                weights["cluster"]["profiles"] = json.load(fp)

    # Write output
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(weights, indent=2)
    OUTPUT.write_text(raw, encoding="utf-8")
    print(f"Exported {len(raw)} bytes to {OUTPUT}")
    print(f"  feature_names: {len(weights['feature_names'])} features")
    for target in ["survival", "rv_dysfunction", "escalation"]:
        w = weights.get(target)
        if w:
            print(f"  {target}: {w['type']}, {w.get('n_estimators', len(w.get('coef', [])))} {'trees' if 'trees' in w else 'coefficients'}")
    if "cluster" in weights:
        print(f"  cluster: {len(weights['cluster']['kmeans_centroids'])} centroids")


if __name__ == "__main__":
    export()