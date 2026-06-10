import React, { useState, useEffect, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis } from "recharts";
import { cn } from "@/src/lib/utils";
import InfoTip from "./InfoTip";

interface PVLoopAnalysis {
  auc: number;
  n: number;
  n_pos: number;
  feature_names: string[];
  coefficients: Record<string, number>;
  odds_ratios: Record<string, number>;
  roc: { fpr: number[]; tpr: number[]; thresholds: number[] };
}

interface SHAPResult {
  feature_importance: Record<string, number>;
  ees_ea_rank: number | null;
  n_features: number;
  patient_shap: Array<{
    mrn: string;
    name: string;
    ees_ea_value: number | null;
    ees_ea_shap: number | null;
    prediction_probability: number;
    actual: number;
  }>;
}

interface PatientPV {
  id: string;
  name: string;
  eesEa?: number;
  ees?: number;
  ea?: number;
  esp?: number;
  edp?: number;
  pmax?: number;
  esv?: number;
  edv?: number;
  pvSV?: number;
  dpDtMax?: number;
  dpDtMin?: number;
  recoveryScore: number;
  riskScores?: { escalation?: number };
}

interface PVLoopPageProps {
  patients?: Array<PatientPV>;
}

function computeDerivedPV(m: Partial<{ ees: number; ea: number; esp: number; edp: number; pmax: number }>) {
  const ees = m.ees;
  const ea = m.ea;
  const esp = m.esp ?? 150;
  const edp = m.edp ?? 15;
  const pmax = m.pmax ?? esp;
  const eesEa = (ees != null && ea != null && ea > 0) ? ees / ea : undefined;
  return { ees, ea, esp, edp, pmax, eesEa };
}

