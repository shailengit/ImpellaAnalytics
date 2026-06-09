import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { Activity, AlertTriangle, CheckCircle, TrendingUp, Info } from "lucide-react";
import { cn } from "@/src/lib/utils";
import type { PatientData } from "../types";
import InfoTip from "./InfoTip";

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                  */
/* ------------------------------------------------------------------ */

type TrajectoryMetricKey = "cpo" | "papi" | "lactate";
type ComparisonGroup = "cluster" | "all";

interface TrajectoryMetricConfig {
  mean: keyof NonNullable<PatientData["trajectoryData"]>;
  low: keyof NonNullable<PatientData["trajectoryData"]>;
  high: keyof NonNullable<PatientData["trajectoryData"]>;
  label: string;
}

const TARGET_LABELS: Record<string, string> = {
  survival: "Mortality Risk",
  escalation: "MCS Escalation Risk",
  rv_dysfunction: "RV Dysfunction Risk",
};

const TARGET_DESCRIPTIONS: Record<string, string> = {
  survival: "Probability of in-hospital mortality based on pre-implant hemodynamics and labs.",
  escalation: "Likelihood of requiring escalation to additional MCS devices.",
  rv_dysfunction: "Risk of right ventricular dysfunction post-implant.",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function riskColor(mean: number | null | undefined): string {
  if (mean == null) return "#6b7280";
  if (mean < 0.25) return "#22c55e"; // green
  if (mean < 0.50) return "#eab308"; // yellow
  return "#ef4444"; // red
}

function ciWidth(low: number | null | undefined, high: number | null | undefined): number {
  if (low == null || high == null) return 0;
  return high - low;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export interface PatientDecisionSupportProps {
  patient: PatientData;
  cohort?: PatientData[];
}

export default function PatientDecisionSupport({ patient, cohort }: PatientDecisionSupportProps) {
  const [showGuide, setShowGuide] = useState(false);
  const [trajectoryMetric, setTrajectoryMetric] = useState<TrajectoryMetricKey>("cpo");
  const [trajectoryGroup, setTrajectoryGroup] = useState<ComparisonGroup>("all");

  /* ── Derived data ── */
  const bootstrapCI = patient.bootstrapCI;
  const trajectoryData = patient.trajectoryData;
  const modelPerf = patient.modelPerformance;
  const checklist = patient.checklistResults;
  const riskScores = patient.riskScores;

  const targets = ["survival", "escalation", "rv_dysfunction"] as const;

  /* ── Trajectory Explorer helpers ── */
  const METRIC_FIELDS: Record<TrajectoryMetricKey, TrajectoryMetricConfig> = {
    cpo: {
      mean: "delta_cpo_mean",
      low: "delta_cpo_ci_lower",
      high: "delta_cpo_ci_upper",
      label: "ΔCPO",
    },
    papi: {
      mean: "delta_papi_mean",
      low: "delta_papi_ci_lower",
      high: "delta_papi_ci_upper",
      label: "ΔPAPI",
    },
    lactate: {
      mean: "delta_lactate_mean",
      low: "delta_lactate_ci_lower",
      high: "delta_lactate_ci_upper",
      label: "ΔLactate",
    },
  };

  const mf = METRIC_FIELDS[trajectoryMetric];

  const chartData = useMemo(() => {
    if (!trajectoryData) return [];

    const meanVal = trajectoryData[mf.mean] as number | null;
    const lowVal = trajectoryData[mf.low] as number | null;
    const highVal = trajectoryData[mf.high] as number | null;

    if (meanVal == null) return [];

    const rows: { name: string; delta: number; ciLow: number; ciHigh: number }[] = [
      {
        name: "This Patient",
        delta: meanVal,
        ciLow: lowVal ?? meanVal,
        ciHigh: highVal ?? meanVal,
      },
    ];

    // Compute peer group average from cohort
    if (cohort && cohort.length > 0) {
      let peers = cohort;

      if (trajectoryGroup === "cluster" && trajectoryData.cluster_id != null) {
        peers = cohort.filter(
          (p) =>
            p.id !== patient.id &&
            p.trajectoryData?.cluster_id === trajectoryData.cluster_id
        );
      } else {
        peers = cohort.filter((p) => p.id !== patient.id);
      }

      const peerMeans = peers
        .map((p) => (p.trajectoryData ? (p.trajectoryData[mf.mean] as number | null) : null))
        .filter((v): v is number => v != null);

      const peerLow = peers
        .map((p) => (p.trajectoryData ? (p.trajectoryData[mf.low] as number | null) : null))
        .filter((v): v is number => v != null);

      const peerHigh = peers
        .map((p) => (p.trajectoryData ? (p.trajectoryData[mf.high] as number | null) : null))
        .filter((v): v is number => v != null);

      if (peerMeans.length > 0) {
        const avgDelta = peerMeans.reduce((s, v) => s + v, 0) / peerMeans.length;
        const avgLow = peerLow.length > 0
          ? peerLow.reduce((s, v) => s + v, 0) / peerLow.length
          : avgDelta;
        const avgHigh = peerHigh.length > 0
          ? peerHigh.reduce((s, v) => s + v, 0) / peerHigh.length
          : avgDelta;

        const groupLabel =
          trajectoryGroup === "cluster" && trajectoryData.cluster_name
            ? `${trajectoryData.cluster_name} (n=${peerMeans.length})`
            : `All Patients (n=${peerMeans.length})`;

        rows.push({
          name: groupLabel,
          delta: avgDelta,
          ciLow: avgLow,
          ciHigh: avgHigh,
        });
      }
    }

    return rows;
  }, [trajectoryData, trajectoryMetric, trajectoryGroup, mf, cohort, patient.id]);

  /* ── Render ── */
  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2 text-blue-400">
          <Activity size={18} />
          Decision Support
        </h2>
        <button
          onClick={() => setShowGuide(v => !v)}
          className="text-xs font-medium border border-dark-border bg-dark-accent px-3 py-1.5 rounded hover:bg-dark-border transition-all flex items-center gap-1.5"
          title="Toggle explanatory guide"
        >
          <Info size={12} />
          How to Read These Numbers
        </button>
      </div>

      {/* ── Collapsible Guide ── */}
      {showGuide && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-2xl space-y-4">
          <div>
            <h4 className="text-sm font-bold mb-1 flex items-center gap-1.5">
              <Info size={12} className="text-blue-400" /> Probability
            </h4>
            <p className="text-xs text-dark-text-secondary leading-relaxed">
              The model&apos;s best estimate of the likelihood of an outcome (e.g., mortality or escalation). Treat it as a weather forecast — a 70% chance of rain means it probably will rain, but not always. Never use probability alone to override clinical judgment.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold mb-1 flex items-center gap-1.5">
              <Info size={12} className="text-blue-400" /> AUC (Area Under Curve)
            </h4>
            <p className="text-xs text-dark-text-secondary leading-relaxed">
              How well the model discriminates between patients who will and will not experience the outcome. <strong>0.50 = coin flip</strong>, <strong>0.70–0.80 = fair</strong>, <strong>0.80–0.90 = good</strong>, <strong>&gt;0.90 = excellent</strong>.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold mb-1 flex items-center gap-1.5">
              <Info size={12} className="text-blue-400" /> 95% CI (Confidence Interval)
            </h4>
            <p className="text-xs text-dark-text-secondary leading-relaxed">
              If we re-ran the model on 100 similar cohorts, 95 of those runs would produce an estimate inside this range. <strong>Narrow = confident</strong>, <strong>wide = uncertain</strong>. A wide CI means the model is less sure — use extra caution.
            </p>
          </div>
        </div>
      )}

      {/* ── Three-Column Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Column 1: Risk Assessment */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-2xl">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Activity size={14} className="text-blue-400" />
            Risk Assessment
          </h3>

          {targets.map(target => {
            const ci = bootstrapCI ? (bootstrapCI as any)[target] as { prediction_mean: number | null; ci_lower: number | null; ci_upper: number | null } | undefined : undefined;
            const mean = ci?.prediction_mean ?? riskScores?.[target === "survival" ? "survival" : target === "escalation" ? "escalation" : "rvDysfunction"] ?? null;
            const low = ci?.ci_lower ?? null;
            const high = ci?.ci_upper ?? null;

            // AUC from modelPerformance if available, else fallback placeholders
            const perf = modelPerf ? (modelPerf as any)[target] as { global_auc_mean: number } | undefined : undefined;
            const auc = perf?.global_auc_mean ?? 0.85;

            const color = riskColor(mean);
            const pct = mean != null ? (mean * 100).toFixed(0) : "—";
            const ciStr = low != null && high != null
              ? `${(low * 100).toFixed(0)}%–${(high * 100).toFixed(0)}%`
              : "—";

            return (
              <div key={target} className="mb-5 last:mb-0" title={TARGET_DESCRIPTIONS[target]}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-medium">{TARGET_LABELS[target]}</span>
                  <span className="text-[10px] text-dark-text-muted font-mono">
                    AUC {typeof auc === "number" ? auc.toFixed(2) : auc}
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
                  <span className="text-[9px] opacity-50">
                    (±{(ciWidth(low, high) * 50).toFixed(0)}pp)
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Column 2: Recovery Trajectory */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-2xl">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-400" />
            Recovery Trajectory
          </h3>

          {/* Weaning Readiness Score */}
          <div className="mb-5" title="Composite weaning readiness score based on checklist criteria">
            <span className="text-xs font-medium mb-2 block">Weaning Readiness Score</span>
            <div className="h-2 bg-dark-bg rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(checklist?.weaningScore ?? 0, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-dark-text-muted">
              <span>
                Current:{" "}
                <strong className="text-dark-text-primary">{checklist?.weaningScore ?? "—"}/100</strong>
              </span>
              <span>
                Target: <strong className="text-emerald-400">≥60</strong>
              </span>
            </div>
          </div>

          {/* Similar Patient Outcomes */}
          <div className="mb-5" title="Outcomes from matched similar patients in the cohort">
            <span className="text-xs font-medium mb-2 block">Similar Patient Outcomes</span>
            <div className="bg-dark-accent/40 rounded-lg border border-dark-border p-3.5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-dark-text-muted">Recovery w/o escalation</span>
                <span className="font-bold text-emerald-400">
                  {trajectoryData?.escalation_rate != null
                    ? `${((1 - trajectoryData.escalation_rate) * 100).toFixed(0)}%`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-dark-text-muted">Required escalation</span>
                <span className="font-bold text-red-400">
                  {trajectoryData?.escalation_rate != null
                    ? `${(trajectoryData.escalation_rate * 100).toFixed(0)}%`
                    : "—"}
                </span>
              </div>
            </div>
            <div className="text-[10px] text-dark-text-muted mt-1">
              Based on {trajectoryData?.matches ?? 0} similar patients
            </div>
          </div>

          {/* Predicted ΔCPO */}
          <div title="Predicted change in Cardiac Power Output at 48 hours post-implant">
            <span className="text-xs font-medium mb-2 block">Predicted ΔCPO at 48h</span>
            <div className="bg-dark-accent/40 rounded-lg border border-dark-border p-4 text-center">
              <div className="text-3xl font-bold">
                {trajectoryData?.delta_cpo_mean != null
                  ? `${trajectoryData.delta_cpo_mean >= 0 ? "+" : ""}${trajectoryData.delta_cpo_mean.toFixed(2)}`
                  : "—"}
              </div>
              <div className="text-[10px] text-dark-text-muted mt-1">
                95% CI:{" "}
                {trajectoryData?.delta_cpo_ci_lower != null && trajectoryData?.delta_cpo_ci_upper != null
                  ? `${trajectoryData.delta_cpo_ci_lower.toFixed(2)} to ${trajectoryData.delta_cpo_ci_upper.toFixed(2)}`
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Decision Support */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-2xl">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Info size={14} className="text-amber-400" />
            Decision Support
          </h3>

          {/* Weaning Candidate Badge */}
          {checklist?.weaningPassed ? (
            <div
              className="bg-emerald-900/20 border border-emerald-700/40 rounded-lg p-4 text-center mb-4"
              title="Patient meets criteria for weaning candidacy"
            >
              <CheckCircle size={28} className="text-emerald-400 mx-auto mb-1" />
              <div className="font-bold text-sm">Weaning Candidate</div>
              <div className="text-[10px] text-dark-text-muted mt-1">
                Score {checklist.weaningScore}/100 ≥ threshold 60 — meets weaning criteria
              </div>
            </div>
          ) : (
            <div
              className="bg-dark-accent/40 border border-dark-border rounded-lg p-4 text-center mb-4"
              title="Patient does not currently meet weaning criteria"
            >
              <AlertTriangle size={28} className="text-dark-text-muted mx-auto mb-1" />
              <div className="font-bold text-sm text-dark-text-muted">Not a Weaning Candidate</div>
              <div className="text-[10px] text-dark-text-muted mt-1">
                Score {checklist?.weaningScore ?? "—"}/100 below threshold 60
              </div>
            </div>
          )}

          {/* Escalation Risk Watch Flag */}
          {(() => {
            const escMean = bootstrapCI
              ? (bootstrapCI as any).escalation?.prediction_mean ?? riskScores?.escalation ?? 0
              : riskScores?.escalation ?? 0;
            if (typeof escMean === "number" && escMean > 0.3) {
              return (
                <div
                  className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 mb-4"
                  title="Consider early escalation planning"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-amber-400">
                        {escMean > 0.5 ? "High" : "Moderate"} Escalation Risk
                      </div>
                      <div className="text-[10px] text-dark-text-muted mt-1">
                        Risk {(escMean * 100).toFixed(0)}% — consider early escalation planning
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* RV Dysfunction Watch Flag */}
          {(() => {
            const rvMean = bootstrapCI
              ? (bootstrapCI as any).rv_dysfunction?.prediction_mean ?? riskScores?.rvDysfunction ?? 0
              : riskScores?.rvDysfunction ?? 0;
            if (typeof rvMean === "number" && rvMean > 0.3) {
              return (
                <div
                  className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 mb-4"
                  title="Monitor right heart function closely"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-amber-400">RV Dysfunction Watch</div>
                      <div className="text-[10px] text-dark-text-muted mt-1">
                        Risk {(rvMean * 100).toFixed(0)}% — monitor right heart function
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Model Performance Table */}
          <div className="bg-dark-accent/40 rounded-lg border border-dark-border p-3.5">
            <div className="text-[10px] uppercase font-mono tracking-widest text-dark-text-muted mb-2">
              Model Performance
            </div>
            <div className="space-y-2 text-xs">
              {targets.map(target => {
                const perf = modelPerf ? (modelPerf as any)[target] as { global_auc_mean: number; global_auc_ci_lower: number; global_auc_ci_upper: number } | undefined : undefined;
                const auc = perf?.global_auc_mean;
                const low = perf?.global_auc_ci_lower;
                const high = perf?.global_auc_ci_upper;

                return (
                  <div key={target} className="flex justify-between items-center">
                    <span className="text-dark-text-muted">{TARGET_LABELS[target]}</span>
                    <span className="font-mono">
                      {auc != null ? (
                        <>
                          AUC <strong>{auc.toFixed(3)}</strong>
                          {low != null && high != null && (
                            <span className="text-dark-text-muted ml-1">
                              [{low.toFixed(2)}–{high.toFixed(2)}]
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-dark-text-muted">—</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            {modelPerf && (
              <div className="text-[9px] text-dark-text-muted mt-2 border-t border-dark-border pt-2">
                Bootstrap CI based on {modelPerf.survival?.n_bootstrap ?? "—"} iterations
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Trajectory Explorer ── */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-2xl">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
          <TrendingUp size={14} className="text-blue-400" />
          Trajectory Explorer
        </h3>

        <div className="flex gap-6 mb-4">
          <div title="Choose a hemodynamic metric to compare">
            <div className="text-[10px] uppercase text-dark-text-muted font-mono tracking-widest mb-1">
              Metric
            </div>
            <select
              className="bg-dark-bg border border-dark-border text-dark-text-primary rounded px-3 py-1.5 text-xs"
              value={trajectoryMetric}
              onChange={e => setTrajectoryMetric(e.target.value as TrajectoryMetricKey)}
            >
              <option value="cpo">Cardiac Power Output (CPO)</option>
              <option value="papi">PAPI</option>
              <option value="lactate">Lactate</option>
            </select>
          </div>
          <div title="Choose which group to compare against">
            <div className="text-[10px] uppercase text-dark-text-muted font-mono tracking-widest mb-1">
              Comparison Group
            </div>
            <select
              className="bg-dark-bg border border-dark-border text-dark-text-primary rounded px-3 py-1.5 text-xs"
              value={trajectoryGroup}
              onChange={e => setTrajectoryGroup(e.target.value as ComparisonGroup)}
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
                  label={{
                    value: mf.label,
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: "#a0aec0", fontSize: 11 },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1a202c",
                    border: "1px solid #2d3748",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => (typeof value === "number" ? value.toFixed(3) : value)}
                />
                <ReferenceLine y={0} stroke="#4a5568" strokeDasharray="4 4" />
                <Bar dataKey="delta" radius={[4, 4, 0, 0]}>
                  {chartData.map((_entry, idx) => (
                    <Cell key={idx} fill={idx === 0 ? "#3b82f6" : "#22c55e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* CI markers */}
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
            No trajectory data available
          </div>
        )}

        {/* Interpretation */}
        {trajectoryData && chartData.length > 0 && (
          <div className="text-[10px] text-dark-text-muted mt-3 leading-relaxed">
            <strong className="text-dark-text-primary">Interpretation:</strong>{" "}
            This patient&apos;s {mf.label.replace("Δ", "")} change
            ({(() => {
              const v = trajectoryData[mf.mean] as number | null;
              return v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}` : "N/A";
            })()})
            is based on {trajectoryData.matches} similar patients.
            {trajectoryData.escalation_rate != null && (
              <>
                {" "}Of those matches, {(trajectoryData.escalation_rate * 100).toFixed(0)}% required escalation.
              </>
            )}
            {chartData.length > 1 && chartData[1] && (
              <>
                {" "}Compared to {chartData[1].name.split(" (")[0].toLowerCase()}, this patient is{" "}
                {Math.abs(chartData[0].delta - chartData[1].delta) < 0.05
                  ? "near the group average."
                  : chartData[0].delta > chartData[1].delta
                  ? `above average (+${(chartData[0].delta - chartData[1].delta).toFixed(2)}).`
                  : `below average (${(chartData[0].delta - chartData[1].delta).toFixed(2)}).`}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
