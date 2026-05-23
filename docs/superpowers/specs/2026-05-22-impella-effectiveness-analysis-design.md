# Impella Effectiveness Analysis — Design Spec

**Date:** 2026-05-22
**Status:** Approved Design

## Overview

Analyze Impella hemodynamic support effectiveness across 67 patients (112 in cohort) using clinical data from Impella_MK.xlsx. Deliver two complementary outputs: an interactive dashboard page within the existing React app, and a deep-analysis static HTML report. Both are driven by a single Python analysis script.

## Deliverables

### 1. Interactive Dashboard Page

New `EffectivenessDashboard.tsx` component with six scrollable analysis panels, integrated into the existing React + Recharts dark-themed app.

**Data flow:**
- `analyze_effectiveness.py` reads Impella_MK.xlsx, computes all statistical analyses, exports structured JSON to `public/effectiveness-data.json`
- Python also generates `public/effectiveness-report.html` (static deep-analysis report)
- Express endpoint `GET /api/effectiveness` serves the JSON to the dashboard
- Dashboard component fetches data on mount via this endpoint

**Page structure:**
- **Header:** Title + summary stat cards (N=67, mortality rate, responder rate, avg CPO delta)
- **Global Filters Bar:** Indication dropdown (cardiomyopathy, AMI/CGS, HTx Rejection, PCCS), Outcome toggle (all/survived/expired)
- **Section 1 — Survival & Outcomes:** Grouped Recharts BarChart showing survival by indication. Click on a bar to filter the rest of the page.
- **Section 2 — Hemodynamic Response:** Delta CPO bar chart (survived vs expired with error bars). Scatter plot of CPO vs TDCO change colored by outcome. Metric toggle to switch between CPO, TDCO, RV-CPO, PCWP, MAP.
- **Section 3 — Lab Recovery:** Pre/post grouped bar charts for lactate, eGFR, creatinine, HCO3, AST, hemoglobin. Split by outcome group.
- **Section 4 — Responder Profile:** Radar chart comparing responder vs non-responder baseline characteristics. Table of key differentiators with p-values.
- **Section 5 — Ventricular Mechanics:** Pre/post changes in Ees/Ea coupling ratio, ESP, EDP. Split by outcome group.
- **Section 6 — ML Cross-Reference:** Top consensus features mapped to clinical mechanisms. Side-by-side with observed data.

**Navigation:**
- Add `"effectiveness"` to `activePage` state union type in App.tsx
- Add navigation button in header with distinct styling
- Route to `EffectivenessDashboard` component when active

### 2. Python-Generated HTML Report

Self-contained report at `public/effectiveness-report.html` with publication-quality matplotlib/seaborn charts and narrative analysis.

**Report sections:**
1. Executive Summary
2. Data Overview & Patient Population
3. Survival Analysis (indication-stratified, demographic factors)
4. Hemodynamic Response (pre/post delta, Mann-Whitney U tests)
5. Organ Function Recovery (lactate clearance, renal, hemolysis)
6. Responder vs Non-Responder Characterization
7. Ventricular Mechanics (Ees/Ea coupling)
8. ML Model Cross-Reference
9. Limitations & Caveats
10. Appendix: Methodology

### 3. Python Analysis Script

Single script `analyze_effectiveness.py` that:

- Reads Impella_MK.xlsx (Patient Data + Cohort sheets)
- Computes all statistical analyses across the 6 analysis dimensions
- Exports `public/effectiveness-data.json` with:
  - survivalStats: mortality by indication, demographic breakdown
  - hemodynamicDeltas: pre/post changes per patient with outcome labels
  - labRecovery: pre/post lab values by outcome
  - responderProfiles: responder vs non-responder comparison data (responder defined as CPO↑ AND lactate↓ AND survived)
  - ventricularMechanics: PV loop metrics pre/post by outcome
  - mlFeatures: top consensus features with clinical mappings
  - statisticalTests: Mann-Whitney U and other test results
- Generates `public/effectiveness-report.html` with inline charts and narrative

## Data Architecture

```
Impella_MK.xlsx
      │
      ▼
analyze_effectiveness.py
      │
      ├──────────────────┐
      ▼                  ▼
effectiveness-data.json  effectiveness-report.html
      │
      ▼
GET /api/effectiveness
      │
      ▼
EffectivenessDashboard.tsx
(6 panels, Recharts, dark theme)
```

## Implementation Sequence

1. **Write `analyze_effectiveness.py`** — full computation and JSON export. Run to validate output.
2. **Generate HTML report** — add report generation to the same script. Run and inspect output.
3. **Add Express endpoint** — `GET /api/effectiveness` serving the JSON file.
4. **Build `EffectivenessDashboard.tsx`** — all 6 panels with Recharts, filters, dark theme.
5. **Wire up routing** — add to App.tsx navigation and page routing.
6. **Test end-to-end** — run Python script, start dev server, verify dashboard loads and report opens.

## Files to Modify/Create

- `analyze_effectiveness.py` (CREATE) — main analysis script
- `public/effectiveness-data.json` (CREATE, auto-generated) — analysis data
- `public/effectiveness-report.html` (CREATE, auto-generated) — static report
- `server.ts` (MODIFY) — add GET /api/effectiveness endpoint
- `src/components/EffectivenessDashboard.tsx` (CREATE) — dashboard component
- `src/App.tsx` (MODIFY) — add routing and navigation

## Verification

1. Run `python3 analyze_effectiveness.py` — verify no errors, check JSON output
2. Open `public/effectiveness-report.html` in browser — verify all sections render
3. `npm run dev` — start the dev server
4. Navigate to Effectiveness page — verify all 6 panels load with data
5. Test indication filter — verify data updates across panels
6. Test outcome toggle — verify survived/expired filtering works
7. Verify no console errors and dark theme consistency
