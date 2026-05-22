# Impella Patient Clustering Report

**Date**: Auto-generated
**Method**: Consensus K-Means (k=3, 200 bootstrap iterations, 80% subsample)
**Silhouette Score**: 0.237
**Features Used**: 10

## Cluster Summary

### Cluster 0: Non-congested (Low-risk)
- **Patients**: 27
- **Survival Rate**: 70.4%
- **Escalation Rate**: 14.8%
- **Renal Failure Rate**: 7.4%
- **Recommendation**: Early weaning candidate — monitor for bounce-back

| Feature | Mean Value |
|---------|------------|
| age | 50.741 |
| bmi | 31.538 |
| pre_alt | 39.038 |
| pre_egfr | 79.667 |
| pre_hco3 | 24.074 |
| pre_hemoglobin | 12.993 |
| pre_lactate | 2.118 |
| pre_ra | 10.185 |
| pre_wbc | 7.963 |
| scai_numeric | 2.077 |

### Cluster 1: Cardiorenal (Moderate-risk)
- **Patients**: 37
- **Survival Rate**: 67.6%
- **Escalation Rate**: 20.0%
- **Renal Failure Rate**: 22.9%
- **Recommendation**: Staged escalation planning — watch for RV deterioration

| Feature | Mean Value |
|---------|------------|
| age | 65.216 |
| bmi | 25.737 |
| pre_alt | 57.216 |
| pre_egfr | 40.973 |
| pre_hco3 | 23.459 |
| pre_hemoglobin | 10.657 |
| pre_lactate | 1.703 |
| pre_ra | 14.189 |
| pre_wbc | 6.478 |
| scai_numeric | 2.257 |

### Cluster 2: Cardiometabolic (High-risk)
- **Patients**: 4
- **Survival Rate**: 50.0%
- **Escalation Rate**: 0.0%
- **Renal Failure Rate**: 25.0%
- **Recommendation**: Consider advanced MCS / RV support / transplant evaluation

| Feature | Mean Value |
|---------|------------|
| age | 67.000 |
| bmi | 27.794 |
| pre_alt | 1331.250 |
| pre_egfr | 62.500 |
| pre_hco3 | 18.500 |
| pre_hemoglobin | 12.800 |
| pre_lactate | 3.375 |
| pre_ra | 15.250 |
| pre_wbc | 18.037 |
| scai_numeric | 2.667 |

## Clinical Interpretation

- **Non-congested (Low-risk)**: Best preserved renal function, lowest lactate, positive CPO response → early weaning candidates
- **Cardiorenal (Moderate-risk)**: Elevated creatinine, congestion, borderline hemodynamics → staged escalation planning
- **Cardiometabolic (High-risk)**: Elevated lactate, hepatic dysfunction, poor hemodynamic response → consider advanced MCS/RV support/transplant

## Limitations

- Small sample size limits cluster stability
- Missing data imputed with median; sparse features (PV loop, echo) may reduce effective signal
- Clusters are exploratory; validate on external cohort before clinical use
- k=3 is locked per Zweck et al. (2021) published methodology, not selected via silhouette maximization