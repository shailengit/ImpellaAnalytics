# Consolidate Decision Support into Patient Detail Panel — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge all unique Decision Support content into `ActivePatientMonitor`, remove `DecisionSupportPage`, and attach pre-computed JSON data to patient responses — producing a single, unified patient detail panel.

**Architecture:** Extend `PatientData` with three new fields (`bootstrapCI`, `trajectoryData`, `modelPerformance`). In `server.ts`, load static JSON files after Excel parsing and attach matched per-patient data. Create a new sub-component `PatientDecisionSupport.tsx` that renders risk bars with CIs, recovery trajectory, decision alerts, and the trajectory explorer. Integrate it into `ActivePatientMonitor` below the Simulator. Add ℹ tooltips to all sections and a collapsible clinician interpretation guide.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS v4, Express 4, Recharts

---

## File Structure

| File | Responsibility |
|------|-------------|
| `src/types.ts` | Extended `PatientData` interface with new optional fields |
| `server.ts` | JSON loading helper + attachment in `/api/analyze` and `/api/sample` |
| `src/components/PatientDecisionSupport.tsx` | **NEW** — Risk assessment, recovery trajectory, decision alerts, trajectory explorer, and "How to Read These Numbers" guide |
| `src/components/ActivePatientMonitor.tsx` | Integrate `PatientDecisionSupport` below Simulator; add ℹ tooltips to existing sections |
| `src/components/InfoTip.tsx` | **Verify** — already exists, used for inline help text |
| `src/App.tsx` | Remove Decision Support nav button and page branch |
| `src/components/DecisionSupportPage.tsx` | **DELETE** |

---

## Context You Need

### Static JSON Structures

**`ml_output/decision_support_bootstrap.json`** (already exists from Python pipeline):
```json
{
  "survival": {
    "patients": [{ "patientId": "...", "prediction_mean": 0.28, "ci_lower": 0.18, "ci_upper": 0.38 }],
    "global_auc_mean": 0.889, "global_auc_ci_lower": 0.85, "global_auc_ci_upper": 0.92,
    "n_bootstrap": 1000, "confidence_level": 0.95
  },
  "escalation": { /* same shape */ },
  "rv_dysfunction": { /* same shape */ }
}
```

**`ml_output/patient_trajectories.json`** (already exists):
```json
{
  "patients": [{
    "patientId": "...", "name": "...", "matches": 42, "n_valid": 40,
    "delta_cpo_mean": 0.18, "delta_cpo_ci_lower": 0.05, "delta_cpo_ci_upper": 0.31,
    "delta_papi_mean": null, "delta_papi_ci_lower": null, "delta_papi_ci_upper": null,
    "delta_lactate_mean": -0.4, "delta_lactate_ci_lower": -0.8, "delta_lactate_ci_upper": -0.1,
    "escalation_rate": 0.15, "survival_rate": 0.85,
    "cluster_id": 1, "cluster_name": "Rapid Recovery"
  }],
  "method": "knn", "k": 5, "features": ["preRA","prePCWP",...]
}
```

### Existing UI Patterns

- **InfoTip component** (`src/components/InfoTip.tsx`): Wraps children in an inline tooltip. Usage: `<InfoTip>Tooltip text here</InfoTip>`. Already imported in `DashboardPage.tsx` and `ActivePatientMonitor.tsx`.
- **Section cards**: `bg-dark-card border border-dark-border rounded-xl p-6 shadow-2xl`
- **Sub-cards**: `bg-dark-accent/40 rounded-lg border border-dark-border p-3.5`
- **Risk bars**: Gradient-filled divs with percentage labels
- **Dropdowns**: `<select className="bg-dark-bg border border-dark-border text-dark-text-primary rounded px-3 py-1.5 text-xs">`
- **Bar charts**: Recharts `BarChart` with `ResponsiveContainer`

---

## Task 1: Extend PatientData Types

**Files:**
- Modify: `src/types.ts:140-165`

**Goal:** Add `bootstrapCI`, `trajectoryData`, and `modelPerformance` to `PatientData`.

- [ ] **Step 1: Add new interfaces and fields**

Insert the following types and fields into `src/types.ts`, immediately after the `aiClinicalSummary` field in `PatientData`:

```typescript
// NEW: Bootstrap confidence intervals (from decision_support_bootstrap.json)
export interface BootstrapTargetCI {
  prediction_mean: number;
  ci_lower: number | null;
  ci_upper: number | null;
}

export interface PatientBootstrapCI {
  survival: BootstrapTargetCI;
  escalation: BootstrapTargetCI;
  rv_dysfunction: BootstrapTargetCI;
}

export interface TrajectoryData {
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
}

export interface ModelPerformanceMetrics {
  global_auc_mean: number;
  global_auc_ci_lower: number;
  global_auc_ci_upper: number;
  n_bootstrap: number;
}

export interface PatientModelPerformance {
  survival: ModelPerformanceMetrics;
  escalation: ModelPerformanceMetrics;
  rv_dysfunction: ModelPerformanceMetrics;
}
```

Then add the three new optional fields to `PatientData` (after `aiClinicalSummary?: string;`):

```typescript
  // ML Decision Support (pre-computed from static JSON)
  bootstrapCI?: PatientBootstrapCI;
  trajectoryData?: TrajectoryData;
  modelPerformance?: PatientModelPerformance;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run lint`
