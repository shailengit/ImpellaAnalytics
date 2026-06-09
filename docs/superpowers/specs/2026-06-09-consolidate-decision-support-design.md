# Consolidate Decision Support into Patient Detail Panel

**Date:** 2026-06-09
**Status:** Approved for Phase 1 Implementation
**Approach:** Two-phase incremental (Approach A)

---

## 1. Problem Statement

The app currently has two separate views that display overlapping patient-level clinical intelligence:

- **Dashboard → Patient Records click** opens `ActivePatientMonitor` — telemetry header, weaning checklist, escalation flags, simulator, explainable AI, AI memo, and longitudinal sparklines.
- **Decision Support page** (`DecisionSupportPage`) — accessed via top-nav button — shows risk assessment with bootstrap CIs, recovery trajectory, similar-patient outcomes, predicted ΔCPO, trajectory explorer bar chart, and model performance AUCs.

These two views duplicate the same risk scores and present fragmented information. The goal is to merge all unique Decision Support content into `ActivePatientMonitor`, remove `DecisionSupportPage`, and eventually make the bootstrap/trajectory data computable at runtime in pure JavaScript for Vercel deployment.

---

## 2. Goals

1. **Eliminate duplication:** Patient-level risk scores, weaning scores, and escalation flags appear only in one place.
2. **Preserve unique content:** Bootstrap CIs, similar-patient statistics, trajectory explorer, and model AUCs migrate into the unified panel.
3. **Add clinical interpretation help:** Every section gets an ℹ tooltip. A collapsible "How to Read These Numbers" guide explains probability, AUC, and 95% CI in plain clinical language.
4. **Vercel-ready path:** Phase 1 attaches pre-computed static data. Phase 2 ports the bootstrap/trajectory engine to JS so the app is fully Python-free at runtime.
5. **Keep training pipeline intact:** Local `scripts/ml_pipeline.py`, `generate_decision_support.py`, etc. continue running as-is. Only runtime serving changes.

---

## 3. Non-Goals

- Do NOT retrain models or change model architecture.
- Do NOT remove Python training scripts.
- Do NOT add new ML model targets (e.g., AKI risk, length-of-stay).
- Do NOT redesign the dashboard cohort view (top cards, charts, patient list sidebar).

---

## 4. Phase 1 — UI Consolidation + Static Data Attachment

### 4.1 Data Model Changes

Extend `PatientData` in `src/types.ts` with three new optional fields:

```typescript
// NEW: Bootstrap confidence intervals (from decision_support_bootstrap.json)
bootstrapCI?: {
  survival: {
    prediction_mean: number;
    ci_lower: number | null;
    ci_upper: number | null;
  };
  escalation: {
    prediction_mean: number;
    ci_lower: number | null;
    ci_upper: number | null;
  };
  rv_dysfunction: {
    prediction_mean: number;
    ci_lower: number | null;
    ci_upper: number | null;
  };
};

// NEW: Trajectory / similar-patient data (from patient_trajectories.json)
trajectoryData?: {
  cluster_id: number | null;
  cluster_name: string | null;
  matches: number;
  n_valid: number;
  delta_cpo_mean: number | null;
  delta_cpo_ci_lower: number | null;
  delta_cpo_ci_upper: number | null;
  delta_papi_mean: number | null;
  delta_papi_ci_lower: number | null;
  delta_papi_ci_upper: number | null;
  delta_lactate_mean: number | null;
  delta_lactate_ci_lower: number | null;
  delta_lactate_ci_upper: number | null;
  escalation_rate: number | null;
  survival_rate: number | null;
};

// NEW: Global model performance metrics (from decision_support_bootstrap.json)
modelPerformance?: {
  survival: { global_auc_mean: number; global_auc_ci_lower: number; global_auc_ci_upper: number; n_bootstrap: number; };
  escalation: { global_auc_mean: number; global_auc_ci_lower: number; global_auc_ci_upper: number; n_bootstrap: number; };
  rv_dysfunction: { global_auc_mean: number; global_auc_ci_lower: number; global_auc_ci_upper: number; n_bootstrap: number; };
};
```

### 4.2 Backend Changes

In `server.ts`, modify `POST /api/analyze` and `GET /api/sample` to attach pre-computed decision support data:

1. After `processExcelData()` and before `calculateChecklistAndDrivers()`, load `ml_output/decision_support_bootstrap.json` and `ml_output/patient_trajectories.json`.
2. For each patient, match by `patientId` (or `id`).
3. Attach matched `bootstrapCI`, `trajectoryData`, and `modelPerformance` to the `PatientData` object.
4. If no match found → fields remain `undefined`. UI handles missing data gracefully (shows "N/A" or hides sections).

The `modelPerformance` object is the same for all patients (global metrics), so it only needs to be read once per request.

### 4.3 UI Changes — ActivePatientMonitor

Insert a new **Decision Support** section into the left column (`lg:col-span-8`), positioned **below the Simulator** and **above the Longitudinal Telemetry**.

#### Section Layout

