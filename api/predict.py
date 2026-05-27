"""
Vercel Python serverless function — ML risk prediction + cluster assignment.
Accepts POST with JSON {"patients": [...]}, returns predictions and clusters.
"""
import json
import warnings
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from http.server import BaseHTTPRequestHandler

warnings.filterwarnings("ignore")

ML_OUTPUT = Path(__file__).resolve().parent.parent / "ml_output"
CLUSTERS_DIR = ML_OUTPUT / "clusters"

# ---------------------------------------------------------------------------
# Module-level model cache (survives warm starts)
# ---------------------------------------------------------------------------
_RISK_ARTIFACTS: dict = {}
_CLUSTER_ARTIFACT: dict | None = None
_CLUSTER_PROFILES: dict | None = None


def _load_risk_models() -> dict:
    global _RISK_ARTIFACTS
    if _RISK_ARTIFACTS:
        return _RISK_ARTIFACTS
    for target in ["survival", "escalation", "rv_dysfunction"]:
        path = ML_OUTPUT / f"model_{target}.joblib"
        if path.exists():
            _RISK_ARTIFACTS[target] = joblib.load(path)
    return _RISK_ARTIFACTS


def _load_cluster_model():
    global _CLUSTER_ARTIFACT, _CLUSTER_PROFILES
    if _CLUSTER_ARTIFACT is not None:
        return _CLUSTER_ARTIFACT, _CLUSTER_PROFILES
    model_path = CLUSTERS_DIR / "cluster_model.joblib"
    if not model_path.exists():
        return None, None
    _CLUSTER_ARTIFACT = joblib.load(model_path)
    profiles_path = CLUSTERS_DIR / "cluster_profiles.json"
    if profiles_path.exists():
        with open(profiles_path) as fp:
            _CLUSTER_PROFILES = json.load(fp)
    return _CLUSTER_ARTIFACT, _CLUSTER_PROFILES


# ---------------------------------------------------------------------------
# Feature engineering (must match ml_pipeline.py + clustering_pipeline.py)
# ---------------------------------------------------------------------------