Expected: No errors in `src/types.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "types: add bootstrapCI, trajectoryData, modelPerformance to PatientData

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Server-Side JSON Loading Helper

**Files:**
- Modify: `server.ts:1-15` (imports)
- Modify: `server.ts:148-290` (new helper functions before `startServer`)

**Goal:** Create a helper that loads `decision_support_bootstrap.json` and `patient_trajectories.json`, builds lookup maps by `patientId`, and returns a function to attach data to a patient.

- [ ] **Step 1: Add fs import if missing**

Verify `import * as fs from "fs";` is present at the top of `server.ts`. It is already there (line 7).

- [ ] **Step 2: Write the helper functions**

Insert the following code into `server.ts`, immediately before `async function startServer()` (around line 289):

```typescript
// ---------------------------------------------------------------------------
// Decision Support Data Attachment (Phase 1: static JSON)
// ---------------------------------------------------------------------------

interface BootstrapPatient {
  patientId: string;
  prediction_mean: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
}

interface BootstrapTargetData {
  patients: BootstrapPatient[];
  global_auc_mean: number;
  global_auc_ci_lower: number;
  global_auc_ci_upper: number;
  n_bootstrap: number;
  confidence_level: number;
}

interface BootstrapData {
  survival: BootstrapTargetData;
  escalation: BootstrapTargetData;
  rv_dysfunction: BootstrapTargetData;
}

interface TrajectoryPatient {
  patientId: string;
  name: string;
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
  cluster_id: number | null;
  cluster_name: string | null;
}

interface TrajectoryDataRaw {
  patients: TrajectoryPatient[];
  method: string;
  k: number;
  features: string[];
}

function loadDecisionSupportData(): {
  bootstrap: BootstrapData | null;
  trajectory: TrajectoryDataRaw | null;
} {
  try {
    const bootstrapPath = path.join(process.cwd(), "ml_output/decision_support_bootstrap.json");
    const trajectoryPath = path.join(process.cwd(), "ml_output/patient_trajectories.json");
    const bootstrap: BootstrapData = fs.existsSync(bootstrapPath)
      ? JSON.parse(fs.readFileSync(bootstrapPath, "utf8"))
      : null;
    const trajectory: TrajectoryDataRaw = fs.existsSync(trajectoryPath)
      ? JSON.parse(fs.readFileSync(trajectoryPath, "utf8"))
      : null;
    return { bootstrap, trajectory };
  } catch (err) {
    console.warn("Failed to load decision support JSON files:", err);
    return { bootstrap: null, trajectory: null };
  }
}

