# Impella Analytics ML Model Report

## Overview

This report summarizes machine-learning models trained to predict three clinical outcomes for Impella-supported patients.

## Targets

1. **Survival** — Whether the patient expired during the hospitalization.
2. **MCS Escalation** — Whether the patient required ECMO, LVAD, transplant, or had a post-implant arrest.
3. **RV Dysfunction** — Composite clinical criteria (PAPI < 1.0, RA > 20, TAPSE < 1.6, RV S' < 9.5, RV-CPO drop > 30%, or explicit RV failure in notes).

## Feature Set

Total engineered features: **185**

### Categories
- Demographics & baseline (age, BMI, gender, race, SCAI stage, cause of shock)
- Pre-implant RHC hemodynamics
- Post-implant RHC hemodynamics
- Delta & ratio features (post − pre, post / pre)
- Echo metrics (pre & post)
- Laboratory values (pre & post)
- Inotrope & diuretic data
- Impella settings (performance level, flow)
- PV loop mechanics (Ees, Ea, Ees/Ea)

## Cross-Validation Results

### survival

| Model | AUC | Accuracy | Precision | Recall | F1 |
|-------|-----|----------|-----------|--------|----|
| LogisticRegression | 0.537 | 0.586 | 0.140 | 0.412 | 0.209 |
| RandomForest | 0.536 | 0.742 | 0.056 | 0.059 | 0.057 |

**Best model:** LogisticRegression (AUC = 0.537)

### escalation

| Model | AUC | Accuracy | Precision | Recall | F1 |
|-------|-----|----------|-----------|--------|----|
| LogisticRegression | 0.832 | 0.867 | 0.300 | 0.231 | 0.261 |
| RandomForest | 0.950 | 0.914 | 1.000 | 0.154 | 0.267 |

**Best model:** RandomForest (AUC = 0.950)

### rv_dysfunction

| Model | AUC | Accuracy | Precision | Recall | F1 |
|-------|-----|----------|-----------|--------|----|
| LogisticRegression | 0.925 | 0.922 | 1.000 | 0.500 | 0.667 |
| RandomForest | 0.890 | 0.852 | 1.000 | 0.050 | 0.095 |

**Best model:** LogisticRegression (AUC = 0.925)

## Clinical Interpretation

- **AUC > 0.75** is considered clinically useful for risk stratification.
- **AUC 0.65–0.75** provides moderate discrimination and may be useful as a screening tool.
- Models with low recall on the positive class may miss high-risk patients; consider lowering the decision threshold in production.

## Limitations

- Small sample size (67–112 patients) limits model generalizability.
- Missing data is imputed with median values; this may obscure true clinical trajectories.
- RV dysfunction target is partially derived from echo data, which is missing for some patients.
- The models have not been externally validated on an independent cohort.

## Next Steps

1. External validation on a separate institutional cohort.
2. Collect more complete echo and lab data to reduce imputation.
3. Implement dynamic threshold tuning based on clinical cost of false negatives.
4. Integrate the best model into the Node.js dashboard via the exported JSON coefficients.
