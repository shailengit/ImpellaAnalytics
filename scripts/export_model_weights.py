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
    # Risk models: survival, rv_dysfunction (LogisticRegression), escalation (RandomForest)
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

    # LogisticRegression models
    for target in ["survival", "rv_dysfunction"]:
        a = risk_artifacts[target]
        m = a["model"]
        weights[target] = {
            "type": "logistic_regression",
            "coef": _to_json(m.coef_[0]),
            "intercept": _to_json(m.intercept_[0]),
        }

    # RandomForest model
    rf_artifact = risk_artifacts["escalation"]
    rf_model = rf_artifact["model"]
    trees = []
    for est in rf_model.estimators_:
        t = est.tree_
        trees.append({
            "children_left": _to_json(t.children_left),
            "children_right": _to_json(t.children_right),
            "feature": _to_json(t.feature),
            "threshold": _to_json(t.threshold),
            "value": _to_json(t.value),
        })
    weights["escalation"] = {
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
    print(f"  survival: LogisticRegression, {len(weights['survival']['coef'])} coefficients")
    print(f"  rv_dysfunction: LogisticRegression, {len(weights['rv_dysfunction']['coef'])} coefficients")
    print(f"  escalation: RandomForest, {weights['escalation']['n_estimators']} trees")
    if "cluster" in weights:
        print(f"  cluster: {len(weights['cluster']['kmeans_centroids'])} centroids")


if __name__ == "__main__":
    export()