function getEesEaZone(e: number | undefined) {
  if (e === undefined || e === null) return { label: "N/A", color: "text-gray-400", bg: "bg-gray-500/20", border: "border-gray-500/30" };
  if (e < 1.0) return { label: "High RV Load", color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" };
  if (e < 1.5) return { label: "Intermediate", color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" };
  if (e < 2.5) return { label: "Normal", color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" };
  return { label: "Favorable", color: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" };
}

const ZONE_LEGENDS = [
  { range: "Ees/Ea < 1.0", label: "High RV Load", color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" },
  { range: "1.0 – 1.5", label: "Intermediate", color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" },
  { range: "1.5 – 2.5", label: "Normal", color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" },
  { range: "> 2.5", label: "Favorable", color: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" },
];

export default function PVLoopPage({ patients }: PVLoopPageProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "patients">("overview");
  const [shapData, setShapData] = useState<SHAPResult | null>(null);
  const [pvModelData, setPvModelData] = useState<PVLoopAnalysis | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientPV | null>(null);

  useEffect(() => {
    if (!shapData) {
      fetch("/ml_output/pv_loop_shap.json")
        .then(r => r.json())
        .then(setShapData)
        .catch(() => {});
    }
  }, [shapData]);

  useEffect(() => {
    if (!pvModelData) {
      fetch("/ml_output/pv_loop_escalation_model.json")
        .then(r => r.json())
        .then(setPvModelData)
        .catch(() => {});
    }
  }, [pvModelData]);

  const patientList = patients || [];

  const pvData = useMemo(() => {
    return patientList
      .filter(p => p.ees != null && p.ea != null && p.ea > 0)
      .map(p => {
        const m = computeDerivedPV(p);
        const zone = getEesEaZone(m.eesEa);
        const shapEntry = shapData?.patient_shap?.find(s =>
          p.name.includes(s.name) || s.name.includes(p.name.split(" ")[0])
        );
        return { ...p, ...m, zone, shapEntry };
      });
  }, [patientList, shapData]);

  const pvChartData = useMemo(() => {
    return pvData.map(p => ({
      name: p.name,
      ees: p.ees,
      ea: p.ea,
      eesEa: p.eesEa,
      recoveryScore: p.recoveryScore,
      zone: p.zone,
    }));
  }, [pvData]);

  const getCellColor = useCallback((eesEa: number) => {
    if (eesEa >= 2.5) return "#60a5fa";
    if (eesEa >= 1.5) return "#34d399";
    if (eesEa >= 1.0) return "#fbbf24";
    return "#f87171";
  }, []);

  const sortedByEesEa = useMemo(() =>
    [...pvData].sort((a, b) => b.eesEa - a.eesEa),
    [pvData]
  );

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text-primary p-6 space-y-8">
      {/* Header */}
      <div className="border-b border-dark-border pb-4">
        <h1 className="text-3xl font-light tracking-tight">
          Pressure-Volume <span className="font-bold">Loop Analysis</span>
        </h1>
        <p className="text-xs font-mono text-dark-text-muted mt-1 uppercase tracking-widest">
          Ees/Ea ratio &bull; 4-feature Logistic Regression &bull; SHAP explainability
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-dark-border pb-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all",
            activeTab === "overview"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-dark-text-muted hover:text-dark-text-primary"
          )}
        >
          Overview & Visualizations
        </button>
        <button
          onClick={() => setActiveTab("patients")}
          className={cn(
            "px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all",
            activeTab === "patients"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-dark-text-muted hover:text-dark-text-primary"
          )}
        >
          Patient Analysis
        </button>
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === "overview" && (
        <>
          {/* Model Summary */}
          {pvModelData && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-dark-card border border-dark-border rounded-lg p-4">
                <div className="text-[10px] font-mono text-dark-text-muted uppercase tracking-widest mb-1">PV Loop AUC</div>
                <div className="text-3xl font-bold text-emerald-400 tabular-nums">{pvModelData.auc.toFixed(2)}</div>
              </div>
              <div className="bg-dark-card border border-dark-border rounded-lg p-4">
                <div className="text-[10px] font-mono text-dark-text-muted uppercase tracking-widest mb-1">N Patients</div>
                <div className="text-3xl font-bold tabular-nums">{pvModelData.n}</div>
              </div>
              <div className="bg-dark-card border border-dark-border rounded-lg p-4">
                <div className="text-[10px] font-mono text-dark-text-muted uppercase tracking-widest mb-1">Escalation Positives</div>
                <div className="text-3xl font-bold text-orange-400 tabular-nums">{pvModelData.n_pos}</div>
              </div>
              <div className="bg-dark-card border border-dark-border rounded-lg p-4">
                <div className="text-[10px] font-mono text-dark-text-muted uppercase tracking-widest mb-1">Ees/Ea Rank (SHAP)</div>
                <div className="text-3xl font-bold tabular-nums">
                  {shapData?.ees_ea_rank ? `#${shapData.ees_ea_rank}` : "—"}
                </div>
              </div>
            </div>
          )}

          {/* Zone Legend */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ZONE_LEGENDS.map(zone => (
              <div key={zone.label} className={cn("border rounded-lg p-3", zone.bg, zone.border)}>
                <div className="text-[10px] text-dark-text-muted uppercase tracking-widest">{zone.range}</div>
                <div className={cn("text-sm font-bold", zone.color)}>{zone.label}</div>
              </div>
            ))}
          </div>

          {/* Ees/Ea Bar Chart */}
          {pvChartData.length > 0 && (
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" /> Ees/Ea Ratio by Patient <InfoTip>Ees/Ea is the ratio of heart contractility (Ees) to arterial afterload (Ea). It tells you how well the heart is coupled to the circulatory system. A ratio around 1.0 is normal. Lower means the heart is struggling against the load it has to pump against — a sign of ventricular-arterial uncoupling. Green = good coupling, red = poor coupling.</InfoTip>
              </h3>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pvChartData} margin={{ bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fontFamily: "monospace", fill: "#718096" }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontFamily: "monospace", fill: "#718096" }}
                      label={{ value: "Ees/Ea", angle: -90, position: "insideLeft", fill: "#718096", fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1A1D24", border: "1px solid #2D3748", borderRadius: "8px", color: "#E2E8F0" }}
                      itemStyle={{ color: "#E2E8F0", fontSize: "12px" }}
                      labelStyle={{ color: "#E2E8F0", fontWeight: 600 }}
                    />
                    <Bar dataKey="eesEa" radius={[2, 2, 0, 0]}>
                      {pvChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getCellColor(entry.eesEa)} fillOpacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-[10px] font-mono text-dark-text-muted">
                Showing {pvData.length} of {patientList.length} patients with available Ees/Ea measurements. Patients without PV loop data are excluded.
              </div>
            </div>
          )}

          {/* Coefficient Plot */}
          {pvModelData && Object.keys(pvModelData.coefficients).length > 0 && (
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" /> Logistic Regression Coefficients <InfoTip>These bars show which clinical measurements most strongly predict whether a patient will need escalation (ECMO/LVAD). Bars pointing right = higher risk, left = lower risk. Bigger bar = more influential. Red = pushes risk up, green = pushes risk down.</InfoTip>
              </h3>
              <div className="space-y-3">
                {Object.entries(pvModelData.coefficients).map(([feat, coef]) => {
                  const numCoef = coef as number;
                  const isPositive = numCoef > 0;
                  const absCoef = Math.abs(numCoef);
                  const maxAbs = Math.max(...Object.values(pvModelData.coefficients).map(v => Math.abs(v as number)));
                  const widthPct = (absCoef / maxAbs) * 100;
                  return (
                    <div key={feat} className="flex items-center gap-4">
                      <div className="w-32 text-xs font-mono text-dark-text-secondary text-right truncate" title={feat}>{feat}</div>
                      <div className="flex-1 h-6 bg-dark-bg rounded overflow-hidden relative">
                        <div
                          className={cn("h-full transition-all absolute", isPositive ? "bg-red-500/60 left-1/2" : "bg-emerald-500/60 right-1/2")}
                          style={{ width: `${widthPct / 2}%` }}
                        />
                      </div>
                      <div className={cn("w-16 text-xs font-mono text-right", isPositive ? "text-red-400" : "text-emerald-400")}>
                        {numCoef.toFixed(3)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 text-[10px] text-dark-text-muted font-mono flex gap-6">
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-500/60 inline-block" /> Positive = Higher escalation risk</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500/60 inline-block" /> Negative = Lower escalation risk</span>
              </div>
            </div>
          )}

          {/* Interactive Visualizations — Built from SHAP + model data */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Panel 1: Ees/Ea vs Escalation Probability (Scatter) */}
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" /> Ees/Ea vs Escalation Risk <InfoTip>Each dot is a patient. X-axis shows Ees/Ea ratio (heart-vessel coupling). Y-axis shows the model-predicted probability of MCS escalation. Green dots = patients who remained stable. Red dots = patients who required ECMO/LVAD escalation. Lower Ees/Ea generally corresponds to higher escalation risk.</InfoTip>
              </h3>
              {(() => {
                const scatterPoints = shapData?.patient_shap
                  ?.filter(p => p.ees_ea_value != null)
                  .map(p => ({
                    mrn: p.mrn,
                    name: p.name,
                    eesEa: p.ees_ea_value!,
                    escalationProb: p.prediction_probability,
                    actual: p.actual,
                  })) || [];
                return scatterPoints.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
                        <XAxis type="number" dataKey="eesEa" name="Ees/Ea" tick={{ fontSize: 10, fill: "#718096" }} axisLine={false} tickLine={false} label={{ value: "Ees/Ea", position: "bottom", fontSize: 10, fill: "#718096" }} domain={[0, 'auto']} />
                        <YAxis type="number" dataKey="escalationProb" name="Escalation Probability" tick={{ fontSize: 10, fill: "#718096" }} axisLine={false} tickLine={false} label={{ value: "Escalation Risk", angle: -90, position: "left", fontSize: 10, fill: "#718096" }} domain={[0, 1]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                        <ZAxis range={[50, 50]} />
                        <Tooltip content={({ active, payload }: any) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const p = payload[0]?.payload;
                          if (!p) return null;
                          return (
                            <div className="bg-dark-card border border-dark-border rounded-lg shadow-2xl p-3 min-w-[180px]">
                              <div className="text-sm font-semibold text-dark-text-primary mb-2 pb-2 border-b border-dark-border">{p.name}</div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-dark-text-muted">Ees/Ea</span><span className="font-mono text-dark-text-primary">{p.eesEa.toFixed(3)}</span></div>
                                <div className="flex justify-between"><span className="text-dark-text-muted">Escalation Risk</span><span className="font-mono text-orange-400">{(p.escalationProb * 100).toFixed(1)}%</span></div>
                                <div className="flex justify-between"><span className="text-dark-text-muted">Outcome</span><span className={cn("font-mono", p.actual === 1 ? "text-red-400" : "text-emerald-400")}>{p.actual === 1 ? "Escalated" : "Stable"}</span></div>
                              </div>
                            </div>
                          );
                        }} />
                        <Scatter data={scatterPoints}>
                          {scatterPoints.map((p, i) => (
                            <Cell key={i} fill={p.actual === 1 ? "#f87171" : "#34d399"} fillOpacity={0.7} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <img src="/ml_output/shap_escalation_full.png" alt="SHAP Summary" className="w-full rounded border border-dark-border" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                );
              })()}
            </div>

            {/* Panel 2: SHAP Feature Importance (Horizontal Bar) */}
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full" /> SHAP Feature Importance <InfoTip>Top clinical features ranked by their impact on the escalation risk model. Longer bars = more influence. Features like prior MCS escalation history, LV size, and hemoglobin change are the strongest signals. Hover for exact SHAP importance values.</InfoTip>
              </h3>
              {(() => {
                if (!shapData) return null;
                const topFeatures = Object.entries(shapData.feature_importance)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 12)
                  .map(([feature, val]) => ({ feature, value: val as number }));
                return topFeatures.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topFeatures} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 110 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#2D3748" />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "#718096" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="feature" tick={{ fontSize: 10, fill: "#E2E8F0" }} axisLine={false} tickLine={false} width={100} />
                        <Tooltip content={({ active, payload }: any) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const p = payload[0];
                          if (!p) return null;
                          return (
                            <div className="bg-dark-card border border-dark-border rounded-lg shadow-2xl p-3 min-w-[160px]">
                              <div className="text-xs text-dark-text-muted mb-1">{p.payload.feature}</div>
                              <div className="font-mono text-dark-text-primary text-sm">{(p.value as number).toFixed(4)}</div>
                            </div>
                          );
                        }} />
                        <Bar dataKey="value" fill="#f97316" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <img src="/ml_output/shap_escalation_full.png" alt="SHAP Summary" className="w-full rounded border border-dark-border" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                );
              })()}
            </div>

            {/* Panel 3: Ees/Ea SHAP Dependence (Scatter) */}
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full" /> Ees/Ea SHAP Dependence <InfoTip>Shows how the SHAP value (impact on escalation risk) changes as Ees/Ea varies. Each dot is a patient. Values above zero (red zone) mean Ees/Ea pushed the model toward predicting escalation. Below zero (green zone) means it pushed toward no escalation. The trend shows higher Ees/Ea = lower escalation risk.</InfoTip>
              </h3>
              {(() => {
                const depPoints = shapData?.patient_shap
                  ?.filter(p => p.ees_ea_value != null && p.ees_ea_shap != null)
                  .map(p => ({
                    mrn: p.mrn,
                    name: p.name,
                    eesEa: p.ees_ea_value!,
                    shapValue: p.ees_ea_shap!,
                    actual: p.actual,
                  })) || [];
                return depPoints.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
                        <XAxis type="number" dataKey="eesEa" name="Ees/Ea" tick={{ fontSize: 10, fill: "#718096" }} axisLine={false} tickLine={false} label={{ value: "Ees/Ea", position: "bottom", fontSize: 10, fill: "#718096" }} domain={[0, 'auto']} />
                        <YAxis type="number" dataKey="shapValue" name="SHAP Value" tick={{ fontSize: 10, fill: "#718096" }} axisLine={false} tickLine={false} label={{ value: "SHAP Value", angle: -90, position: "left", fontSize: 10, fill: "#718096" }} />
                        <ZAxis range={[50, 50]} />
                        <Tooltip content={({ active, payload }: any) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const p = payload[0]?.payload;
                          if (!p) return null;
                          return (
                            <div className="bg-dark-card border border-dark-border rounded-lg shadow-2xl p-3 min-w-[180px]">
                              <div className="text-sm font-semibold text-dark-text-primary mb-2 pb-2 border-b border-dark-border">{p.name}</div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-dark-text-muted">Ees/Ea</span><span className="font-mono text-dark-text-primary">{p.eesEa.toFixed(3)}</span></div>
                                <div className="flex justify-between"><span className="text-dark-text-muted">SHAP Value</span><span className={cn("font-mono", (p.shapValue as number) >= 0 ? "text-red-400" : "text-emerald-400")}>{(p.shapValue as number).toFixed(4)}</span></div>
                                <div className="flex justify-between"><span className="text-dark-text-muted">Outcome</span><span className={cn("font-mono", p.actual === 1 ? "text-red-400" : "text-emerald-400")}>{p.actual === 1 ? "Escalated" : "Stable"}</span></div>
                              </div>
                            </div>
                          );
                        }} />
                        <Scatter data={depPoints}>
                          {depPoints.map((p, i) => (
                            <Cell key={i} fill={p.shapValue >= 0 ? "#f87171" : "#34d399"} fillOpacity={0.7} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <img src="/ml_output/shap_dependence_ees_ea.png" alt="SHAP Dependence" className="w-full rounded border border-dark-border" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                );
              })()}
            </div>

            {/* Panel 4: Coefficient / Odds Ratios (Horizontal Bar) */}
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-teal-500 rounded-full" /> Top SHAP Features for Escalation <InfoTip>Top 10 features driving escalation risk in this cohort, ranked by SHAP importance. Features like prior MCS escalation, left ventricular dimensions, and hemoglobin trends dominate the model's decisions. Bars with longer reach have more influence on whether a patient is flagged as needing escalation.</InfoTip>
              </h3>
              {(() => {
                if (!shapData) return null;
                const topFeat = Object.entries(shapData.feature_importance)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 10)
                  .map(([feature, val]) => ({ feature: feature.replace(/_/g, " "), value: val as number }));
                return topFeat.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topFeat} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 110 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#2D3748" />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "#718096" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="feature" tick={{ fontSize: 10, fill: "#E2E8F0" }} axisLine={false} tickLine={false} width={100} />
                        <Tooltip content={({ active, payload }: any) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const p = payload[0];
                          if (!p) return null;
                          return (
                            <div className="bg-dark-card border border-dark-border rounded-lg shadow-2xl p-3 min-w-[160px]">
                              <div className="text-xs text-dark-text-muted mb-1">{p.payload.feature}</div>
                              <div className="font-mono text-dark-text-primary text-sm">{(p.value as number).toFixed(4)}</div>
                            </div>
                          );
                        }} />
                        <Bar dataKey="value" fill="#14b8a6" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-dark-text-muted text-sm">No SHAP data available.</div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* ===== PATIENTS TAB ===== */}
      {activeTab === "patients" && (
        <>
          {pvData.length === 0 ? (
            <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center">
              <p className="text-dark-text-muted">No PV Loop data available for this cohort.</p>
            </div>
          ) : (
            <>
              {/* Summary bar */}
              <div className="flex items-center gap-4 text-xs font-mono text-dark-text-muted">
                <span>{pvData.length} patients with PV data</span>
                <span className="w-px h-4 bg-dark-border" />
                <span className="text-red-400">{pvData.filter(p => p.eesEa < 1.0).length} high RV load</span>
                <span className="w-px h-4 bg-dark-border" />
                <span className="text-emerald-400">{pvData.filter(p => p.eesEa >= 1.5).length} normal/favorable</span>
              </div>

              {/* Patient Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedByEesEa.map((p, idx) => (
                  <button
                    key={p.id || idx}
                    onClick={() => setSelectedPatient(selectedPatient?.id === p.id ? null : p)}
                    className={cn(
                      "bg-dark-card border rounded-xl p-5 text-left transition-all",
                      selectedPatient?.id === p.id
                        ? "ring-2 ring-blue-500 bg-dark-accent border-blue-500/30"
                        : "border-dark-border hover:bg-dark-accent/50"
                    )}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-[10px] font-mono text-dark-text-muted uppercase tracking-widest mb-1">Patient</div>
                        <div className="text-sm font-bold text-dark-text-primary">{p.name}</div>
                      </div>
                      <div className={cn("text-2xl font-bold tabular-nums", p.zone.color)}>
                        {(p as any).eesEa?.toFixed(2) ?? "—"}
                      </div>
                    </div>
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-dark-text-muted">Ees</span>
                        <span className="text-dark-text-secondary tabular-nums">{(p as any).ees?.toFixed(3) ?? "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dark-text-muted">Ea</span>
                        <span className="text-dark-text-secondary tabular-nums">{(p as any).ea?.toFixed(3) ?? "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dark-text-muted">ESP</span>
                        <span className="text-dark-text-secondary tabular-nums">{(p as any).esp?.toFixed(0) ?? "—"} mmHg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dark-text-muted">EDP</span>
                        <span className="text-dark-text-secondary tabular-nums">{(p as any).edp?.toFixed(0) ?? "—"} mmHg</span>
                      </div>
                      {(p as any).shapEntry && (
                        <div className="flex justify-between pt-1 border-t border-dark-border/50">
                          <span className="text-dark-text-muted">Escalation Risk</span>
                          <span className={cn("tabular-nums font-bold", ((p as any).shapEntry?.prediction_probability || 0) > 0.3 ? "text-orange-400" : "text-emerald-400")}>
                            {((p as any).shapEntry?.prediction_probability * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border", p.zone.color, p.zone.bg, p.zone.border)}>
                          {p.zone.label}
                        </span>
                        <span className="text-dark-text-muted">Recovery: {(p as any).recoveryScore?.toFixed(0) ?? "—"}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Patient Detail Modal (shown for both tabs) */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPatient(null)}>
          <div
            className="bg-dark-card border border-dark-border rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold mb-1">PV Loop Detail — {selectedPatient.name}</h2>
                <p className="text-sm text-dark-text-secondary">
                  Ees/Ea ratio and derived hemodynamic parameters
                </p>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                className="text-dark-text-muted hover:text-dark-text-primary text-xs uppercase tracking-widest"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-xs font-mono">
              {[
                { label: "Ees (End-Systolic Elastance)", value: (selectedPatient as any).ees?.toFixed(3) ?? "N/A", unit: "mmHg/mL" },
                { label: "Ea (Arterial Elastance)", value: (selectedPatient as any).ea?.toFixed(3) ?? "N/A", unit: "mmHg/mL" },
                { label: "Ees/Ea Ratio", value: (selectedPatient as any).eesEa?.toFixed(3) ?? "N/A", unit: "" },
                { label: "ESP (End-Systolic Pressure)", value: (selectedPatient as any).esp?.toFixed(0) ?? "N/A", unit: "mmHg" },
                { label: "EDP (End-Diastolic Pressure)", value: (selectedPatient as any).edp?.toFixed(0) ?? "N/A", unit: "mmHg" },
                { label: "Pmax", value: (selectedPatient as any).pmax?.toFixed(0) ?? "N/A", unit: "mmHg" },
                { label: "ESV (End-Systolic Volume)", value: (selectedPatient as any).esv?.toFixed(1) ?? "N/A", unit: "mL" },
                { label: "EDV (End-Diastolic Volume)", value: (selectedPatient as any).edv?.toFixed(1) ?? "N/A", unit: "mL" },
                { label: "Stroke Volume (PV)", value: (selectedPatient as any).pvSV?.toFixed(1) ?? "N/A", unit: "mL" },
              ].map(metric => (
                <div key={metric.label} className="flex justify-between items-center border-b border-dark-border/50 py-2">
                  <span className="text-dark-text-muted">{metric.label}</span>
                  <span className="text-dark-text-primary font-bold tabular-nums">
                    {metric.value} {metric.unit && <span className="text-dark-text-muted text-[10px]">{metric.unit}</span>}
                  </span>
                </div>
              ))}
            </div>
            {/* SHAP info for selected patient */}
            {(() => {
              const shapEntry = shapData?.patient_shap?.find(s =>
                selectedPatient.name.includes(s.name) || s.name.includes(selectedPatient.name.split(" ")[0])
              );
              if (!shapEntry) return null;
              return (
                <div className="mt-6 pt-4 border-t border-dark-border">
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-3 text-dark-text-secondary">SHAP Explainability</h4>
                  <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                    <div>
                      <div className="text-dark-text-muted text-[10px] uppercase tracking-widest">Ees/Ea SHAP Value</div>
                      <div className={cn("font-bold tabular-nums", (shapEntry.ees_ea_shap || 0) > 0 ? "text-red-400" : "text-emerald-400")}>
                        {shapEntry.ees_ea_shap?.toFixed(4) ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-dark-text-muted text-[10px] uppercase tracking-widest">Escalation Probability</div>
                      <div className={cn("font-bold tabular-nums", shapEntry.prediction_probability > 0.3 ? "text-orange-400" : "text-emerald-400")}>
                        {(shapEntry.prediction_probability * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-dark-text-muted text-[10px] uppercase tracking-widest">Actual Outcome</div>
                      <div className={cn("font-bold", shapEntry.actual === 1 ? "text-red-400" : "text-emerald-400")}>
                        {shapEntry.actual === 1 ? "Escalated" : "Stable"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
