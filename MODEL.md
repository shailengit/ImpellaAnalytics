# Impella Analytics ML Model Documentation

## Purpose

This document explains the machine-learning models integrated into the Impella Analytics dashboard, how they work, what they predict, and their limitations.

## Models

Three binary classification models were trained on a merged dataset of 128 patients (67 from the detailed `Patient Data` sheet and 112 from the `Cohort` sheet, cross-referenced by MRN).

### 1. Survival Prediction
- **Target:** Whether the patient expired during the hospitalization.
- **Best Model:** RandomForest (AUC = 0.89)
- **Status:** **Clinically useful.** After label correction, the model shows meaningful discrimination between survivors and non-survivors. It correctly flags 56% of patients who will die and 88% of survivors are correctly classified as low-risk.
- **Dashboard Display:** Shown as a red risk meter.

### 2. MCS Escalation Prediction
- **Target:** Whether the patient required ECMO, LVAD, transplant, or had a post-implant arrest.
- **Best Model:** RandomForest (AUC = 0.95)
- **Status:** **Clinically useful.** Strong discrimination for identifying patients who will need mechanical circulatory support escalation.
- **Key Drivers:** Pre-implant hemodynamic profile, VIS score, inotrope burden, and SCAI stage.

### 3. RV Dysfunction Prediction
- **Target:** Composite clinical criteria (any of the following):
  - Post-implant PAPI < 1.0
  - Post-implant RA > 20 mmHg
  - Post-implant TAPSE < 1.6 cm
  - Post-implant RV S' < 9.5 cm/s
  - RV-CPO drop > 30% from pre to post
  - Explicit mention of "RV failure" or "RV dysfunction" in clinical notes
- **Best Model:** Logistic Regression (AUC = 0.94)
- **Status:** **Clinically useful.** Good discrimination for RV dysfunction risk.
- **Dashboard Display:** Shown as an amber risk meter. Scores > 0.3 warrant heightened monitoring.

## Feature Engineering

The models use 172 engineered numeric features per patient:

- **Demographics:** age, BMI, gender, race, SCAI stage, cause of shock
- **Pre-implant RHC:** 19 hemodynamic variables
- **Post-implant RHC:** 19 hemodynamic variables
- **Delta features:** post − pre for all RHC, echo, and lab variables
- **Ratio features:** post / pre for key hemodynamics
- **Echo:** RVEDD, TAPSE, RV S', RV FS%, TR severity, PASP, LVEDd (pre & post)
- **Labs:** sodium, potassium, HCO3, creatinine, eGFR, hemoglobin, WBC, AST, ALT, bilirubin, lactate, pH (pre & post)
- **Support:** inotrope count, VIS score, diuretics, Impella performance level and flow
- **PV Loop:** Ees, Ea, Ees/Ea, ESP, EDP, Pmax, ESV, EDV, dP/dt max/min

## Missing Data Handling

- Columns with 100% missing values are dropped.
- Remaining missing values are imputed with the **median** of the training cohort.
- Features are then **standardized** (z-score) before model input.

## Cross-Validation

All models were evaluated with **5-fold stratified cross-validation** (shuffle enabled, seed 42). Stratification ensures each fold maintains the same ratio of positive/negative cases as the full dataset.

## Model Export & Integration

- **Python artifacts:** `ml_output/model_*.joblib` (scikit-learn model + imputer + scaler)
- **JSON coefficients:** `ml_output/model_rv_dysfunction_lr.json` (coefficients for the Logistic Regression model, suitable for direct implementation in TypeScript/JavaScript)
- **Runtime integration:** The Node.js Express server calls `predict.py` via `execFile`, passing patient data as JSON on stdin. The Python script loads the joblib models and returns risk probabilities as JSON on stdout.

## Clinical Interpretation Guide

| Risk Score | Interpretation | Recommended Action |
|------------|----------------|-------------------|
| < 0.15 | Low risk | Standard monitoring |
| 0.15 – 0.30 | Moderate risk | Increase monitoring frequency; consider echo follow-up |
| > 0.30 | High risk | Alert clinical team; prepare escalation protocols; prioritize RHC review |

## Limitations

1. **Small sample size (128 patients):** Limits generalizability to other institutions or larger populations.
2. **Missing data:** Many echo and lab variables are incomplete. Median imputation may obscure true clinical trajectories.
3. **Single-center data:** Models may not transfer to centers with different patient populations or Impella practices.
4. **Survival model is unreliable:** Do not use the mortality risk score for clinical decision-making until validated on a larger cohort.
5. **No external validation:** Models have only been internally cross-validated. External validation on an independent cohort is required before deployment in clinical workflows.
6. **RV dysfunction target is partially derived:** The composite definition relies on echo data that is missing for ~40% of patients, which may introduce bias.