def _engineer_risk_features(record: dict) -> dict:
    f = dict(record)
    f["bmi"] = f.get("weight_kg", np.nan) / ((f.get("height_cm", np.nan) / 100) ** 2)

    rhc_vars = [
        "ra", "rvsp", "rvdp", "pasp", "padp", "map", "pcwp", "pvr",
        "sbp", "dbp", "hr", "tdco", "sv", "pa_o2", "sp_o2", "papi", "cpo", "rv_cpo",
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

    lab_vars = ["sodium", "potassium", "hco3", "creatinine", "egfr",
                "hemoglobin", "wbc", "ast", "alt", "bili", "lactate", "ph"]
    for v in lab_vars:
        pre = f.get(f"pre_{v}")
        post = f.get(f"post_{v}")
        if pre is not None and post is not None and not (pd.isna(pre) or pd.isna(post)):
            f[f"delta_{v}"] = post - pre
        else:
            f[f"delta_{v}"] = np.nan

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
    f["scai_stage"] = f["scai_numeric"]

    f["shock_cause_numeric"] = pd.to_numeric(f.get("cause_of_shock"), errors="coerce")
    f["gender_numeric"] = pd.to_numeric(f.get("gender"), errors="coerce")
    f["race_numeric"] = pd.to_numeric(f.get("race"), errors="coerce")
    return f


def _engineer_cluster_features(record: dict) -> dict:
    f = dict(record)
    w = f.get("weight_kg")
    h = f.get("height_cm")
    f["bmi"] = w / ((h / 100) ** 2) if w is not None and h is not None and h > 0 else np.nan

    pre_cpo = f.get("pre_cpo")
    post_cpo = f.get("post_cpo")
    f["delta_cpo"] = post_cpo - pre_cpo if pre_cpo is not None and post_cpo is not None else np.nan

    pre_lac = f.get("pre_lactate")
    post_lac = f.get("post_lactate")
    f["delta_lactate"] = post_lac - pre_lac if pre_lac is not None and post_lac is not None else np.nan

    pre_creat = f.get("pre_creatinine")
    post_creat = f.get("post_creatinine")
    f["delta_creatinine"] = post_creat - pre_creat if pre_creat is not None and post_creat is not None else np.nan

    pre_papi = f.get("pre_papi")
    post_papi = f.get("post_papi")
    f["delta_papi"] = post_papi - pre_papi if pre_papi is not None and post_papi is not None else np.nan

    pre_ra = f.get("pre_ra")
    pre_pcwp = f.get("pre_pcwp")
    f["congestion_score"] = pre_ra + pre_pcwp if pre_ra is not None and pre_pcwp is not None else np.nan

    def _scai_to_numeric(val):
        if pd.isna(val):
            return np.nan
        try:
            n = float(val)
            if 1 <= n <= 4:
                return int(n)
        except (ValueError, TypeError):
            pass
        s = str(val).lower().strip()
        scai_map = {"a": 1, "b": 1, "c": 2, "d": 3, "e": 4}
        return scai_map.get(s, np.nan)

    f["scai_numeric"] = _scai_to_numeric(f.get("scai_stage"))

    inotrope_cols = ["dopamine", "dobutamine", "epinephrine", "milrinone", "norepinephrine", "vasopressin"]
    f["inotrope_count"] = sum(1 for c in inotrope_cols if f.get(c, 0) > 0)

    vis = f.get("vis_score", np.nan)
    f["vis_high"] = 1 if vis > 15 else 0 if not pd.isna(vis) else np.nan

    return f


def _predict_risk_all(patients: list, artifacts: dict) -> list:
    results = []
    for p in patients:
        f = _engineer_risk_features(p)
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
        results.append({"patientId": p.get("id", "unknown"), "scores": scores})
    return results


def _predict_clusters_all(patients: list, artifact: dict, profiles: dict | None) -> list:
    feature_names = artifact["feature_names"]
    imputer = artifact["imputer"]
    scaler = artifact["scaler"]
    centroids = artifact["kmeans_centroids"]
    pca = artifact.get("pca")

    rows = []
    for p in patients:
        f = _engineer_cluster_features(p)
        rows.append({name: f.get(name, np.nan) for name in feature_names})

    if not rows:
        return []

    X = pd.DataFrame(rows)
    X_imp = imputer.transform(X)
    X_scl = scaler.transform(X_imp)

    if pca is not None:
        X_scl = pca.transform(X_scl)

    results = []
    for i in range(len(patients)):
        X_i = X_scl[i]
        distances = np.array([float(np.linalg.norm(X_i - c)) for c in centroids])
        label = int(np.argmin(distances))
        inv_dist = 1.0 / (distances + 1e-8)
        sim_sum = inv_dist.sum()
        similarities = {str(j): float(inv_dist[j] / sim_sum) for j in range(len(centroids))}
        dist_dict = {str(j): float(distances[j]) for j in range(len(centroids))}

        cluster_name = "Unknown"
        recommendation = ""
        if profiles and str(label) in profiles:
            cluster_name = profiles[str(label)].get("cluster_name", "Unknown")
            recommendation = profiles[str(label)].get("clinical_recommendation", "")

        results.append({
            "patientId": patients[i].get("id", "unknown"),
            "cluster_label": label,
            "cluster_name": cluster_name,
            "recommendation": recommendation,
            "distances": dist_dict,
            "similarities": similarities,
        })
    return results


# ---------------------------------------------------------------------------
# Vercel handler
# ---------------------------------------------------------------------------

class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length else b"{}"
            data = json.loads(body)
            patients = data.get("patients", [])

            risk_artifacts = _load_risk_models()
            cluster_artifact, cluster_profiles = _load_cluster_model()

            predictions = _predict_risk_all(patients, risk_artifacts) if risk_artifacts else []
            clusters = _predict_clusters_all(patients, cluster_artifact, cluster_profiles) if cluster_artifact else []

            result = json.dumps({"predictions": predictions, "clusters": clusters}).encode()

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(result)

        except Exception as e:
            error_body = json.dumps({"error": str(e)}).encode()
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(error_body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
