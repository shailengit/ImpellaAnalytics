"""
Quick test: Pure Zweck 6 features + k=3 only.
Does not modify main pipeline artifacts.
"""
import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
import joblib

# Load data using same logic as clustering_pipeline
import sys
sys.path.insert(0, str(Path(__file__).parent))
from clustering_pipeline import (
    load_patient_data, load_cohort, engineer_clustering_features,
    DATA_PATH, RANDOM_STATE
)

# Pure Zweck 6
def main():
    df_pd = load_patient_data(DATA_PATH)
    df_cohort = load_cohort(DATA_PATH)
    df = df_pd.merge(df_cohort, on="mrn", how="left")
    df = engineer_clustering_features(df)

    features = ["pre_egfr", "pre_hco3", "pre_lactate", "pre_alt", "pre_wbc", "pre_hemoglobin"]
    df_f = df[features].copy()

    # Drop >50% missing
    mask = df_f.isna().mean(axis=1) <= 0.5
    df_f = df_f[mask].copy()
    df_good = df[mask].copy()

    imp = SimpleImputer(strategy="median")
    scl = StandardScaler()
    X = scl.fit_transform(imp.fit_transform(df_f))

    # Test raw k-means
    km = KMeans(n_clusters=3, init="k-means++", n_init=50, random_state=RANDOM_STATE)
    labels = km.fit_predict(X)
    sil_raw = silhouette_score(X, labels)

    # Test PCA-5
    pca = PCA(n_components=min(5, X.shape[1]), random_state=RANDOM_STATE)
    X_pca = pca.fit_transform(X)
    km_pca = KMeans(n_clusters=3, init="k-means++", n_init=50, random_state=RANDOM_STATE)
    labels_pca = km_pca.fit_predict(X_pca)
    sil_pca = silhouette_score(X_pca, labels_pca)

    # Build profiles
    print("=" * 60)
    print("PURE ZWECK 6 FEATURES + k=3")
    print("=" * 60)
    print(f"Patients retained: {len(df_f)}")
    print(f"Silhouette (raw):  {sil_raw:.3f}")
    print(f"Silhouette (PCA5): {sil_pca:.3f}")
    print()

    for i in range(3):
        mask_i = labels_pca == i
        subset = df_good[mask_i]
        n = len(subset)
        mf = {f: float(df_f[f][mask_i].mean()) for f in features}

        surv = None
        if "cohort_outcome" in subset.columns:
            survived = subset["cohort_outcome"].astype(str).str.lower().str.strip().eq("survived").sum()
            surv = survived / n if n > 0 else None

        print(f"Cluster {i}: {n} patients")
        print(f"  eGFR={mf['pre_egfr']:.1f}, HCO3={mf['pre_hco3']:.1f}, Lactate={mf['pre_lactate']:.2f}")
        print(f"  ALT={mf['pre_alt']:.1f}, WBC={mf['pre_wbc']:.1f}, HGB={mf['pre_hemoglobin']:.1f}")
        print(f"  Survival: {surv:.1%}" if surv is not None else "  Survival: N/A")
        print()

if __name__ == "__main__":
    main()
