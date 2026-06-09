# Graph Report - ImpellaAnalytics  (2026-05-21)

## Corpus Check
- 35 files · ~77,572 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 787 nodes · 950 edges · 50 communities (43 shown, 7 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 103 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `86af5991`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Clinical Features|Clinical Features]]
- [[_COMMUNITY_Documentation and Cluster Profiles|Documentation and Cluster Profiles]]
- [[_COMMUNITY_Clustering Pipeline Core|Clustering Pipeline Core]]
- [[_COMMUNITY_ML Training Pipeline|ML Training Pipeline]]
- [[_COMMUNITY_Cluster Clinical Recommendations|Cluster Clinical Recommendations]]
- [[_COMMUNITY_Dashboard Verification|Dashboard Verification]]
- [[_COMMUNITY_PV Loop Hemodynamics|PV Loop Hemodynamics]]
- [[_COMMUNITY_Cluster Feature Means|Cluster Feature Means]]
- [[_COMMUNITY_ML Model Features|ML Model Features]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_Patient Data Loading|Patient Data Loading]]
- [[_COMMUNITY_Build Toolchain|Build Toolchain]]
- [[_COMMUNITY_PV Loop Regression Charts|PV Loop Regression Charts]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Prediction Script|Prediction Script]]
- [[_COMMUNITY_Cluster Visualization|Cluster Visualization]]
- [[_COMMUNITY_Excel Verification|Excel Verification]]
- [[_COMMUNITY_Escalation ROC Curves|Escalation ROC Curves]]
- [[_COMMUNITY_Cluster Assignment|Cluster Assignment]]
- [[_COMMUNITY_PV Loop Scatter Charts|PV Loop Scatter Charts]]
- [[_COMMUNITY_Survival ROC Curves|Survival ROC Curves]]
- [[_COMMUNITY_PCA Cluster Projection|PCA Cluster Projection]]
- [[_COMMUNITY_Model Coefficients|Model Coefficients]]
- [[_COMMUNITY_RV Dysfunction Coefficients|RV Dysfunction Coefficients]]
- [[_COMMUNITY_Best Models Registry|Best Models Registry]]
- [[_COMMUNITY_Consensus Matrix|Consensus Matrix]]
- [[_COMMUNITY_Dendrogram|Dendrogram]]
- [[_COMMUNITY_Project Metadata|Project Metadata]]
- [[_COMMUNITY_Escalation Confusion Matrix|Escalation Confusion Matrix]]
- [[_COMMUNITY_RV Dysfunction Confusion Matrix|RV Dysfunction Confusion Matrix]]
- [[_COMMUNITY_SHAP Dependence Plot|SHAP Dependence Plot]]
- [[_COMMUNITY_Survival SHAP Plot|Survival SHAP Plot]]
- [[_COMMUNITY_Silhouette Analysis|Silhouette Analysis]]
- [[_COMMUNITY_PV Loop SHAP|PV Loop SHAP]]
- [[_COMMUNITY_Claude Settings|Claude Settings]]
- [[_COMMUNITY_Cluster Profile Builders|Cluster Profile Builders]]
- [[_COMMUNITY_Knowledge Base Alerts|Knowledge Base Alerts]]
- [[_COMMUNITY_K-Means Core|K-Means Core]]
- [[_COMMUNITY_Vite Environment|Vite Environment]]
- [[_COMMUNITY_Model Training Helpers|Model Training Helpers]]
- [[_COMMUNITY_Coefficient Plot Generator|Coefficient Plot Generator]]
- [[_COMMUNITY_Hierarchical Clustering|Hierarchical Clustering]]
- [[_COMMUNITY_Analytics Runner|Analytics Runner]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]