```
┌─ Decision Support (blue-bordered card) ──────────────┐
│  Header: "📊 Decision Support (NEW)" + ℹ help button │
│  ───────────────────────────────────────────────────  │
│  "How to Read These Numbers" collapsible guide        │
│  ───────────────────────────────────────────────────  │
│  ┌─ Risk Assessment ─┐ ┌─ Recovery ─┐ ┌─ Alerts ─┐   │
│  │ Mortality 28%     │ │ Weaning    │ │ Weaning  │   │
│  │ CI: 18%–38%       │ │ Score 75   │ │ Candidate│   │
│  │ Escalation 15%    │ │ Similar pt │ │ Watch    │   │
│  │ CI: 8%–25%        │ │ outcomes   │ │ flags    │   │
│  │ RV 35%            │ │ Pred ΔCPO  │ │ Model    │   │
│  │ CI: 24%–48%       │ │ +0.18      │ │ AUCs     │   │
│  └───────────────────┘ └────────────┘ └──────────┘   │
│  ───────────────────────────────────────────────────  │
│  Trajectory Explorer (bar chart + dropdowns)          │
│  [This Patient ■■■■] [42 Similar ■■■]                 │
│  metric: CPO | group: All patients                    │
└──────────────────────────────────────────────────────┘
```

#### Help Tooltips (ℹ) on every section header

| Section | Tooltip Text |
|---------|-------------|
| Weaning Readiness | "Five bedside criteria scored continuously. Score ≥ 60 = weaning candidate. ML risks auto-penalize score." |
| Escalation Danger Flags | "Warnings triggered by post-implant thresholds. Any ALERT = heightened surveillance." |
| Bedside Simulator | "Virtually adjust parameters and see recalculated ML risks in real time." |
| Risk Assessment | "Risk probabilities with 95% bootstrap confidence intervals. Narrow CI = higher confidence." |
| Recovery Trajectory | "Predicted changes based on similar patients in the cohort." |
| Decision Support | "Actionable alerts and model validation metrics." |
| Trajectory Explorer | "Compare this patient's predicted trajectory against similar patients or the full cohort." |
| Longitudinal Telemetry | "Compare pre- and post-implant measurements. Green = improving, red = declining." |
| Explainable AI | "Shows which clinical measurements most influenced each ML risk score for this patient." |
| Model Performance | "AUC = discriminative ability. Higher = better. CI reflects confidence in the AUC estimate." |

#### "How to Read These Numbers" Guide (collapsible)

Rendered as a `motion.div` with `AnimatePresence`. Content:

- **Probability** — "The model's best estimate that this specific patient will experience that outcome. It is not a guarantee — it is a weighted forecast based on patterns in historical patients with similar measurements. Treat it as a weather forecast."
- **AUC** — "How well the model discriminates between patients who did and did not experience the outcome. 0.50 = coin flip. 0.70–0.80 = fair. 0.80–0.90 = good. >0.90 = excellent."
- **95% CI** — "If we could re-run the model on 100 different but similar cohorts, the probability would fall in this range 95 times. Narrow CI = more confident. Wide CI = high uncertainty — rely more on bedside judgment."
- **Bedside usage** — "Combine with your clinical gestalt, trending labs, and hemodynamics. A low score is reassuring but not a guarantee."

### 4.4 App.tsx Navigation Changes

- Remove the `"decision"` page from `activePage` union type.
- Remove the `Decision Support` top-nav button.
- Remove the `DecisionSupportPage` import and render branch.
- Delete `src/components/DecisionSupportPage.tsx`.

### 4.5 Files to Modify

| File | Change |
|------|--------|
| `src/types.ts` | Add `bootstrapCI`, `trajectoryData`, `modelPerformance` to `PatientData` |
| `server.ts` | Load and attach JSON data in `/api/analyze` and `/api/sample` |
| `src/components/ActivePatientMonitor.tsx` | Insert Decision Support section with help buttons and collapsible guide |
| `src/App.tsx` | Remove Decision Support navigation and page |
| `src/components/DecisionSupportPage.tsx` | **Delete** |

---

## 5. Phase 2 — Runtime JS Bootstrap & Trajectory Engine

### 5.1 New Module: `src/ml-models/decision-support.ts`

Pure JS/TS functions (no dependencies beyond `simple-statistics` if needed):

- `computeBootstrapCI(predictions: number[], nBootstrap = 1000, confidence = 0.95): { mean: number; ciLower: number; ciUpper: number }`
  - Uses percentile bootstrap: resample with replacement, compute statistic per sample, take percentiles.
- `findSimilarPatients(patient: PatientData, cohort: PatientData[], k = 5, features = ['preRA','prePCWP','preCPO','prePAPI','age','scai']): PatientData[]`
  - Euclidean distance on normalized features. Returns top-k most similar patients.
- `computeTrajectoryMetrics(similarPatients: PatientData[]): TrajectoryData`
  - Computes mean ΔCPO, ΔPAPI, ΔLactate with bootstrap CIs. Also computes escalation_rate and survival_rate from similar patients' outcomes.

