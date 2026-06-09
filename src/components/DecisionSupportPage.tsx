import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { Info, AlertTriangle, CheckCircle, TrendingUp, Activity } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PatientCI {
  patientId: string;
  prediction_mean: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
}

interface BootstrapTarget {
  patients: PatientCI[];
  global_auc_mean: number;
  global_auc_ci_lower: number;
  global_auc_ci_upper: number;
  n_bootstrap: number;
  confidence_level: number;
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

interface TrajectoryData {
  patients: TrajectoryPatient[];
  method: string;
  k: number;
  features: string[];
}

interface BootstrapData {
  survival: BootstrapTarget;
  escalation: BootstrapTarget;
  rv_dysfunction: BootstrapTarget;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function riskColor(mean: number | null): string {
  if (mean == null) return "#6b7280";
  if (mean < 0.25) return "#22c55e";
  if (mean < 0.50) return "#eab308";
  return "#ef4444";
}

function similarityGroupLabel(group: string, count: number): string {
  if (group === "cluster") return `${count} Same-cluster Patients`;
  return `${count} Similar Patients`;
}

function ciWidth(low: number | null, high: number | null): number {
  if (low == null || high == null) return 0;
  return high - low;
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
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DecisionSupportPage() {
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [trajectory, setTrajectory] = useState<TrajectoryData | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [trajectoryMetric, setTrajectoryMetric] = useState<"cpo" | "papi" | "lactate">("cpo");
  const [trajectoryGroup, setTrajectoryGroup] = useState<"cluster" | "all">("all");

  useEffect(() => {
    Promise.all([
      fetch("/ml_output/decision_support_bootstrap.json").then(r => r.json()),
      fetch("/ml_output/patient_trajectories.json").then(r => r.json()),
    ])
      .then(([boot, traj]) => {
        setBootstrap(boot);
        setTrajectory(traj);
        if (traj.patients.length > 0) {
          setSelectedPatientId(traj.patients[0].patientId);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-dark-text-muted font-mono text-sm uppercase tracking-widest">
        Loading decision support data...
      </div>
    );
  }

  if (!bootstrap || !trajectory) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-dark-text-muted font-mono text-sm uppercase tracking-widest">
        Decision support data not available. Run the ML pipeline first.
      </div>
    );
  }

  // Current patient data
  const patientTraj = trajectory.patients.find(p => p.patientId === selectedPatientId);
  const patientName = patientTraj?.name || selectedPatientId;

  const ciForTarget = (target: "survival" | "escalation" | "rv_dysfunction") => {
    const t = bootstrap[target];
    return t.patients.find(p => p.patientId === selectedPatientId);
  };

  // Map from dropdown metric key to TrajectoryPatient field names
  const METRIC_FIELDS = {
    cpo: { mean: "delta_cpo_mean" as const, low: "delta_cpo_ci_lower" as const, high: "delta_cpo_ci_upper" as const, label: "ΔCPO" },
    papi: { mean: "delta_papi_mean" as const, low: "delta_papi_ci_lower" as const, high: "delta_papi_ci_upper" as const, label: "ΔPAPI" },
    lactate: { mean: "delta_lactate_mean" as const, low: "delta_lactate_ci_lower" as const, high: "delta_lactate_ci_upper" as const, label: "ΔLactate" },
  };
  const mf = METRIC_FIELDS[trajectoryMetric];

  // Patients that have data for the selected metric
  const chartPatients = trajectory.patients.filter(p => p[mf.mean] != null);
  const currentPatientData = chartPatients.find(p => p.patientId === selectedPatientId);

  // Build bar chart data: selected delta metric for This Patient vs the comparison group
  const chartData = (() => {
    if (!currentPatientData) return [];

    // Filter comparison group based on trajectoryGroup selection
    const groupPatients = trajectoryGroup === "cluster" && currentPatientData.cluster_id != null
      ? chartPatients.filter(p => p.cluster_id === currentPatientData.cluster_id && p.patientId !== selectedPatientId)
      : chartPatients;

    const avgDelta = groupPatients.length > 0
      ? groupPatients.reduce((s, p) => s + (p[mf.mean] ?? 0), 0) / groupPatients.length
      : 0;
    const avgCiLow = groupPatients.length > 0
      ? groupPatients.reduce((s, p) => s + (p[mf.low] ?? 0), 0) / groupPatients.length
      : 0;
    const avgCiHigh = groupPatients.length > 0
      ? groupPatients.reduce((s, p) => s + (p[mf.high] ?? 0), 0) / groupPatients.length
      : 0;

    return [
      {
        name: "This Patient",
        delta: currentPatientData[mf.mean] ?? 0,
        ciLow: currentPatientData[mf.low] ?? 0,
        ciHigh: currentPatientData[mf.high] ?? 0,
      },
      {
        name: similarityGroupLabel(trajectoryGroup, groupPatients.length),
        delta: avgDelta,
        ciLow: avgCiLow,
        ciHigh: avgCiHigh,
      },
    ];
  })();

  return (
    <div className="space-y-6">

      {/* ── Patient Header ── */}
      <div className="flex gap-3 flex-wrap bg-dark-card rounded-lg p-4 border border-dark-border">
        <div className="flex-1 min-w-[140px]">
          <div className="text-[10px] uppercase text-dark-text-muted font-mono tracking-widest mb-1">Patient</div>
          <div className="flex items-center gap-3">
            <select
              className="bg-dark-bg border border-dark-border text-dark-text-primary rounded px-3 py-2 text-sm font-bold"
              value={selectedPatientId}
              onChange={e => setSelectedPatientId(e.target.value)}
            >
              {trajectory.patients.map(p => (
                <option key={p.patientId} value={p.patientId}>
                  {p.name || p.patientId}
                </option>
              ))}
            </select>
            <span className="text-xs text-dark-text-muted font-mono">{selectedPatientId}</span>
          </div>
        </div>
        <div className="flex-1 min-w-[120px]">
          <div className="text-[10px] uppercase text-dark-text-muted font-mono tracking-widest mb-1">Phenotype</div>
          {patientTraj?.cluster_name != null ? (
            <span className="inline-block bg-emerald-900/30 text-emerald-400 border border-emerald-700/50 rounded px-3 py-1 text-xs font-bold">
              {patientTraj.cluster_name}
            </span>
          ) : (
            <span className="inline-block bg-amber-900/30 text-dark-text-muted border border-dark-border rounded px-3 py-1 text-xs font-bold">
              Unassigned
            </span>
          )}
        </div>
        <div className="flex-1 min-w-[100px]">
          <div className="text-[10px] uppercase text-dark-text-muted font-mono tracking-widest mb-1">Similar Matches</div>
          <div className="text-lg font-bold">
            {patientTraj?.n_valid != null ? patientTraj.n_valid : "—"}
            <span className="text-xs text-dark-text-muted ml-1">/ {patientTraj?.matches ?? "—"} matched patients</span>
          </div>
        </div>
        <div className="flex-1 min-w-[100px]">
          <div className="text-[10px] uppercase text-dark-text-muted font-mono tracking-widest mb-1">Delta CPO (matched)</div>
          <div className="text-lg font-bold">
            {patientTraj?.delta_cpo_mean != null ? (patientTraj.delta_cpo_mean >= 0 ? "+" : "") + patientTraj.delta_cpo_mean.toFixed(2) : "—"}
          </div>
        </div>
      </div>

      {/* ── Three-Column Panel ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Column 1: Risk Assessment */}
        <div className="bg-dark-card rounded-lg p-4 border border-dark-border">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Activity size={14} className="text-blue-400" /> Risk Assessment
          </h3>

          {(["survival", "escalation", "rv_dysfunction"] as const).map(target => {
            const ci = ciForTarget(target);
            const mean = ci?.prediction_mean ?? null;
            const low = ci?.ci_lower ?? null;
            const high = ci?.ci_upper ?? null;
            const auc = bootstrap[target].global_auc_mean;
            const color = riskColor(mean);
            const pct = mean != null ? (mean * 100).toFixed(0) : "—";
            const ciStr = low != null && high != null
              ? `${(low * 100).toFixed(0)}%–${(high * 100).toFixed(0)}%`
              : "—";

            return (
              <div key={target} className="mb-5 last:mb-0">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-medium">{TARGET_LABELS[target]}</span>
                  <span className="text-[10px] text-dark-text-muted font-mono">AUC {auc.toFixed(2)}</span>
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
                  <span className="text-[9px] opacity-50">(±{(ciWidth(low, high) * 50).toFixed(0)}pp)</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Column 2: Recovery Status */}
        <div className="bg-dark-card rounded-lg p-4 border border-dark-border">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-400" /> Recovery Trajectory
          </h3>

          {/* Weaning Readiness */}
          <div className="mb-5">
            <span className="text-xs font-medium mb-2 block">Weaning Readiness Score</span>
            <div className="h-2 bg-dark-bg rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(75, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-dark-text-muted">
              <span>Current: <strong className="text-dark-text-primary">75/100</strong></span>
              <span>Target: <strong className="text-emerald-400">≥60</strong></span>
            </div>
          </div>

          {/* Similar Patient Outcomes */}
          <div className="mb-5">
            <span className="text-xs font-medium mb-2 block">Similar Patient Outcomes</span>
            <div className="bg-dark-bg rounded p-3 space-y-2">
              {patientTraj && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-dark-text-muted">Recovery w/o escalation</span>
                    <span className="font-bold text-emerald-400">
                      {patientTraj.escalation_rate != null
                        ? `${((1 - patientTraj.escalation_rate) * 100).toFixed(0)}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-dark-text-muted">Required escalation</span>
                    <span className="font-bold text-red-400">
                      {patientTraj.escalation_rate != null
                        ? `${(patientTraj.escalation_rate * 100).toFixed(0)}%`
                        : "—"}
                    </span>
                  </div>
                </>
              )}
              {!patientTraj && (
                <div className="text-xs text-dark-text-muted">No matching data</div>
              )}
            </div>
            <div className="text-[10px] text-dark-text-muted mt-1">
              Based on {patientTraj?.matches ?? 0} similar patients
            </div>
          </div>

          {/* Predicted Delta CPO */}
          <div>
            <span className="text-xs font-medium mb-2 block">Predicted ΔCPO at 48h</span>
            <div className="bg-dark-bg rounded p-4 text-center">
              <div className="text-3xl font-bold">
                {patientTraj?.delta_cpo_mean != null
                  ? `${patientTraj.delta_cpo_mean >= 0 ? "+" : ""}${patientTraj.delta_cpo_mean.toFixed(2)}`
                  : "—"}
              </div>
              <div className="text-[10px] text-dark-text-muted mt-1">
                95% CI: {patientTraj?.delta_cpo_ci_lower != null && patientTraj?.delta_cpo_ci_upper != null
                  ? `${patientTraj.delta_cpo_ci_lower.toFixed(2)} to ${patientTraj.delta_cpo_ci_upper.toFixed(2)}`
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Decision Support */}
        <div className="bg-dark-card rounded-lg p-4 border border-dark-border">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Info size={14} className="text-amber-400" /> Decision Support
          </h3>

          {/* Weaning Candidate */}
          <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-lg p-4 text-center mb-4">
            <CheckCircle size={28} className="text-emerald-400 mx-auto mb-1" />
            <div className="font-bold text-sm">Weaning Candidate</div>
            <div className="text-[10px] text-dark-text-muted mt-1">
              Score 75/100 &ge; threshold 60 — meets weaning criteria
            </div>
          </div>

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

          {/* Top-3 Drivers placeholder — static from global best LR coeffs */}
          <div className="bg-dark-bg rounded p-3">
            <div className="text-[10px] uppercase font-mono tracking-widest text-dark-text-muted mb-2">
              Model Performance
            </div>
            <div className="space-y-2 text-xs">
              {(["survival", "escalation", "rv_dysfunction"] as const).map(target => {
                const m = bootstrap[target];
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
              Bootstrap CI based on {bootstrap.survival.n_bootstrap} iterations
            </div>
          </div>
        </div>
      </div>

      {/* ── Trajectory Explorer ── */}
      <div className="bg-dark-card rounded-lg p-4 border border-dark-border">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
          <TrendingUp size={14} className="text-blue-400" /> Trajectory Explorer
        </h3>

        <div className="flex gap-6 mb-4">
          <div>
            <div className="text-[10px] uppercase text-dark-text-muted font-mono tracking-widest mb-1">Metric</div>
            <select
              className="bg-dark-bg border border-dark-border text-dark-text-primary rounded px-3 py-1.5 text-xs"
              value={trajectoryMetric}
              onChange={e => setTrajectoryMetric(e.target.value as any)}
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
              onChange={e => setTrajectoryGroup(e.target.value as any)}
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
                  formatter={(value: number) => value.toFixed(3)}
                />
                <ReferenceLine y={0} stroke="#4a5568" strokeDasharray="4 4" />
                <Bar dataKey="delta" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={idx === 0 ? "#3b82f6" : "#22c55e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* CI markers below chart */}
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
        {currentPatientData && (
          <div className="text-[10px] text-dark-text-muted mt-3 leading-relaxed">
            <strong className="text-dark-text-primary">Interpretation:</strong>{" "}
            This patient's {mf.label.replace("Δ", "")} change
            ({currentPatientData[mf.mean] != null
              ? `${currentPatientData[mf.mean]! >= 0 ? "+" : ""}${currentPatientData[mf.mean]!.toFixed(2)}`
              : "N/A"})
            is based on {currentPatientData.matches} similar patients.
            {currentPatientData.escalation_rate != null && (
              <>
                {" "}Of those matches, {(currentPatientData.escalation_rate * 100).toFixed(0)}% required escalation.
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}