## God Nodes (most connected - your core abstractions)
1. `feature_importance` - 179 edges
2. `SHAP Summary Plot for Escalation Model` - 22 edges
3. `mean_features` - 21 edges
4. `mean_features` - 21 edges
5. `mean_features` - 21 edges
6. `main()` - 20 edges
7. `compilerOptions` - 15 edges
8. `App()` - 14 edges
9. `main()` - 13 edges
10. `cn()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `PVLoopPage()` --semantically_similar_to--> `PV Loop Analysis Guide`  [INFERRED] [semantically similar]
  src/components/PVLoopPage.tsx → public/pv-loop.html
- `PV Loop Analysis Guide` --semantically_similar_to--> `PVLoopPageV2`  [INFERRED] [semantically similar]
  public/pv-loop.html → src/components/PVLoopPageV2.tsx
- `PV Loop Coupling vs MCS Escalation Scatter Chart` --references--> `Impella_MK.xlsx Cohort Data`  [INFERRED]
  ml_output/pv_loop_scatter.png → Impella_MK.xlsx
- `Silhouette Analysis Plot (k=3, avg=0.105) — indicates weak cluster separation with some negative coefficients` --conceptually_related_to--> `clustering_pipeline.py — Consensus K-Means unsupervised phenotyping`  [INFERRED]
  ml_output/clusters/silhouette.png → clustering_pipeline.py
- `App()` --conceptually_related_to--> `Clinical User Guide`  [INFERRED]
  src/App.tsx → public/guide.html

## Hyperedges (group relationships)
- **PV Loop Analysis Views** — components_pvlooppage_pvlooppage, components_pvlooppagev2_pvlooppagev2, public_pv_loop [INFERRED 0.85]
- **ML Model Documentation** — model_md, ml_output_model_report, public_guide [INFERRED 0.75]
- **Patient Phenotype Clusters** — clusters_cluster_profiles_cluster0, clusters_cluster_profiles_cluster1, clusters_cluster_profiles_cluster2 [EXTRACTED 1.00]
- **PV Loop Coefficient Features** — ml_output_pv_loop_coefficients_concept, ml_output_pv_loop_coefficients_feature_pmax, ml_output_pv_loop_coefficients_feature_edp, ml_output_pv_loop_coefficients_feature_esp, ml_output_pv_loop_coefficients_feature_ees_ea, ml_output_pv_loop_coefficients_feature_ea, ml_output_pv_loop_coefficients_feature_ees [EXTRACTED 1.00]
- **Logistic Regression for MCS Escalation** — ml_output_pv_loop_coefficients_concept, ml_output_pv_loop_coefficients_model, ml_output_pv_loop_coefficients_outcome [EXTRACTED 1.00]
- **PV Loop Chart Generation** — ml_output_pv_loop_coefficients, ml_pipeline [INFERRED 0.85]
- **PV Loop Analysis Domain** — ml_output_pv_loop_coefficients, pv_loop_analysis [INFERRED 0.75]

## Communities (50 total, 7 thin omitted)

### Community 0 - "Clinical Features"
Cohesion: 0.01
Nodes (179): feature_importance, Absolute Value, age, bmi, cause_of_shock, days_between_rhc_and_impella, delta_alt, delta_ast (+171 more)

### Community 1 - "Documentation and Cluster Profiles"
Cohesion: 0.10
Nodes (39): Patient Cluster Profiles, Cardiometabolic (High-risk) Cluster, Cardiorenal (Moderate-risk) Cluster, Non-congested (Low-risk) Cluster, Clustering Report, CLUSTER_BG, CLUSTER_COLORS, ClusteringPage() (+31 more)

### Community 2 - "Clustering Pipeline Core"
Cohesion: 0.07
Nodes (39): assign_cluster_names(), build_cluster_profiles(), consensus_kmeans(), engineer_clustering_features(), export_assignments(), export_model(), export_profiles(), generate_report() (+31 more)

### Community 3 - "ML Training Pipeline"
Cohesion: 0.08
Nodes (37): age, weight_kg, build_targets(), engineer_features(), evaluate_model(), export_lr_json(), export_sklearn_joblib(), generate_report() (+29 more)

### Community 4 - "Cluster Clinical Recommendations"
Cohesion: 0.08
Nodes (30): 0, clinical_recommendation, cluster_name, escalation_rate, mrn_list, patient_count, renal_rate, scai_distribution (+22 more)

### Community 5 - "Dashboard Verification"
Cohesion: 0.07
Nodes (28): cpo, details, status, summary, delta_cpo, details, status, summary (+20 more)

### Community 6 - "PV Loop Hemodynamics"
Cohesion: 0.07
Nodes (27): auc, coefficients, ea, edp, ees, ees_ea, esp, pmax (+19 more)

### Community 7 - "Cluster Feature Means"
Cohesion: 0.24
Nodes (23): mean_features, mean_features, mean_features, age, bmi, delta_cpo, delta_creatinine, delta_lactate (+15 more)

### Community 8 - "ML Model Features"
Cohesion: 0.09
Nodes (23): bmi, delta_alt, delta_hemoglobin, delta_lactate, MCS Escalation Risk Model, height_cm, SHAP Summary Plot for Escalation Model, inotrope_count (+15 more)

### Community 9 - "Frontend Dependencies"
Cohesion: 0.05
Nodes (41): dependencies, axios, d3, dotenv, express, @google/genai, lucide-react, ml-random-forest (+33 more)

### Community 10 - "Patient Data Loading"
Cohesion: 0.11
Nodes (21): engineer_clustering_features, load_cohort, load_patient_data, PATIENT_DATA_ROWS, Impella Hemodynamic Analytics, build_targets, engineer_features, load_cohort (+13 more)

### Community 11 - "Build Toolchain"
Cohesion: 0.15
Nodes (13): 1. Survival Prediction, 2. MCS Escalation Prediction, 3. RV Dysfunction Prediction, Clinical Interpretation Guide, Cross-Validation, Feature Engineering, Files, Impella Analytics ML Model Documentation (+5 more)

### Community 12 - "PV Loop Regression Charts"
Cohesion: 0.18
Nodes (15): PV-Loop Logistic Regression Coefficients Chart, PV-Loop Logistic Regression Coefficients for MCS Escalation, ea, edp, ees, ees_ea, esp, pmax (+7 more)

### Community 13 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+8 more)

### Community 14 - "Prediction Script"
Cohesion: 0.14
Nodes (11): engineer_patient_features(), load_model(), main(), predict_patient(), predict.py — Standalone prediction script for Node.js integration.  Reads patien, Return dict of risk scores for one patient., Compute derived features for a single patient record., ai (+3 more)

### Community 15 - "Cluster Visualization"
Cohesion: 0.12
Nodes (15): Cluster C0, Cluster C1, Cluster C2, Clinical Outcome Rates by Cluster, Cluster C0, Cluster C1, Cluster C2, Escalation Outcome Rate (+7 more)

### Community 16 - "Excel Verification"
Cohesion: 0.19
Nodes (14): load_excel_raw(), main(), verify_dashboard.py — Validate dashboard metrics against raw Excel data  This sc, Verify that Excel PAPI values match (PASP - PADP) / RA., Verify deltaCPO and recoveryScore formulas against Excel CPO rows., Load both pandas and openpyxl views of the Patient Data sheet., Cross-check outcome coding and mcs_escalation against Cohort sheet., Verify that Excel CPO values match MAP * TDCO / 451. (+6 more)

### Community 17 - "Escalation ROC Curves"
Cohesion: 0.24
Nodes (12): Chance baseline, MCS escalation risk, ROC Curves — escalation, LogisticRegression (AUC=0.832), RandomForest (AUC=0.950), ROC AUC metric, Chance baseline, ROC Curves — rv_dysfunction (+4 more)

### Community 18 - "Cluster Assignment"
Cohesion: 0.27
Nodes (10): assign_batch_clusters(), assign_cluster(), engineer_clustering_features(), load_cluster_model(), main(), predict_cluster.py — Cluster assignment for new patients.  Reads patient data as, Assign clusters to multiple patients at once (batched for efficiency)., Compute derived features for clustering from a single patient record. (+2 more)

### Community 19 - "PV Loop Scatter Charts"
Cohesion: 0.25
Nodes (9): PV Loop Coupling vs MCS Escalation Scatter Chart, Escalated Patients, Logistic Regression Fit Curve, MCS Escalation, Non-Escalated Patients, Ees/Ea Threshold 0.40, Ees/Ea Threshold 0.60, Ees / Ea (Ventricular-Arterial Coupling) (+1 more)

### Community 20 - "Survival ROC Curves"
Cohesion: 0.33
Nodes (11): AUC metric, random chance baseline, ROC Curves — survival (image), Impella_MK.xlsx cohort data, LogisticRegression model, ml_pipeline.py training pipeline, mortality risk, poor model discrimination (near-chance AUC) (+3 more)

### Community 21 - "PCA Cluster Projection"
Cohesion: 0.22
Nodes (9): Patient Clusters (PCA Projection), Cluster 0, Cluster 1, Cluster 2, Clustering, Patient Data, PC1, PC2 (+1 more)

### Community 22 - "Model Coefficients"
Cohesion: 0.22
Nodes (8): coef, feature_names, imputer_statistics, intercept, model_type, scaler_mean, scaler_scale, target

### Community 23 - "RV Dysfunction Coefficients"
Cohesion: 0.22
Nodes (8): coef, feature_names, imputer_statistics, intercept, model_type, scaler_mean, scaler_scale, target

### Community 24 - "Best Models Registry"
Cohesion: 0.25
Nodes (7): best_models, escalation, rv_dysfunction, survival, feature_names, n_patients, targets

### Community 25 - "Consensus Matrix"
Cohesion: 0.40
Nodes (4): Consensus Index, Hierarchical Clustering, Patient Clusters, Consensus Matrix Heatmap

### Community 26 - "Dendrogram"
Cohesion: 0.50
Nodes (5): Hierarchical Clustering Dendrogram (Ward linkage), Distance, Hierarchical Clustering, Patient MRN, Ward linkage

### Community 27 - "Project Metadata"
Cohesion: 0.40
Nodes (4): description, majorCapabilities, name, requestFramePermissions

### Community 28 - "Escalation Confusion Matrix"
Cohesion: 0.70
Nodes (5): Impella_MK.xlsx cohort data, Confusion Matrices — escalation, MCS escalation risk outcome, LogisticRegression model performance, RandomForest model performance

### Community 29 - "RV Dysfunction Confusion Matrix"
Cohesion: 0.60
Nodes (5): ml_pipeline, Confusion Matrices — rv_dysfunction, LogisticRegression, RandomForest, RV Dysfunction

### Community 30 - "SHAP Dependence Plot"
Cohesion: 0.40
Nodes (5): SHAP dependence plot for ees_ea colored by pre_lvedd, ees_ea feature (x-axis), Interaction effect between ees_ea and pre_lvedd on model prediction, pre_lvedd interaction feature (color bar), SHAP model interpretability method

### Community 31 - "Survival SHAP Plot"
Cohesion: 0.60
Nodes (5): SHAP Interaction Summary Plot for Survival Model, age, SHAP interaction values, survival model (mortality risk), weight_kg

### Community 32 - "Silhouette Analysis"
Cohesion: 0.40
Nodes (5): Silhouette Analysis Plot (k=3, avg=0.105) — indicates weak cluster separation with some negative coefficients, clustering_pipeline.py — Consensus K-Means unsupervised phenotyping, K-Means Clustering (k=3, consensus), Unsupervised Patient Phenotyping, Silhouette Analysis (clustering validation metric)

### Community 33 - "PV Loop SHAP"
Cohesion: 0.50
Nodes (3): ees_ea_rank, n_features, patient_shap

### Community 35 - "Cluster Profile Builders"
Cohesion: 0.67
Nodes (3): assign_cluster_names, build_cluster_profiles, runClusterAssignment

### Community 36 - "Knowledge Base Alerts"
Cohesion: 0.67
Nodes (3): generate_ai_studio_knowledge_base, Historical Patient Knowledge Base, checkEscalationAlerts

### Community 46 - "Community 46"
Cohesion: 0.15
Nodes (12): Categories, Clinical Interpretation, Cross-Validation Results, escalation, Feature Set, Impella Analytics ML Model Report, Limitations, Next Steps (+4 more)

### Community 47 - "Community 47"
Cohesion: 0.17
Nodes (10): Architecture, Commands, Data Flow, Environment Variables, Full-Stack Vite + Express Monolith, graphify, Key Files, Project Overview (+2 more)

### Community 48 - "Community 48"
Cohesion: 0.25
Nodes (7): Clinical Interpretation, Cluster 0: Cardiometabolic (High-risk), Cluster 1: Cardiorenal (Moderate-risk), Cluster 2: Non-congested (Low-risk), Cluster Summary, Impella Patient Clustering Report, Limitations

### Community 49 - "Community 49"
Cohesion: 0.40
Nodes (4): Commands, Impella Analytics, ML Pipeline, Run Locally

## Knowledge Gaps
- **461 isolated node(s):** `name`, `description`, `requestFramePermissions`, `majorCapabilities`, `name` (+456 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `feature_importance` connect `Clinical Features` to `PV Loop SHAP`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Frontend Dependencies` to `Documentation and Cluster Profiles`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `SHAP Summary Plot for Escalation Model` (e.g. with `MCS Escalation Risk Model` and `SHAP Explainability Method`) actually correct?**
  _`SHAP Summary Plot for Escalation Model` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `pv_loop_analysis.py — Focused PV Loop analysis for MCS Escalation  This script:`, `Replace NaN/Inf with None for valid JSON serialization.`, `Train PV-loop-only logistic regression for escalation.` to the rest of the system?**
  _508 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Clinical Features` be split into smaller, more focused modules?**
  _Cohesion score 0.0111731843575419 - nodes in this community are weakly interconnected._
- **Should `Documentation and Cluster Profiles` be split into smaller, more focused modules?**
  _Cohesion score 0.09574468085106383 - nodes in this community are weakly interconnected._
- **Should `Clustering Pipeline Core` be split into smaller, more focused modules?**
  _Cohesion score 0.07435897435897436 - nodes in this community are weakly interconnected._