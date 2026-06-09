# Unified Decision Support Page — Design Spec

## Context

The Impella analytics dashboard has 5 separate pages (Dashboard, PV Loop, Mortality Features, Patient Phenotypes, Effectiveness) each showing isolated aspects of patient data. A cardiologist managing a cardiogenic shock patient must mentally synthesize across pages. This spec adds a 6th page that brings everything together into a single clinical decision flow, adding confidence intervals and trajectory matching that don't exist today.

## New Components

### 1. Decision Support Page (`src/components/DecisionSupportPage.tsx`) — NEW

A new full-page component following the patterns of `PVLoopPage.tsx` and `ClusteringPage.tsx`. Loaded as a new tab in the navigation alongside existing pages.

**Layout** (matches the approved visual mockup):

```
┌──────────────────────────────────────────────────────────────┐
│  Patient Header: Name · Phenotype · SCAI · Days on Support  │
├─────────────────┬──────────────────┬─────────────────────────┤
│  Risk Assessment │ Recovery Status  │  Decision Support       │
│                  │                  │                         │
│  ┌─────────┐    │  ┌─────────┐    │  ┌─────────────────┐    │
│  │Mortality│    │  │Weaning  │    │  │Weaning Candidate │    │
│  │  35%    │    │  │ 75/100  │    │  │  ✓  Score ≥60   │    │
│  │ CI:     │    │  │         │    │  └─────────────────┘    │
│  │15-55%   │    │  ├─────────┤    │  ┌─────────────────┐    │
│  ├─────────┤    │  │Similar  │    │  │⚠ Watch: Esc     │    │
│  │Escalation│    │  │Pts Out- │    │  │  Risk 72%       │    │
│  │  72%    │    │  │comes    │    │  └─────────────────┘    │
│  │ CI:     │    │  │ 65% rec │    │  ┌─────────────────┐    │
│  │55-86%   │    │  │ 15% esc │    │  │Top-3 Drivers    │    │
│  ├─────────┤    │  │ 20% prol│    │  │⬆ Lactate 3.2   │    │
│  │RVDysf   │    │  ├─────────┤    │  │⬇ PAPI 1.2      │    │
│  │  18%    │    │  │Predicted│    │  │⬆ VIS 18        │    │
│  │ CI:     │    │  │ΔCPO     │    │  └─────────────────┘    │
│  │5-38%    │    │  │+0.21    │    │                         │
│  └─────────┘    │  │CI:-0.05 │    │                         │
│  AUC badges     │  │to +0.47 │    │                         │
├─────────────────┴──────────────────┴─────────────────────────┤
│  Trajectory Explorer                                          │
│  ┌─ Metric selector ──┬─ Comparison group ──┐               │
│  │  [CPO ▼]           │  [Same Cluster ▼]   │               │
│  └────────────────────┴──────────────────────┘               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Bar chart: This Patient vs Similar Patients           │ │
│  │  Pre vs Post with 95% CI band                         │ │
│  └────────────────────────────────────────────────────────┘ │
│  Interpretation text (plain language)                       │
└──────────────────────────────────────────────────────────────┘
```

### 2. Decision Support Backend (`scripts/generate_decision_support.py`) — NEW

Python script that generates the supporting JSON data. Runs after `ml_pipeline.py`.

**Bootstrap Confidence Intervals:**
- Load the trained LR model for each target (survival, escalation, rv_dysfunction)
- Bootstrap resample the training data 500 times
- Each iteration: train LR, predict on all patients
- Store patient-specific prediction distributions
- Compute 2.5th and 97.5th percentiles per patient per model
- Export to `ml_output/decision_support_bootstrap.json`

**Trajectory Matching:**
- For each patient in the dataset, find top-20 most similar patients (by pre-implant features only: CPO, PAPI, lactate, RA, eGFR, age)
- Use cosine distance on standardized features
- Report distribution of: delta CPO, survival rate, escalation rate among matches
- Export to `ml_output/patient_trajectories.json`

### 3. Data Schema — NEW

**`ml_output/decision_support_bootstrap.json` — Bootstrap CI data:**
```json
{
  "model": "LogisticRegression",
  "target": "survival",
  "n_bootstrap": 500,
  "patients": [
    {
      "patientId": "...",
      "prediction_mean": 0.35,
      "ci_lower": 0.15,
      "ci_upper": 0.55,
      "bootstrap_samples": [0.32, 0.38, ...]
    }
  ],
  "global_ci_width": 0.08
}
```

**`ml_output/patient_trajectories.json` — Trajectory matching:**
```json
{
  "patients": [
    {
      "patientId": "...",
      "matches": 22,
      "delta_cpo_mean": 0.21,
      "delta_cpo_ci_lower": -0.05,
      "delta_cpo_ci_upper": 0.47,
      "survival_rate": 0.65,
      "escalation_rate": 0.15,
      "prolonged_rate": 0.20
    }
  ]
}
```

## Data Flow

```
ml_pipeline.py ──→ model_{target}.joblib
                        │
generate_decision_support.py
  ├── Loads .joblib models
  ├── Bootstrap resample → decision_support_bootstrap.json
  └── k-NN matching → patient_trajectories.json

Dev server serves static JSON from ml_output/
Frontend fetches at:
  GET /ml_output/decision_support_bootstrap.json
  GET /ml_output/patient_trajectories.json
```

## Implementation Plan

### Phase A: Python Backend

1. Create `scripts/generate_decision_support.py`:
   - Load existing models + data
   - Bootstrap CI computation (500 iterations per target)
   - k-NN trajectory matching
   - JSON export

### Phase B: React Component

2. Create `src/components/DecisionSupportPage.tsx`:
   - Three-column layout matching the mockup
   - Fetch bootstrap + trajectory JSON on mount
   - Risk meter bars with CI overlay (thin horizontal line showing the range)
   - Similar patient outcomes table
   - Decision support section (weaning status, watch flags, top-3 drivers)
   - Trajectory explorer with chart and interpretation text

### Phase C: Integration

3. Edit `src/App.tsx`:
   - Add "Decision Support" to the tab navigation
   - Conditionally render the new page

## Files to Create
- `scripts/generate_decision_support.py`
- `src/components/DecisionSupportPage.tsx`

## Files to Modify
- `src/App.tsx` — add tab + routing

## Verification

1. Run `python3 scripts/generate_decision_support.py` — should produce two JSON files in `ml_output/`
2. `npm run dev` — new "Decision Support" tab should appear in navigation
3. Click through — page should load with real data, confidence intervals, and trajectory matches
4. Existing pages (Dashboard, PV Loop, etc.) must remain unchanged