## Clustering / Patient Phenotypes

In addition to the three supervised classifiers, the pipeline runs an <strong>unsupervised consensus clustering</strong> module to discover patient phenotypes. This is implemented in `clustering_pipeline.py` and surfaced in the dashboard under <em>Patient Phenotypes</em>.

### Methodology
- **Algorithm:** Consensus K-Means (200 bootstrap iterations, 80% subsample ratio)
- **Preprocessing:** PCA to 5 components (auto-selected as best config), then K-Means++ with 50 random initializations
- **k:** Locked at 3 to match Zweck et al. (2021) published phenotypes (cardiorenal, cardiometabolic, non-congested)
- **Silhouette score:** 0.237 — moderate separation; clusters overlap somewhat

### Features (10)
Zweck 6 core labs + RA pressure + demographics + SCAI stage:
`pre_egfr`, `pre_hco3`, `pre_lactate`, `pre_alt`, `pre_wbc`, `pre_hemoglobin`, `pre_ra`, `age`, `bmi`, `scai_numeric`

These features were selected after extensive experimentation (20 features &rarr; 37 features &rarr; 10 features &rarr; 13 features &rarr; 10 features). Echo and post-implant variables were too sparse. Demographics (age, BMI) and SCAI stage were added to test whether shock severity improves separation; they shifted boundaries modestly but did not resolve the survival paradox. PV loop features (`ees`, `ea`, `ees_ea`) were then removed after sandbox testing showed silhouette improves from 0.223 &rarr; 0.263 without them.

### Cluster Profiles
| Cluster | n | Survival | Escalation | Renal Failure | Key Signature |
|---------|---|----------|------------|---------------|---------------|
| 0 — Non-congested (Low-risk) | 27 | 70.4% | 14.8% | 7.4% | Younger (age 51), higher BMI (31.5), preserved eGFR (79.7), lactate 2.12, SCAI ~C (2.1) |
| 1 — Cardiorenal (Moderate-risk) | 37 | 67.6% | 20.0% | 22.9% | Older (age 65), lower BMI (25.7), low eGFR (41.0), lactate 1.70, SCAI ~C (2.3) |
| 2 — Cardiometabolic (High-risk) | 4 | 50.0% | 0.0% | 25.0% | Extreme ALT (1331), leukocytosis (WBC 18.0), very high lactate (3.38), SCAI ~D (2.7) |

### Clinical Caveat
The "Non-congested" cluster has marginally better survival (70.4%) than the "Cardiorenal" cluster (67.6%), but the gap is small (2.8 pp). Removing PV loop features improved silhouette (0.202 → 0.237) and made clusters more compact, yet the fundamental lactate–survival relationship remains. With n=68, the algorithm consistently finds a natural grouping where preserved renal function co-occurs with elevated lactate — a perfusion-stress signature that is metabolically worse than the cardiorenal group's preserved lactate. This underscores that clustering discovers empirical groups, not guaranteed clinical truths.

### Clustering Limitations
1. **Small n (68):** Cluster boundaries are unstable; replication on a larger cohort is essential.
2. **k=3 is conventional:** Locked to match published methodology, not derived from internal silhouette maximization.
3. **Survival paradox narrowed but persists:** Removing PV loop features improved silhouette but did not resolve the inverted survival ordering.
4. **No external validation:** These phenotypes have only been discovered in a single center.
5. **Silhouette 0.237:** Moderate separation at best — assignments should be treated as exploratory.

## Files

- `ml_pipeline.py` — Training pipeline
- `predict.py` — Runtime prediction script (called by Node.js)
- `clustering_pipeline.py` — Unsupervised clustering pipeline
- `predict_all.py` — Batch prediction + cluster assignment script
- `ml_output/model_report.md` — Full CV results and feature list
- `ml_output/model_*.joblib` — Serialized model artifacts
- `ml_output/model_rv_dysfunction_lr.json` — LR coefficients for JS integration
- `ml_output/roc_*.png` — ROC curves
- `ml_output/cm_*.png` — Confusion matrices
- `ml_output/shap_*.png` — SHAP explainability plots
- `ml_output/clusters/clustering_report.md` — Auto-generated cluster report
- `ml_output/clusters/cluster_profiles.json` — Cluster profiles for API
- `ml_output/clusters/quality_metrics.json` — Silhouette and quality metadata