### 5.2 Backend Integration

- In `server.ts`, after `predictFromJsModels()` returns risk scores, call the new JS functions to compute per-patient bootstrap CIs and trajectory metrics.
- Replace the static JSON attachment with live computation.
- Keep the static JSON as a **fallback** if computation fails (e.g., cohort too small).

### 5.3 Runtime Python Elimination

- Replace `runPythonPredictions` with `predictFromJsModels` in all three endpoints: `/api/analyze`, `/api/sample`, `/api/simulate`.
- Remove `PYTHON_PATH` dependency from server.
- Python scripts remain for local training only.

### 5.4 Testing Strategy

- **Vitest unit tests** in `src/ml-models/__tests__/decision-support.test.ts`:
  - Compare JS bootstrap CI outputs against existing `decision_support_bootstrap.json` for the same patients — target ±0.01 numerical parity.
  - Compare JS `findSimilarPatients` against existing `patient_trajectories.json` match counts.
  - Test edge cases: empty cohort, single patient, missing features.
- **Integration test:** Upload sample data, verify all three new fields are present in the response and render correctly in the UI.

---

## 6. Data Flow (Phase 1)

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Excel Upload   │────▶│  server.ts       │────▶│  processExcel()  │
│  or Sample      │     │  /api/analyze    │     │                  │
└─────────────────┘     └──────────────────┘     └──────────────────┘
                                                          │
                       ┌──────────────────┐              ▼
                       │  JSON files:     │     ┌──────────────────┐
                       │  bootstrap.json  │────▶│  Attach matched  │
                       │  trajectories.json│    │  data per patient│
                       └──────────────────┘     └──────────────────┘
                                                          │
                       ┌──────────────────┐              ▼
                       │  predictFromJs │     ┌──────────────────┐
                       │  Models (future)│────▶│  calculateCheck  │
                       └──────────────────┘    │  listAndDrivers  │
                                                └──────────────────┘
                                                          │
                                                          ▼
                                                ┌──────────────────┐
                                                │  Response JSON   │
                                                │  { patients: [   │
                                                │    { ...PatientData,
                                                │      bootstrapCI,
                                                │      trajectoryData,
                                                │      modelPerformance }
                                                │  ] }
                                                └──────────────────┘
                                                          │
                                                          ▼
                                                ┌──────────────────┐
                                                │  ActivePatient   │
                                                │  Monitor         │
                                                │  (renders all)   │
                                                └──────────────────┘
```

---

## 7. Error Handling

| Scenario | Behavior |
|----------|----------|
| Static JSON files missing | Log warning. Patients render without Decision Support section (fields undefined). |
| Patient not found in JSON | That patient's Decision Support fields are undefined. UI shows "N/A". |
| Bootstrap CI computation fails (Phase 2) | Fallback to static JSON if available; else hide CI and show point estimate only. |
| Similar-patient search returns < 3 matches | Still compute means, but widen CI and show "Limited similar data" warning. |

---

## 8. UI States

| State | Visual |
|-------|--------|
| Data available | Full Decision Support section rendered with bars, badges, chart |
| Data missing (N/A) | Section renders with "—" placeholders and muted text |
| CI wide (>20pp) | Amber border on CI text + tooltip: "High uncertainty — use clinical judgment" |
| Weaning candidate | Green badge ✓ |
| Escalation/RV watch | Amber warning card with specific risk % |

---

## 9. Open Questions (resolved)

1. **Vercel Python availability?** Confirmed: Phase 2 eliminates Python at runtime entirely. Training stays local.
2. **Option A vs B vs C?** Resolved: Approach A (two-phase incremental).
3. **Help text for non-data-scientist clinicians?** Resolved: Collapsible guide with analogies (weather forecast, test accuracy scale).
4. **What happens for new patients not in training cohort?** Phase 1: N/A. Phase 2: JS computes live.

---

## 10. Success Criteria

- [ ] `DecisionSupportPage.tsx` is deleted and no longer importable.
- [ ] `ActivePatientMonitor` shows all unique Decision Support content without duplication.
- [ ] Every section has an ℹ help tooltip.
- [ ] Collapsible "How to Read These Numbers" guide is present and toggleable.
- [ ] Existing patients (from training cohort) show bootstrap CIs, trajectory data, and model AUCs.
- [ ] Dashboard Patient Records click → unified panel. No second page needed.
- [ ] `npm run lint` passes (TypeScript compiles cleanly).
- [ ] `npm run dev` starts and sample data loads with full Decision Support section visible.

---

## 11. Future Work (Phase 2)

- Port `computeBootstrapCI`, `findSimilarPatients`, `computeTrajectoryMetrics` to `src/ml-models/decision-support.ts`.
- Replace static JSON attachment with live JS computation.
- Swap `runPythonPredictions` → `predictFromJsModels` in all endpoints.
- Add vitest unit tests with ±0.01 parity against Python-generated JSON.
- Deploy to Vercel with zero Python runtime dependency.