function attachDecisionSupportData(
  patients: PatientData[],
  bootstrap: BootstrapData | null,
  trajectory: TrajectoryDataRaw | null,
): PatientData[] {
  if (!bootstrap && !trajectory) return patients;

  // Build lookup maps
  const bootstrapMaps: Record<string, Map<string, BootstrapPatient>> = {};
  if (bootstrap) {
    for (const target of ["survival", "escalation", "rv_dysfunction"] as const) {
      const m = new Map<string, BootstrapPatient>();
      for (const p of bootstrap[target].patients) {
        m.set(p.patientId, p);
      }
      bootstrapMaps[target] = m;
    }
  }

  const trajMap = new Map<string, TrajectoryPatient>();
  if (trajectory) {
    for (const p of trajectory.patients) {
      trajMap.set(p.patientId, p);
    }
  }

  // Global model performance (same for all patients)
  let modelPerf: any = undefined;
  if (bootstrap) {
    modelPerf = {
      survival: {
        global_auc_mean: bootstrap.survival.global_auc_mean,
        global_auc_ci_lower: bootstrap.survival.global_auc_ci_lower,
        global_auc_ci_upper: bootstrap.survival.global_auc_ci_upper,
        n_bootstrap: bootstrap.survival.n_bootstrap,
      },
      escalation: {
        global_auc_mean: bootstrap.escalation.global_auc_mean,
        global_auc_ci_lower: bootstrap.escalation.global_auc_ci_lower,
        global_auc_ci_upper: bootstrap.escalation.global_auc_ci_upper,
        n_bootstrap: bootstrap.escalation.n_bootstrap,
      },
      rv_dysfunction: {
        global_auc_mean: bootstrap.rv_dysfunction.global_auc_mean,
        global_auc_ci_lower: bootstrap.rv_dysfunction.global_auc_ci_lower,
        global_auc_ci_upper: bootstrap.rv_dysfunction.global_auc_ci_upper,
        n_bootstrap: bootstrap.rv_dysfunction.n_bootstrap,
      },
    };
  }

  return patients.map((p) => {
    const pid = p.id;

    // Build bootstrapCI
    let bootstrapCI: any = undefined;
    if (bootstrap) {
      const surv = bootstrapMaps["survival"].get(pid);
      const esc = bootstrapMaps["escalation"].get(pid);
      const rv = bootstrapMaps["rv_dysfunction"].get(pid);
      if (surv || esc || rv) {
        bootstrapCI = {
          survival: surv
            ? { prediction_mean: surv.prediction_mean ?? 0, ci_lower: surv.ci_lower, ci_upper: surv.ci_upper }
            : { prediction_mean: 0, ci_lower: null, ci_upper: null },
          escalation: esc
            ? { prediction_mean: esc.prediction_mean ?? 0, ci_lower: esc.ci_lower, ci_upper: esc.ci_upper }
            : { prediction_mean: 0, ci_lower: null, ci_upper: null },
          rv_dysfunction: rv
            ? { prediction_mean: rv.prediction_mean ?? 0, ci_lower: rv.ci_lower, ci_upper: rv.ci_upper }
            : { prediction_mean: 0, ci_lower: null, ci_upper: null },
        };
      }
    }

    // Build trajectoryData
    let trajectoryData: any = undefined;
    const traj = trajMap.get(pid);
    if (traj) {
      trajectoryData = {
        cluster_id: traj.cluster_id,
        cluster_name: traj.cluster_name,
        matches: traj.matches,
        n_valid: traj.n_valid,
        delta_cpo_mean: traj.delta_cpo_mean,
        delta_cpo_ci_lower: traj.delta_cpo_ci_lower,
        delta_cpo_ci_upper: traj.delta_cpo_ci_upper,
        delta_papi_mean: traj.delta_papi_mean,
        delta_papi_ci_lower: traj.delta_papi_ci_lower,
        delta_papi_ci_upper: traj.delta_papi_ci_upper,
        delta_lactate_mean: traj.delta_lactate_mean,
        delta_lactate_ci_lower: traj.delta_lactate_ci_lower,
        delta_lactate_ci_upper: traj.delta_lactate_ci_upper,
        escalation_rate: traj.escalation_rate,
        survival_rate: traj.survival_rate,
      };
    }

    return {
      ...p,
      ...(bootstrapCI ? { bootstrapCI } : {}),
      ...(trajectoryData ? { trajectoryData } : {}),
      ...(modelPerf ? { modelPerformance: modelPerf } : {}),
    };
  });
}
```

- [ ] **Step 3: Verify no syntax errors**

Run: `npx tsc --noEmit server.ts`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add server.ts
git commit -m "server: add decision support JSON loading helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Update /api/analyze Endpoint

**Files:**
- Modify: `server.ts:462-494`

**Goal:** Load JSON data after Excel parsing and attach to patients before ML predictions.

- [ ] **Step 1: Modify /api/analyze**

Replace the existing `/api/analyze` handler with:

```typescript
  app.post("/api/analyze", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      let patients = processExcelData(req.file.buffer);
      if (patients.length === 0) {
        return res
          .status(400)
          .json({
            error:
              "No valid patient data found in the Excel file. please ensure metrics are in rows and patients in columns.",
          });
      }

      // Load and attach pre-computed decision support data (Phase 1)
      const { bootstrap, trajectory } = loadDecisionSupportData();
      patients = attachDecisionSupportData(patients, bootstrap, trajectory);

      patients = checkEscalationAlerts(patients);
      const mlResult = await runPythonPredictions(patients);
      patients = mlResult.patients.map(calculateChecklistAndDrivers);
      const predictions = trainAndPredict(patients);
      const summary = {
        averageDeltaCPO:
          patients.length > 0 ? ss.mean(patients.map((p) => p.deltaCPO)) : 0,
        riskPatientCount: patients.filter(
          (p) => p.postRA > 20 || p.postPAPI < 1.0,
        ).length,
        recoveryScoreAverage:
          patients.length > 0
            ? ss.mean(patients.map((p) => p.recoveryScore))
            : 0,
      };
      res.json({ patients, summary, predictions, clusterResults: mlResult.clusterResults });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to process data" });
    }
  });
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit server.ts`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add server.ts
git commit -m "server: attach decision support data in /api/analyze

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Update /api/sample Endpoint

**Files:**
- Modify: `server.ts:354-460`

**Goal:** Same as Task 3 but for sample data endpoint.

- [ ] **Step 1: Modify /api/sample**

After the `samplePatients` array is defined and before `let enhancedPatients = checkEscalationAlerts(samplePatients);`, add:

```typescript
    // Load and attach pre-computed decision support data (Phase 1)
    const { bootstrap, trajectory } = loadDecisionSupportData();
    let enhancedPatients = attachDecisionSupportData(samplePatients, bootstrap, trajectory);
```

Then change:
```typescript
    let enhancedPatients = checkEscalationAlerts(samplePatients);
```
to:
```typescript
    enhancedPatients = checkEscalationAlerts(enhancedPatients);
```

The rest of the handler stays the same.

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit server.ts`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add server.ts
git commit -m "server: attach decision support data in /api/sample

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Create PatientDecisionSupport Component

**Files:**
- Create: `src/components/PatientDecisionSupport.tsx`

**Goal:** Build the new Decision Support section as a standalone component. It receives a `PatientData` patient and renders risk bars, recovery trajectory, alerts, model performance, trajectory explorer, and the collapsible guide.

- [ ] **Step 1: Write the component**

