# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a clinical analytics dashboard for Impella hemodynamic recovery data. It is a React + Express full-stack app built with Vite and TypeScript, originally generated from Google AI Studio. The app ingests Excel files containing patient RHC metrics, runs a Python-based ML pipeline for multi-target risk stratification (survival, MCS escalation, RV dysfunction), and visualizes cohort trends with Recharts.

## Commands

- `npm run dev` — Start the development server (runs `tsx server.ts` on port 3001).
- `npm run build` — Build the frontend with Vite and bundle the server with esbuild into `dist/server.cjs`.
- `npm start` — Run the production server from `dist/server.cjs`.
- `npm run lint` — Type-check with `tsc --noEmit`.
- `npm run clean` — Remove the `dist` directory.
- `python scripts/ml_pipeline.py` — Train/retrain the ML models on `Impella_MK.xlsx`.

There are no unit tests or a test runner configured in this project. Run `npx vitest run` after adding tests.

## Architecture

### Full-Stack Vite + Express Monolith

The dev and production servers are the same Express app (`server.ts`). In development, Vite's middleware is mounted inside Express via `middlewareMode: true`. In production, the bundled frontend in `dist/` is served as static files, and `dist/index.html` is the fallback for client-side routing.

### Data Flow

1. **Upload / Sample**: The React frontend (`src/App.tsx`) uploads an `.xlsx` file to `POST /api/analyze` or loads hardcoded sample data from `GET /api/sample`.
2. **Excel Parsing**: `server.ts:processExcelData()` reads the Excel buffer with `xlsx`. The expected layout is **one patient per column**, with metric labels in column 0. It parses all sections: general demographics, pre-implant RHC, 48h post-implant RHC, echo pre/post, labs pre/post, inotropes, diuretics, Impella settings, outcomes, and PV loop data.
3. **ML Prediction**: The server calls `scripts/predict_all.py` via `execFile` (using `PYTHON_PATH` env var) with the full patient data as JSON on stdin. The Python script loads trained scikit-learn models from `ml_output/*.joblib` and returns three risk probabilities:
   - `survival` — mortality risk (RandomForest, AUC ~0.52, limited utility)
   - `escalation` — MCS escalation risk (RandomForest, AUC ~0.86)
   - `rvDysfunction` — RV dysfunction risk (LogisticRegression, AUC ~0.92)
4. **Derived Metrics**: The server also computes `deltaCPO`, `recoveryScore`, and traditional risk flags (`postRA > 20` or `postPAPI < 1.0`).
5. **Knowledge Base Alerts**: `server.ts:checkEscalationAlerts()` matches the patient's `eesEa` against `impella_knowledge_base.json` within a 15% tolerance; if any historical match was escalated, it sets `escalationAlert: true`.
6. **Visualization**: The frontend renders a dark-themed dashboard with summary cards, cohort risk meters, a Recharts bar chart for delta CPO, a scatter plot for risk distribution, and a patient detail modal with hemodynamic trends and ML risk scores.

### Key Files

- `server.ts` — Express server, expanded Excel parser, `runPythonPredictions()` helper, and API endpoints.
- `scripts/predict_all.py` — Standalone Python script called by Node.js at runtime. Loads `ml_output/*.joblib` models and returns JSON predictions.
- `scripts/ml_pipeline.py` — Training pipeline. Ingests `Patient Data` + `Cohort` sheets, engineers 185+ features, trains LogisticRegression and RandomForest models with stratified 5-fold CV, exports joblib artifacts + LR JSON coefficients, generates SHAP plots and `model_report.md`.
- `scripts/analyze_effectiveness.py` — Effectiveness analysis pipeline. Reads `Impella_MK.xlsx`, computes survival, hemodynamic, lab, and ventricular mechanics analyses, exports `public/effectiveness-data.json` and `public/effectiveness-report.html`.
- `scripts/clustering_pipeline.py` — Clustering pipeline for patient phenotype discovery.
- `scripts/mortality_feature_analysis.py` — Feature importance analysis for mortality prediction.
- `src/App.tsx` — Main React component with all UI, chart rendering, and new `RiskMeter` component for ML risk display.
- `src/types.ts` — `PatientData` and `AnalyticsResult` interfaces, including the new `riskScores` field.
- `src/lib/utils.ts` — `cn()` utility wrapping `clsx` + `tailwind-merge`.
- `src/index.css` — Tailwind CSS v4 theme with custom dark palette and scrollbar utilities.
- `vite.config.ts` — Vite config with React, TailwindCSS, `@/` alias mapped to project root.
- `MODEL.md` — Clinical documentation for the ML models, interpretation guide, and limitations.
- `impella_knowledge_base.json` — Static JSON used by the server for historical escalation pattern matching.

### Environment Variables

- `GEMINI_API_KEY` — Required for GoogleGenAI initialization (not actively used in main endpoints).
- `PYTHON_PATH` — Path to the Python executable with `pandas`, `scikit-learn`, `joblib`, `openpyxl` installed. Defaults to `python3`.
- `APP_URL` — Hosting URL (injected by AI Studio at runtime).

Create a `.env.local` file with these values for local development.

## Tech Stack

- React 19, TypeScript 5.8, Vite 6
- Tailwind CSS v4 (with `@tailwindcss/vite` plugin)
- Express 4, Multer (file upload), `xlsx` (Excel parsing)
- `recharts`, `lucide-react`, `motion/react` (frontend charts and UI)
- `ml-random-forest`, `simple-statistics` (legacy server-side ML, still used for baseline comparison)
- Python 3: `pandas`, `scikit-learn`, `joblib`, `openpyxl`, `matplotlib`, `seaborn`, `shap`

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
