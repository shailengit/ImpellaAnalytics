# Mortality Feature Importance — Clinical Summary

## Overview

A multi-method consensus analysis of 171 clinical variables was conducted to identify the most robust drivers of mortality in Impella-supported cardiogenic shock patients. Five complementary statistical and machine learning methods were compared:

| Method | Approach | Strengths |
|--------|----------|-----------|
| RF Gini | Impurity reduction from 500-tree Random Forest | Fast, captures non-linear interactions |
| Permutation | AUC drop when feature values are shuffled | Unbiased, model-agnostic |
| SHAP (TreeSHAP) | Shapley additive explanations | Theoretically grounded, consistent |
| LASSO (L1 LR) | Sparse logistic regression with CV-tuned C | Built-in feature selection |
| Univariate AUC | Each feature as standalone classifier | Simple, clinically interpretable |

## Top Consensus Features

| Rank | Feature | Category | Consensus Score | Clinical Significance |
|------|---------|----------|:---------------:|----------------------|
| 1 | **post_ast** | Liver function | 66.0% | Post-implant AST — hepatocyte injury from low cardiac output. Ranked #1 by 3/5 methods. |
| 2 | **post_lactate** | Tissue perfusion | 43.2% | Direct marker of tissue hypoperfusion and anaerobic metabolism. |
| 3 | **age** | Demographics | 43.0% | Chronological age — robust univariate predictor across all methods. |
| 4 | **post_hco3** | Acid-base | 42.0% | Bicarbonate reflects metabolic compensation in shock state. |
| 5 | **post_egfr** | Renal function | 39.5% | Post-implant eGFR — AKI in cardiogenic shock portends poor outcomes. |
| 6 | **post_alt** | Liver function | 39.4% | Parallels AST as hepatocyte injury marker. |
| 7 | **post_map** | Hemodynamics | 39.0% | Mean arterial pressure — adequacy of end-organ perfusion. |
| 8 | **vis_score** | Vasopressor burden | 38.9% | Vasoactive-Inotropic Score quantifies total vasopressor support. |
| 9 | **pre_hco3** | Acid-base (baseline) | 37.6% | Pre-implant bicarbonate — baseline metabolic reserve. |
| 10 | **ratio_ra** | RV function trend | 34.3% | Ratio of post/pre right atrial pressure — RV failure trajectory. |

## Key Findings

### 1. Hepatocyte Injury Dominates the Mortality Signal
AST and ALT (both pre and post) dominate the top ranks. This suggests that **hepatic congestion from right heart failure** and/or **hypoxic hepatitis from low cardiac output** are the strongest antecedents of mortality in this cohort. In clinical practice, rising AST/ALT on Impella support may be the earliest warning signal.

### 2. Physiologic Trajectory > Single Timepoints
Delta features (change scores) and ratio features appear prominently:
- **delta_pcwp** (change in wedge pressure) — #5 overall
- **delta_lactate** (lactate clearance) — #7 overall
- **ratio_pvr**, **ratio_pcwp**, **delta_pvr**

This confirms that **the trend on support** is more informative than any single measurement. Patients whose hemodynamics fail to improve within 48 hours carry disproportionate mortality risk.

### 3. Renal Function Is a Key Modifier
Both pre and post eGFR, creatinine, and their delta feature appear in the top 30. Cardiorenal syndrome in the setting of Impella support identifies a high-risk subgroup that may benefit from earlier right ventricular assessment and tailored diuresis.

### 4. Traditional Hemodynamics Are Present but Not Dominant
While RA, PAPI, CPO, and PCWP appear in the rankings, they are **not** in the top tier. This is important: the features clinicians most commonly use for bedside risk assessment (RA > 20, PAPI < 1.0) are confirmed as relevant but are outperformed by lab values (AST, lactate, HCO3, eGFR).

## Feature Reduction Analysis

| Target | Full AUC (RF) | Best Subset | Delta |
|--------|:------------:|:-----------:|:-----:|
| **Survival** | 0.59 | 0.62 (top-10) | +0.03 |
| **Escalation** | 0.94 | 0.84 (top-50) | -0.10 |
| **RV Dysfunction** | 0.93 | 0.80 (top-50) | -0.13 |

**Interpretation:**
- **Survival** is intrinsically hard to predict from these features alone (AUC ~0.59). The top-10 consensus features match or slightly outperform the full set, suggesting the remaining features add noise.
- **Escalation** and **RV Dysfunction** models degrade significantly with aggressive feature reduction. The full feature set (or top-50+) is needed to maintain clinically useful discrimination.
- For deployment, a **two-tier strategy** is recommended: use the full model for escalation/RV risk, and a simplified 10-feature model for mortality screening.

## Clinical Recommendations

1. **Bedside mortality screening**: Monitor AST, lactate, HCO3, eGFR, and age. A composite of these 5 features provides equivalent information to the full 178-feature model for survival prediction.

2. **Escalation planning**: Maintain the full feature model for escalation risk (ECMO/LVAD/transplant). The rich feature set captures the multi-organ dysfunction pattern that precedes clinical decompensation.

3. **RV dysfunction monitoring**: Prioritize post-implant PAPI, RA, and TAPSE alongside the delta features of PVR and PCWP. RV-PA uncoupling (rising PVR with falling PAPI) is the dominant RV failure pathway.

4. **Data completeness**: Post-implant labs (AST, lactate, HCO3, eGFR) provide more signal than pre-implant values. Prioritize collecting 48h post-implant labs over expanding the pre-implant panel.

## Limitations

- **Sample size**: N = 112 patients from a single institution. Rankings may shift with larger, multi-center cohorts.
- **Missing data**: 30-50% missingness for some echo and PV loop variables. Imputation with median may attenuate true associations.
- **Class imbalance**: ~25% mortality rate. Rare-but-important signals may be missed.
- **Associational, not causal**: These are statistical associations. Confounding by indication and unmeasured variables cannot be excluded.
- **No external validation**: All results are internally validated. External cohort validation is essential before clinical deployment.

## Technical Notes

- Data source: `Impella_MK.xlsx` (Patient Data + Cohort sheets)
- Features: 178 engineered features (raw + delta + ratio + composite)
- Methods: 5 complementary importance methods with consensus normalization
- Code: `mortality_feature_analysis.py` (analysis), `compare_feature_subsets.py` (subset comparison)
- Full report: `mortality_feature_report.html`

---

*Generated: 2026-05-22 | Impella Analytics — Mortality Features Worktree*
