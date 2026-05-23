"""
predict_cluster.py — Cluster assignment for new patients.

Reads patient data as JSON from stdin, loads cluster_model.joblib,
returns cluster assignment with distances as JSON to stdout.

Usage:
    echo '{"patient": {...}}' | python predict_cluster.py
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
    print(json.dumps({"error": f"Missing Python package: {e}"}), flush=True)
    sys.exit(1)

warnings.filterwarnings("ignore")

OUTPUT_DIR = Path("ml_output/clusters")

# Feature engineering for clustering (must match clustering_pipeline.py)
def engineer_clustering_features(record: dict) -> dict:
    """Compute derived features for clustering from a single patient record."""
    f = dict(record)

    # BMI
    w = f.get("weight_kg")
    h = f.get("height_cm")
    if w is not None and h is not None and h > 0:
        f["bmi"] = w / ((h / 100) ** 2)
    else:
        f["bmi"] = np.nan

    # Delta CPO
    pre_cpo = f.get("pre_cpo")
    post_cpo = f.get("post_cpo")
    if pre_cpo is not None and post_cpo is not None:
        f["delta_cpo"] = post_cpo - pre_cpo
    else:
        f["delta_cpo"] = np.nan

    # Delta lactate
    pre_lac = f.get("pre_lactate")
    post_lac = f.get("post_lactate")
    if pre_lac is not None and post_lac is not None:
        f["delta_lactate"] = post_lac - pre_lac
    else:
        f["delta_lactate"] = np.nan

    # Delta creatinine
    pre_creat = f.get("pre_creatinine")
    post_creat = f.get("post_creatinine")
    if pre_creat is not None and post_creat is not None:
        f["delta_creatinine"] = post_creat - pre_creat
    else:
        f["delta_creatinine"] = np.nan

    # Delta PAPI
    pre_papi = f.get("pre_papi")
    post_papi = f.get("post_papi")
    if pre_papi is not None and post_papi is not None:
        f["delta_papi"] = post_papi - pre_papi
    else:
        f["delta_papi"] = np.nan

    return f


def load_cluster_model():
    """Load the trained clustering model."""
    model_path = OUTPUT_DIR / "cluster_model.joblib"
    profiles_path = OUTPUT_DIR / "cluster_profiles.json"

    if not model_path.exists():
        return None, None
    artifact = joblib.load(model_path)

    profiles = None
    if profiles_path.exists():
        with open(profiles_path) as fp:
            profiles = json.load(fp)

    return artifact, profiles


def assign_cluster(patient: dict, artifact: dict, profiles: dict) -> dict:
    """Assign cluster label and centroid distances to a patient record."""
    f = engineer_clustering_features(patient)
    feature_names = artifact["feature_names"]
    imputer = artifact["imputer"]
    scaler = artifact["scaler"]
    centroids = artifact["kmeans_centroids"]  # numpy array

    # Build feature row
    row = {name: f.get(name, np.nan) for name in feature_names}
    X = pd.DataFrame([row])
    X_imp = imputer.transform(X)
    X_scl = scaler.transform(X_imp)

    # Predict cluster: find nearest centroid
    distances = np.array([float(np.linalg.norm(X_scl[0] - c)) for c in centroids])
    label = int(np.argmin(distances))

    # Soft clustering: normalize inverse distances to pseudo-probabilities
    inv_dist = 1.0 / (distances + 1e-8)
    similarities = {str(i): float(inv_dist[i] / inv_dist.sum()) for i in range(len(centroids))}
    dist_dict = {str(i): float(distances[i]) for i in range(len(centroids))}

    # Get cluster name from profiles
    cluster_name = "Unknown"
    recommendation = ""
    if profiles and str(label) in profiles:
        cluster_name = profiles[str(label)].get("cluster_name", "Unknown")
        recommendation = profiles[str(label)].get("clinical_recommendation", "")

    return {
        "cluster_label": label,
        "cluster_name": cluster_name,
        "recommendation": recommendation,
        "distances": dist_dict,
        "similarities": similarities,
    }


def assign_batch_clusters(patients: list, artifact: dict, profiles: dict) -> list:
    """Assign clusters to multiple patients at once (batched for efficiency)."""
    feature_names = artifact["feature_names"]
    imputer = artifact["imputer"]
    scaler = artifact["scaler"]
    centroids = artifact["kmeans_centroids"]

    # Engineer features for all patients
    rows = []
    for patient in patients:
        f = engineer_clustering_features(patient)
        row = {name: f.get(name, np.nan) for name in feature_names}
        rows.append(row)

    X = pd.DataFrame(rows)
    X_imp = imputer.transform(X)
    X_scl = scaler.transform(X_imp)

    results = []
    for i, patient in enumerate(patients):
        X_i = X_scl[i : i + 1]
        distances = np.array([float(np.linalg.norm(X_i[0] - c)) for c in centroids])
        label = int(np.argmin(distances))

        inv_dist = 1.0 / (distances + 1e-8)
        similarities = {str(j): float(inv_dist[j] / inv_dist.sum()) for j in range(len(centroids))}
        dist_dict = {str(j): float(distances[j]) for j in range(len(centroids))}

        cluster_name = "Unknown"
        recommendation = ""
        if profiles and str(label) in profiles:
            cluster_name = profiles[str(label)].get("cluster_name", "Unknown")
            recommendation = profiles[str(label)].get("clinical_recommendation", "")

        results.append({
            "patientId": patient.get("id", "unknown"),
            "cluster_label": label,
            "cluster_name": cluster_name,
            "recommendation": recommendation,
            "distances": dist_dict,
            "similarities": similarities,
        })

    return results


def main():
    raw = sys.stdin.read()
    if not raw:
        print(json.dumps({"error": "No input"}), file=sys.stderr)
        sys.exit(1)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON"}), file=sys.stderr)
        sys.exit(1)

    artifact, profiles = load_cluster_model()
    if artifact is None:
        print(json.dumps({"error": "No trained clustering model found in ml_output/clusters/"}), file=sys.stderr)
        sys.exit(1)

    # Support both single patient and batch
    if "patient" in data:
        result = assign_cluster(data["patient"], artifact, profiles)
        print(json.dumps(result))
    elif "patients" in data:
        results = assign_batch_clusters(data["patients"], artifact, profiles)
        print(json.dumps({"clusters": results}))
    else:
        print(json.dumps({"error": "Expected {patient: {...}} or {patients: [...]}"}, file=sys.stderr))
        sys.exit(1)


if __name__ == "__main__":
    main()