```typescript
import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { Info, AlertTriangle, CheckCircle, TrendingUp, Activity } from "lucide-react";
import { cn } from "@/src/lib/utils";
import type { PatientData } from "../types";

interface PatientDecisionSupportProps {
  patient: PatientData;
}

const TARGET_LABELS: Record<string, string> = {
  survival: "Mortality Risk",
  escalation: "MCS Escalation Risk",
  rv_dysfunction: "RV Dysfunction Risk",
};

function riskColor(mean: number | null): string {
  if (mean == null) return "#6b7280";
  if (mean < 0.25) return "#22c55e";
  if (mean < 0.50) return "#eab308";
  return "#ef4444";
}

function ciWidth(low: number | null, high: number | null): number {
  if (low == null || high == null) return 0;
  return high - low;
}

export default function PatientDecisionSupport({ patient }: PatientDecisionSupportProps) {
  const [showGuide, setShowGuide] = useState(false);
  const [trajectoryMetric, setTrajectoryMetric] = useState<"cpo" | "papi" | "lactate">("cpo");
  const [trajectoryGroup, setTrajectoryGroup] = useState<"cluster" | "all">("all");

  const bootstrap = patient.bootstrapCI;
  const traj = patient.trajectoryData;
  const perf = patient.modelPerformance;

  // Map metric key to trajectory field names
  const METRIC_FIELDS = {
    cpo: { mean: "delta_cpo_mean" as const, low: "delta_cpo_ci_lower" as const, high: "delta_cpo_ci_upper" as const, label: "ΔCPO" },
    papi: { mean: "delta_papi_mean" as const, low: "delta_papi_ci_lower" as const, high: "delta_papi_ci_upper" as const, label: "ΔPAPI" },
    lactate: { mean: "delta_lactate_mean" as const, low: "delta_lactate_ci_lower" as const, high: "delta_lactate_ci_upper" as const, label: "ΔLactate" },
  };
  const mf = METRIC_FIELDS[trajectoryMetric];

  // Build bar chart data
  const chartData = (() => {
    if (!traj || !patient.trajectoryData) return [];
    const current = patient.trajectoryData;
    const meanVal = current[mf.mean];
    if (meanVal == null) return [];

    // No peer comparison in single-patient view (simplified from cohort page)
    // Show just this patient's value with CI
    return [
      {
        name: "This Patient",
        delta: meanVal,
        ciLow: current[mf.low] ?? meanVal,
        ciHigh: current[mf.high] ?? meanVal,
      },
    ];
  })();

  // CI for a target
  const ciForTarget = (target: "survival" | "escalation" | "rv_dysfunction") => {
    if (!bootstrap) return null;
    return bootstrap[target];
  };

  return (
    <div className="bg-[#0f172a] border-2 border-blue-500/50 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-lg">📊</span>
          <h3 className="text-blue-400 font-bold text-sm uppercase tracking-widest">Decision Support</h3>
        </div>
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center gap-1.5 bg-[#1e3a5f] border border-blue-500/50 text-blue-300 rounded px-3 py-1.5 text-xs font-semibold hover:bg-[#2d4a6f] transition-colors"
        >
          <Info size={12} /> How to Read These Numbers
        </button>
      </div>

      {/* Collapsible Guide */}
      {showGuide && (
        <div className="bg-[#1e293b] border border-slate-600 rounded-lg p-4 text-xs text-slate-300 leading-relaxed space-y-2">
          <div className="text-blue-400 font-bold uppercase text-[10px] tracking-widest mb-2">📖 Clinician's Guide to ML Numbers</div>
          <p><strong className="text-blue-300">Probability (e.g., Mortality Risk 28%):</strong> The model's best estimate that this specific patient will experience that outcome. It is <em>not</em> a guarantee — it is a weighted forecast based on patterns in historical patients with similar measurements. Treat it as a "weather forecast."</p>
          <p><strong className="text-blue-300">AUC (e.g., 0.89):</strong> How well the model discriminates between patients who did and did not experience the outcome. 0.50 = coin flip. 0.70–0.80 = fair. 0.80–0.90 = good. &gt;0.90 = excellent.</p>
          <p><strong className="text-blue-300">95% CI (e.g., 18%–38%):</strong> If we re-ran the model on 100 similar cohorts, the probability would fall in this range 95 times. Narrow CI = more confident. Wide CI = high uncertainty — rely more on bedside judgment.</p>
          <p><strong className="text-blue-300">How to use at the bedside:</strong> Combine with your clinical gestalt, trending labs, and hemodynamics. A low score is reassuring but not a guarantee.</p>
        </div>
      )}

      {/* Three-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Column 1: Risk Assessment */}
        <div className="bg-dark-card rounded-lg p-4 border border-dark-border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Activity size={14} className="text-blue-400" /> Risk Assessment
            </h3>
            <span className="text-dark-text-muted cursor-help" title="Risk probabilities with 95% bootstrap confidence intervals. Narrow CI = higher confidence.">ℹ</span>
          </div>

          {(["survival", "escalation", "rv_dysfunction"] as const).map((target) => {
            const ci = ciForTarget(target);
            const mean = ci?.prediction_mean ?? null;
            const low = ci?.ci_lower ?? null;
            const high = ci?.ci_upper ?? null;
            const color = riskColor(mean);
            const pct = mean != null ? (mean * 100).toFixed(0) : "—";
            const ciStr = low != null && high != null
              ? `${(low * 100).toFixed(0)}%–${(high * 100).toFixed(0)}%`
              : "—";

            return (
              <div key={target} className="mb-5 last:mb-0">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-medium">{TARGET_LABELS[target]}</span>
                  <span className="text-[10px] text-dark-text-muted font-mono">
                    AUC {perf ? perf[target].global_auc_mean.toFixed(2) : "—"}
                  </span>
                </div>
                <div className="relative h-7 bg-dark-bg rounded overflow-hidden mb-1">
                  <div
                    className="h-full rounded flex items-center px-2 transition-all duration-500"
                    style={{
                      width: `${Math.max(mean != null ? mean * 100 : 0, 3)}%`,
                      background: `linear-gradient(90deg, ${color}, ${color}88)`,
                    }}
                  >
                    <span className="text-[10px] text-black font-bold">{pct}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-dark-text-muted">
                  <span>95% CI: {ciStr}</span>
                  {low != null && high != null && (
                    <span className="text-[9px] opacity-50">(±{(ciWidth(low, high) * 50).toFixed(0)}pp)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Column 2: Recovery Trajectory */}
        <div className="bg-dark-card rounded-lg p-4 border border-dark-border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-400" /> Recovery Trajectory
            </h3>
            <span className="text-dark-text-muted cursor-help" title="Predicted changes based on similar patients in the cohort.">ℹ</span>
          </div>

          {/* Weaning Readiness */}
          <div className="mb-5">
            <span className="text-xs font-medium mb-2 block">Weaning Readiness Score</span>
            <div className="h-2 bg-dark-bg rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(patient.checklistResults?.weaningScore ?? 0, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-dark-text-muted">
              <span>Current: <strong className="text-dark-text-primary">{patient.checklistResults?.weaningScore ?? 0}/100</strong></span>
              <span>Target: <strong className="text-emerald-400">≥60</strong></span>
            </div>
          </div>

          {/* Similar Patient Outcomes */}
          <div className="mb-5">
            <span className="text-xs font-medium mb-2 block">Similar Patient Outcomes</span>
            <div className="bg-dark-bg rounded p-3 space-y-2">
              {traj && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-dark-text-muted">Recovery w/o escalation</span>
                    <span className="font-bold text-emerald-400">
                      {traj.escalation_rate != null
                        ? `${((1 - traj.escalation_rate) * 100).toFixed(0)}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-dark-text-muted">Required escalation</span>
                    <span className="font-bold text-red-400">
                      {traj.escalation_rate != null
                        ? `${(traj.escalation_rate * 100).toFixed(0)}%`
                        : "—"}
                    </span>
                  </div>
                </>
              )}
              {!traj && (
                <div className="text-xs text-dark-text-muted">No matching data</div>
              )}
            </div>
            <div className="text-[10px] text-dark-text-muted mt-1">
              Based on {traj?.matches ?? 0} similar patients
            </div>
          </div>

          {/* Predicted Delta CPO */}
          <div>
            <span className="text-xs font-medium mb-2 block">Predicted ΔCPO at 48h</span>
            <div className="bg-dark-bg rounded p-4 text-center">
              <div className="text-3xl font-bold">
                {traj?.delta_cpo_mean != null
                  ? `${traj.delta_cpo_mean >= 0 ? "+" : ""}${traj.delta_cpo_mean.toFixed(2)}`
                  : "—"}
              </div>
              <div className="text-[10px] text-dark-text-muted mt-1">
                95% CI: {traj?.delta_cpo_ci_lower != null && traj?.delta_cpo_ci_upper != null
                  ? `${traj.delta_cpo_ci_lower.toFixed(2)} to ${traj.delta_cpo_ci_upper.toFixed(2)}`
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Decision Alerts + Model Performance */}
        <div className="bg-dark-card rounded-lg p-4 border border-dark-border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Info size={14} className="text-amber-400" /> Decision Support
            </h3>
            <span className="text-dark-text-muted cursor-help" title="Actionable alerts and model validation metrics.">ℹ</span>
          </div>

          {/* Weaning Candidate */}
          {patient.checklistResults?.weaningPassed && (
            <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-lg p-4 text-center mb-4">
              <CheckCircle size={28} className="text-emerald-400 mx-auto mb-1" />
              <div className="font-bold text-sm">Weaning Candidate</div>
              <div className="text-[10px] text-dark-text-muted mt-1">
                Score {patient.checklistResults.weaningScore}/100 ≥ threshold 60 — meets weaning criteria
              </div>
            </div>
          )}

          {/* Watch flags */}
          {(() => {
            const escCi = ciForTarget("escalation");
            const escRisk = escCi?.prediction_mean ?? 0;
            if (escRisk > 0.3) {
              return (
                <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-amber-400">
                        {escRisk > 0.5 ? "High" : "Moderate"} Escalation Risk
                      </div>
                      <div className="text-[10px] text-dark-text-muted mt-1">
                        Risk {(escRisk * 100).toFixed(0)}% — consider early escalation planning
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {(() => {
            const rvCi = ciForTarget("rv_dysfunction");
            const rvRisk = rvCi?.prediction_mean ?? 0;
            if (rvRisk > 0.3) {
              return (
                <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-amber-400">RV Dysfunction Watch</div>
                      <div className="text-[10px] text-dark-text-muted mt-1">
                        Risk {(rvRisk * 100).toFixed(0)}% — monitor right heart function
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Model Performance */}
          {perf && (
            <div className="bg-dark-bg rounded p-3">
              <div className="text-[10px] uppercase font-mono tracking-widest text-dark-text-muted mb-2 flex items-center gap-1">
                Model Performance
                <span className="text-dark-text-muted cursor-help text-[9px]" title="AUC = discriminative ability. Higher = better. CI reflects confidence in the AUC estimate.">ℹ</span>
              </div>
              <div className="space-y-2 text-xs">
                {(["survival", "escalation", "rv_dysfunction"] as const).map((target) => {
                  const m = perf[target];
                  return (
                    <div key={target} className="flex justify-between items-center">
                      <span className="text-dark-text-muted">{TARGET_LABELS[target]}</span>
                      <span className="font-mono">
                        AUC <strong>{m.global_auc_mean.toFixed(3)}</strong>
                        <span className="text-dark-text-muted ml-1">
                          [{m.global_auc_ci_lower.toFixed(2)}–{m.global_auc_ci_upper.toFixed(2)}]
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="text-[9px] text-dark-text-muted mt-2 border-t border-dark-border pt-2">
                Bootstrap CI based on {perf.survival.n_bootstrap} iterations
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trajectory Explorer */}
      {traj && (
        <div className="bg-dark-card rounded-lg p-4 border border-dark-border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <TrendingUp size={14} className="text-blue-400" /> Trajectory Explorer
            </h3>
            <span className="text-dark-text-muted cursor-help" title="Compare this patient's predicted trajectory against similar patients or the full cohort.">ℹ</span>
          </div>

          <div className="flex gap-6 mb-4">
            <div>
              <div className="text-[10px] uppercase text-dark-text-muted font-mono tracking-widest mb-1">Metric</div>
              <select
                className="bg-dark-bg border border-dark-border text-dark-text-primary rounded px-3 py-1.5 text-xs"
                value={trajectoryMetric}
                onChange={(e) => setTrajectoryMetric(e.target.value as any)}
              >
                <option value="cpo">Cardiac Power Output (CPO)</option>
                <option value="papi">PAPI</option>
                <option value="lactate">Lactate</option>
              </select>
            </div>
            <div>
              <div className="text-[10px] uppercase text-dark-text-muted font-mono tracking-widest mb-1">Comparison Group</div>
              <select
                className="bg-dark-bg border border-dark-border text-dark-text-primary rounded px-3 py-1.5 text-xs"
                value={trajectoryGroup}
                onChange={(e) => setTrajectoryGroup(e.target.value as any)}
              >
                <option value="all">All patients</option>
                <option value="cluster">Same phenotype cluster</option>
              </select>
            </div>
          </div>

          {chartData.length > 0 ? (
            <div className="bg-dark-bg rounded p-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                  <XAxis dataKey="name" tick={{ fill: "#a0aec0", fontSize: 11 }} />
                  <YAxis
                    tick={{ fill: "#a0aec0", fontSize: 11 }}
                    label={{ value: mf.label, angle: -90, position: "insideLeft", style: { fill: "#a0aec0", fontSize: 11 } }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1a202c",
                      border: "1px solid #2d3748",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => (value as number).toFixed(3)}
                  />
                  <ReferenceLine y={0} stroke="#4a5568" strokeDasharray="4 4" />
                  <Bar dataKey="delta" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={idx === 0 ? "#3b82f6" : "#22c55e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="flex justify-center gap-12 mt-2 text-[10px] text-dark-text-muted">
                {chartData.map((d, i) => (
                  <div key={i} className="text-center">
                    <span className="font-mono">
                      {d.name}: {d.delta >= 0 ? "+" : ""}{d.delta.toFixed(2)}
                    </span>
                    <span className="ml-2">
                      95% CI [{d.ciLow.toFixed(2)} to {d.ciHigh.toFixed(2)}]
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-dark-bg rounded p-6 text-center text-xs text-dark-text-muted">
              No trajectory data available for this patient
            </div>
          )}

          {/* Interpretation */}
          {traj && (
            <div className="text-[10px] text-dark-text-muted mt-3 leading-relaxed">
              <strong className="text-dark-text-primary">Interpretation:</strong>{" "}
              This patient's {mf.label.replace("Δ", "")} change
              ({traj[mf.mean] != null
                ? `${traj[mf.mean]! >= 0 ? "+" : ""}${traj[mf.mean]!.toFixed(2)}`
                : "N/A"})
              is based on {traj.matches} similar patients.
              {traj.escalation_rate != null && (
                <>
                  {" "}Of those matches, {(traj.escalation_rate * 100).toFixed(0)}% required escalation.
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit src/components/PatientDecisionSupport.tsx`
Expected: No errors (may need `--jsx react` flag; `npm run lint` covers this).

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PatientDecisionSupport.tsx
git commit -m "feat: add PatientDecisionSupport component

Risk assessment with CIs, recovery trajectory, decision alerts,
trajectory explorer, and collapsible clinician guide.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Integrate PatientDecisionSupport into ActivePatientMonitor

**Files:**
- Modify: `src/components/ActivePatientMonitor.tsx:1-30` (imports)
- Modify: `src/components/ActivePatientMonitor.tsx:520-530` (insert after Simulator, before Longitudinal Telemetry)

**Goal:** Import `PatientDecisionSupport` and render it in the left column between the Simulator and Longitudinal Telemetry.

- [ ] **Step 1: Add import**

At the top of `ActivePatientMonitor.tsx`, add:

```typescript
import PatientDecisionSupport from "./PatientDecisionSupport";
```

- [ ] **Step 2: Insert component**

Find the comment `/* Section 4: Longitudinal Hemodynamic Trajectories */` (around line 692). Insert this immediately before it:

```tsx
      {/* Section 3.5: Decision Support (merged from DecisionSupportPage) */}
      <PatientDecisionSupport patient={patient} />
```

- [ ] **Step 3: Verify TypeScript**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ActivePatientMonitor.tsx
git commit -m "feat: integrate PatientDecisionSupport into ActivePatientMonitor

Renders below Simulator and above Longitudinal Telemetry.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Add ℹ Help Tooltips to Existing ActivePatientMonitor Sections

**Files:**
- Modify: `src/components/ActivePatientMonitor.tsx:269-328` (checklists)
- Modify: `src/components/ActivePatientMonitor.tsx:332-520` (simulator)
- Modify: `src/components/ActivePatientMonitor.tsx:692-791` (longitudinal telemetry)
- Modify: `src/components/ActivePatientMonitor.tsx:527-573` (explainable AI)
- Modify: `src/components/ActivePatientMonitor.tsx:577-685` (AI memo)

**Goal:** Add `InfoTip` tooltips or `title` attributes to every section header. The existing `InfoTip` component is already imported.

- [ ] **Step 1: Weaning Checklist header**

In `ActivePatientMonitor.tsx`, find:
```tsx
              <h3 className="font-semibold text-sm uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <CheckCircle2 size={16} /> Weaning Readiness Assessment <InfoTip>...</InfoTip>
              </h3>
```

This already has an `InfoTip`. Verify it exists. It does (line 270).

- [ ] **Step 2: Escalation Warnings header**

Find:
```tsx
              <h3 className="font-semibold text-sm uppercase tracking-widest text-red-400 flex items-center gap-2">
                <AlertOctagon size={16} className="animate-pulse" /> Escalation Danger Flags <InfoTip>...</InfoTip>
              </h3>
```

Already has `InfoTip`. Verified (line 306).

- [ ] **Step 3: Simulator header**

Find:
```tsx
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Sliders size={18} className="text-blue-400" /> Bedside "What-If" Treatment Simulator
                </h3>
```

Add an `InfoTip`:
```tsx
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Sliders size={18} className="text-blue-400" /> Bedside "What-If" Treatment Simulator <InfoTip>Virtually adjust parameters and see recalculated ML risks in real time.</InfoTip>
                </h3>
```

- [ ] **Step 4: Longitudinal Telemetry header**

Find:
```tsx
        <h3 className="font-semibold text-sm uppercase tracking-widest mb-6 flex items-center gap-2 text-white">
          <Heart size={16} className="text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]" /> Longitudinal Telemetry Trajectories (Pre vs 48h Post) <InfoTip>...</InfoTip>
        </h3>
```

Already has `InfoTip`. Verified (line 694).

- [ ] **Step 5: Explainable AI header**

Find:
```tsx
            <h3 className="font-semibold text-sm uppercase tracking-widest text-blue-400 flex items-center gap-2">
              <Brain size={16} /> Explainable AI (Bedside Drivers) <InfoTip>...</InfoTip>
            </h3>
```

Already has `InfoTip`. Verified (line 529).

- [ ] **Step 6: AI Memo header**

Find:
```tsx
              <h3 className={cn("font-semibold text-sm uppercase tracking-widest flex items-center gap-2", useLLM ? "text-purple-400" : "text-dark-text-muted")}>
                <Sparkles size={16} /> Clinical Huddle Memo <InfoTip>...</InfoTip>
              </h3>
```

Already has `InfoTip`. Verified (line 583).

**Result:** The Simulator header was the only one missing an `InfoTip`. After adding it, all sections have help tooltips.

- [ ] **Step 7: Commit**

```bash
git add src/components/ActivePatientMonitor.tsx
git commit -m "ui: add InfoTip tooltip to Simulator header in ActivePatientMonitor

All sections now have help tooltips.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Remove DecisionSupportPage from App.tsx

**Files:**
- Modify: `src/App.tsx:1-30` (imports)
- Modify: `src/App.tsx:29` (activePage type)
- Modify: `src/App.tsx:80-91` (nav button)
- Modify: `src/App.tsx:220-228` (page branch)

**Goal:** Remove all references to the Decision Support page.

- [ ] **Step 1: Remove import**

Delete line 23:
```typescript
import DecisionSupportPage from "./components/DecisionSupportPage";
```

- [ ] **Step 2: Remove from activePage type**

Change line 29 from:
```typescript
const [activePage, setActivePage] = useState<"dashboard" | "clusters" | "pvloop" | "mortality" | "effectiveness" | "decision">("dashboard");
```
to:
```typescript
const [activePage, setActivePage] = useState<"dashboard" | "clusters" | "pvloop" | "mortality" | "effectiveness">("dashboard");
```

- [ ] **Step 3: Remove nav button**

Delete lines 81-91:
```tsx
          <button
            onClick={() => setActivePage("decision")}
            className={cn(
              "px-4 py-2 rounded-sm transition-all flex items-center gap-2 text-sm font-medium border",
              activePage === "decision"
                ? "bg-cyan-600 text-white border-cyan-600"
                : "border-dark-border hover:bg-dark-accent"
            )}
          >
            <Activity size={16} className={activePage === "decision" ? "text-cyan-200" : "text-cyan-400"} />            Decision Support
          </button>
```

- [ ] **Step 4: Remove page render branch**

Delete lines 220-228:
```tsx
            ) : activePage === "decision" ? (
              <div className="space-y-6">
                <button
                  onClick={() => setActivePage("dashboard")}
                  className="flex items-center gap-2 text-sm font-medium text-dark-text-muted hover:text-dark-text-primary transition-colors"
                >
                  <ArrowLeft size={16} /> Back to Dashboard
                </button>
                <DecisionSupportPage />
              </div>
```

- [ ] **Step 5: Verify TypeScript**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: remove Decision Support page from App.tsx

Removes nav button, import, type union entry, and page branch.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Delete DecisionSupportPage.tsx

**Files:**
- Delete: `src/components/DecisionSupportPage.tsx`

- [ ] **Step 1: Delete the file**

```bash
rm src/components/DecisionSupportPage.tsx
```

- [ ] **Step 2: Verify nothing else imports it**

Run: `grep -r "DecisionSupportPage" src/`
Expected: No output (all references removed in Task 8).

- [ ] **Step 3: Commit**

```bash
git add src/components/DecisionSupportPage.tsx
git commit -m "chore: delete DecisionSupportPage component

Content migrated to PatientDecisionSupport inside ActivePatientMonitor.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: TypeScript Check and Dev Server Test

- [ ] **Step 1: Full type check**

Run: `npm run lint`
Expected: `tsc --noEmit` exits with code 0, no errors.

- [ ] **Step 2: Start dev server and verify**

Run: `npm run dev`
Wait for server startup.

In a separate shell (or use the existing server), run:
```bash
curl -s http://localhost:3001/api/sample | python3 -m json.tool | head -40
```

Verify that the first patient in the response has `bootstrapCI`, `trajectoryData`, and `modelPerformance` fields populated.

- [ ] **Step 3: Verify UI**

Open `http://localhost:3001` in browser.
1. Click "Load Sample Clinical Cohort".
2. In Patient Records sidebar, click "Bryan Jones".
3. Verify the patient panel shows:
   - Telemetry header (unchanged)
   - Weaning checklist + Escalation flags (unchanged)
   - Simulator (unchanged)
   - **NEW:** Decision Support section with blue border, containing:
     - "How to Read These Numbers" collapsible guide
     - Risk Assessment bars with CIs
     - Recovery Trajectory with weaning score + similar patient outcomes + predicted ΔCPO
     - Decision Alerts (weaning badge + watch flags + model AUCs)
     - Trajectory Explorer bar chart
   - Longitudinal Telemetry sparklines (unchanged)
   - Explainable AI drivers (unchanged)
   - AI Memo (unchanged)
4. Verify no "Decision Support" button in top nav.
5. Click ℹ buttons and verify tooltips appear.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: verify Phase 1 consolidation end-to-end

TypeScript clean, dev server running, UI renders correctly.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Push to GitHub

- [ ] **Step 1: Push**

```bash
git push origin main
```

---

## Self-Review

### Spec Coverage Check

| Spec Requirement | Plan Task |
|-----------------|-----------|
| Extend `PatientData` with `bootstrapCI` | Task 1 |
| Extend `PatientData` with `trajectoryData` | Task 1 |
| Extend `PatientData` with `modelPerformance` | Task 1 |
| Load JSON in `/api/analyze` | Task 3 |
| Load JSON in `/api/sample` | Task 4 |
| Risk assessment bars with CIs | Task 5 |
| Recovery trajectory (weaning + similar outcomes + ΔCPO) | Task 5 |
| Decision alerts (badge + watch flags) | Task 5 |
| Model performance AUCs | Task 5 |
| Trajectory Explorer bar chart | Task 5 |
| "How to Read These Numbers" guide | Task 5 |
| ℹ help tooltips on every section | Task 5 + Task 7 |
| Remove `DecisionSupportPage` from nav | Task 8 |
| Delete `DecisionSupportPage.tsx` | Task 9 |
| TypeScript compiles cleanly | Task 10 |
| Dev server works | Task 10 |

**All requirements covered. No gaps.**

### Placeholder Scan

- No "TBD", "TODO", "implement later" found.
- No "Add appropriate error handling" without specifics.
- All code snippets are complete and ready to copy.
- All file paths are exact.
- All commands have expected outputs.

### Type Consistency

- `bootstrapCI` uses `PatientBootstrapCI` (defined in Task 1, used in Task 2, rendered in Task 5).
- `trajectoryData` uses `TrajectoryData` (defined in Task 1, used in Task 2, rendered in Task 5).
- `modelPerformance` uses `PatientModelPerformance` (defined in Task 1, used in Task 2, rendered in Task 5).
- Field names match JSON structures exactly (`patientId`, `prediction_mean`, `ci_lower`, `ci_upper`, `delta_cpo_mean`, etc.).

**No inconsistencies found.**
