import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ScatterChart, Scatter, ZAxis, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend,
} from "recharts";
import { TrendingUp, Activity, AlertTriangle, BarChart3, FlaskConical, Users, Heart, Brain, Info, ArrowLeft } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { motion } from "motion/react";
import InfoTip from "./InfoTip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PatientDelta {
  patientId: string;
  metric: string;
  unit: string;
  pre: number | null;
  post: number | null;
  delta: number | null;
  outcome: string;
}

interface StatTest {
  metric: string;
  survivedMean: number;
  expiredMean: number;
  survivedN: number;
  expiredN: number;
  pValue: number;
  significant: boolean;
}

interface IndicationStat {
  indication: string;
  total: number;
  survived: number;
  expired: number;
  mortalityRate: number;
}

interface ResponderProfileVar {
  metric: string;
  unit: string;
  responderMean: number;
  nonResponderMean: number;
  pValue: number;
  significant: boolean;
}

interface ResponderPatient {
  patientId: string;
  outcome: string;
  isResponder: boolean;
  cpoDelta: number;
  lactateDelta: number;
}

interface ScatterPoint {
  patientId: string;
  cpoDelta: number;
  tdcoDelta: number;
  outcome: string;
}

interface PVValue {
  patientId: string;
  metric: string;
  unit: string;
  value: number | null;
  outcome: string;
}

interface MLFeature {
  name: string;
  description: string;
  consensus: number;
}

interface EffectivenessData {
  survival: {
    byIndication: IndicationStat[];
    overall: { total: number; survived: number; expired: number; mortalityRate: number };
    supportDuration: Record<string, { mean: number; median: number }>;
  };
  hemodynamics: { deltas: PatientDelta[]; statisticalTests: StatTest[]; scatterData?: ScatterPoint[] };
  labs: { deltas: PatientDelta[]; statisticalTests: StatTest[] };
  responders: {
    summary: { totalResponders: number; totalNonResponders: number; responderRate: number };
    profileVariables: ResponderProfileVar[];
    patients: ResponderPatient[];
  };
  ventricularMechanics: { values: PVValue[]; statisticalTests: StatTest[] };
  mlCrossReference: { features: MLFeature[] };
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const METRIC_COLORS: Record<string, string> = {
  CPO: "#34d399",
  TDCO: "#60a5fa",
  "RV-CPO": "#c084fc",
  PCWP: "#f87171",
  MAP: "#fbbf24",
  RA: "#fb923c",
  PAPI: "#f472b6",
  PVR: "#2dd4bf",
  HR: "#38bdf8",
  SV: "#a78bfa",
  Lactate: "#f87171",
  eGFR: "#34d399",
  Creatinine: "#fb923c",
  HCO3: "#60a5fa",
  Hemoglobin: "#f472b6",
  AST: "#fbbf24",
  ALT: "#c084fc",
  Bilirubin: "#fb923c",
};

const SURVIVED_COLOR = "#34d399";
const EXPIRED_COLOR = "#f87171";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SurvivalSection({ data }: { data: IndicationStat[] }) {
  const chartData = data.map(d => ({
    name: d.indication.length > 15 ? d.indication.slice(0, 15) + "…" : d.indication,
    Survived: d.survived,
    Expired: d.expired,
    rate: d.mortalityRate,
  }));

  return (
    <div className="bg-dark-card border border-dark-border p-6 rounded-xl shadow-2xl">
      <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
        <TrendingUp size={18} className="text-purple-400" />
        Survival by Indication <InfoTip>This chart shows survival outcomes broken down by the reason Impella was implanted (e.g., AMI cardiogenic shock, acute decompensated heart failure). Each bar shows survived (green) vs. expired (red). The numbers below show the mortality rate for each indication group.</InfoTip>
      </h3>
      {chartData.length > 0 ? (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2D3748" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#718096" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#718096" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1A1D24", border: "1px solid #2D3748", borderRadius: "8px", color: "#E2E8F0" }}
                formatter={(value: number, name: string) => [value, name]}
              />
              <Bar dataKey="Survived" stackId="a" fill={SURVIVED_COLOR} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Expired" stackId="a" fill={EXPIRED_COLOR} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-dark-text-muted text-sm py-8 text-center">No survival data available</p>
      )}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        {data.map(d => (
          <div key={d.indication} className="bg-dark-accent rounded-lg p-3 text-center">
            <p className="text-xs text-dark-text-muted truncate">{d.indication}</p>
            <p className="text-lg font-semibold mt-1" style={{ color: d.mortalityRate > 20 ? EXPIRED_COLOR : SURVIVED_COLOR }}>
              {d.mortalityRate}%
            </p>
            <p className="text-[10px] text-dark-text-muted">{d.survived}/{d.total} survived</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HemodynamicSection({ data, outcomeFilter }: { data: EffectivenessData["hemodynamics"]; outcomeFilter: string }) {
  const [metric, setMetric] = useState("CPO");

  const metrics = [...new Set(data.deltas.map(d => d.metric))];

  // Filter deltas by outcome
  const filteredDeltas = data.deltas.filter(d =>
    outcomeFilter === "all" || d.outcome === outcomeFilter
  );

  // For the bar chart: mean delta by outcome for selected metric
  const metricDeltas = filteredDeltas.filter(d => d.metric === metric && d.delta !== null);
  const survivedDeltas = metricDeltas.filter(d => d.outcome === "survived").map(d => d.delta!);
  const expiredDeltas = metricDeltas.filter(d => d.outcome === "expired").map(d => d.delta!);

  const barChartData = [
    { name: "Survived", delta: survivedDeltas.length > 0 ? survivedDeltas.reduce((a, b) => a + b, 0) / survivedDeltas.length : 0, fill: SURVIVED_COLOR },
    { name: "Expired", delta: expiredDeltas.length > 0 ? expiredDeltas.reduce((a, b) => a + b, 0) / expiredDeltas.length : 0, fill: EXPIRED_COLOR },
  ];

  // Scatter data: CPO delta vs TDCO delta (pre-computed from Python to avoid duplicate patientId mismatches)
  const scatterData = data.scatterData?.filter(
    (s: ScatterPoint) => outcomeFilter === "all" || s.outcome === outcomeFilter
  ) ?? filteredDeltas
    .filter(d => d.metric === "CPO" && d.delta !== null)
    .map(cpo => {
      const tdco = filteredDeltas.find(d => d.metric === "TDCO" && d.patientId === cpo.patientId);
      return {
        patientId: cpo.patientId,
        cpoDelta: cpo.delta!,
        tdcoDelta: tdco?.delta ?? 0,
        outcome: cpo.outcome,
      };
    });

  // Custom tooltip for the scatter plot
  const TDCOScatterTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const p = payload[0]?.payload as ScatterPoint | undefined;
    if (!p) return null;
    const outcomeColor = p.outcome === "survived" ? SURVIVED_COLOR : EXPIRED_COLOR;
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg shadow-2xl p-3 min-w-[180px]">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-dark-border">
          <span className="text-sm font-semibold text-dark-text-primary">{p.patientId}</span>
          <span
            className="text-[10px] font-bold font-mono uppercase px-1.5 py-0.5 rounded"
            style={{ backgroundColor: outcomeColor + "20", color: outcomeColor }}
          >
            {p.outcome}
          </span>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-dark-text-muted">Δ CPO</span>
            <span className={cn("font-mono", p.cpoDelta >= 0 ? "text-emerald-400" : "text-red-400")}>
              {p.cpoDelta >= 0 ? "+" : ""}{p.cpoDelta.toFixed(3)} W
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-dark-text-muted">Δ TDCO</span>
            <span className={cn("font-mono", p.tdcoDelta >= 0 ? "text-emerald-400" : "text-red-400")}>
              {p.tdcoDelta >= 0 ? "+" : ""}{p.tdcoDelta.toFixed(3)} L/min
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Find the test result for selected metric
  const testResult = data.statisticalTests.find(t => t.metric === metric);

  return (
    <div className="bg-dark-card border border-dark-border p-6 rounded-xl shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Activity size={18} className="text-blue-400" />
          Hemodynamic Response <InfoTip>Shows how key hemodynamic measurements changed from pre- to post-Impella, split by survived vs. expired patients. Green bars = survivors, red = non-survivors. Positive delta means improvement. Click different metrics (CPO, MAP, PAPI etc.) to compare. The scatter plot on the right plots CPO change against cardiac output change.</InfoTip>
        </h3>
        <div className="flex gap-2 flex-wrap">
          {metrics.slice(0, 6).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={cn(
                "px-3 py-1 text-xs rounded transition-all",
                metric === m ? "bg-blue-600 text-white" : "bg-dark-accent text-dark-text-muted hover:text-dark-text-primary"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delta bar chart */}
        <div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2D3748" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#718096" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#718096" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1A1D24", border: "1px solid #2D3748", borderRadius: "8px", color: "#E2E8F0" }}
                />
                <Bar dataKey="delta" radius={[4, 4, 0, 0]}>
                  {barChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {testResult && (
            <div className="mt-2 text-xs text-dark-text-muted text-center">
              Mean delta: {metric} — Survived: {testResult.survivedMean.toFixed(3)}, Expired: {testResult.expiredMean.toFixed(3)}
              <span className={cn("ml-2", testResult.significant ? "text-emerald-400" : "")}>
                (p={testResult.pValue.toFixed(4)}{testResult.significant ? " ✓" : ""})
              </span>
            </div>
          )}
        </div>

        {/* Scatter plot: CPO vs TDCO */}
        <div>
          <p className="text-xs text-dark-text-muted mb-2 font-mono">CPO delta vs TDCO delta by outcome</p>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
                <XAxis type="number" dataKey="cpoDelta" name="Δ CPO" tick={{ fontSize: 9, fill: "#718096" }} axisLine={false} tickLine={false} />
                <YAxis type="number" dataKey="tdcoDelta" name="Δ TDCO" tick={{ fontSize: 9, fill: "#718096" }} axisLine={false} tickLine={false} />
                <ZAxis range={[40, 60]} />
                <Tooltip content={<TDCOScatterTooltip />} />
                <Scatter data={scatterData}>
                  {scatterData.map((p, i) => (
                    <Cell key={i} fill={p.outcome === "survived" ? SURVIVED_COLOR : EXPIRED_COLOR} fillOpacity={0.7} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function LabSection({ data, outcomeFilter }: { data: EffectivenessData["labs"]; outcomeFilter: string }) {
  const metrics = [...new Set(data.deltas.map(d => d.metric))].slice(0, 6);

  const chartData = metrics.map(m => {
    const surv = data.deltas.filter(d => d.metric === m && d.outcome === "survived" && d.delta !== null);
    const exp = data.deltas.filter(d => d.metric === m && d.outcome === "expired" && d.delta !== null);
    return {
      name: m,
      Survived: surv.length > 0 ? surv.reduce((a, b) => a + b.delta!, 0) / surv.length : 0,
      Expired: exp.length > 0 ? exp.reduce((a, b) => a + b.delta!, 0) / exp.length : 0,
    };
  });

  return (
    <div className="bg-dark-card border border-dark-border p-6 rounded-xl shadow-2xl">
      <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
        <FlaskConical size={18} className="text-emerald-400" />
        Lab Recovery (Mean Delta) <InfoTip>Shows the average change in lab values from pre- to post-Impella, split by survived (green) vs. expired (red). Positive means the lab value increased after support, negative means it decreased. For lactate and liver enzymes, decreasing is usually good. Below the chart, statistically significant differences are highlighted.</InfoTip>
      </h3>
      {chartData.length > 0 ? (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2D3748" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#718096" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#718096" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1A1D24", border: "1px solid #2D3748", borderRadius: "8px", color: "#E2E8F0" }}
              />
              <Bar dataKey="Survived" fill={SURVIVED_COLOR} radius={[2, 2, 0, 0]} />
              <Bar dataKey="Expired" fill={EXPIRED_COLOR} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-dark-text-muted text-sm py-8 text-center">No lab data available</p>
      )}
      <div className="mt-4 space-y-1">
        {data.statisticalTests.filter(t => t.pValue < 0.1).map(t => (
          <div key={t.metric} className="text-xs text-dark-text-muted flex items-center gap-2">
            <span className={cn("font-medium", t.significant ? "text-emerald-400" : "text-amber-400")}>
              {t.metric}
            </span>
            <span>Survived Δ={t.survivedMean.toFixed(3)}</span>
            <span>Expired Δ={t.expiredMean.toFixed(3)}</span>
            <span>p={t.pValue.toFixed(4)}{t.significant ? " ✓" : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResponderSection({ data }: { data: EffectivenessData["responders"] }) {
  const topVars = [...data.profileVariables]
    .sort((a, b) => a.pValue - b.pValue)
    .slice(0, 6);

  // For radar chart, normalize values to 0-1 range
  const allMeans = topVars.flatMap(v => [v.responderMean, v.nonResponderMean]);
  const maxVal = Math.max(...allMeans.map(Math.abs), 0.01);

  const radarData = topVars.map(v => ({
    metric: v.metric.length > 12 ? v.metric.slice(0, 12) + "…" : v.metric,
    Responder: v.responderMean / maxVal,
    "Non-Responder": v.nonResponderMean / maxVal,
    responderRaw: v.responderMean,
    nonResponderRaw: v.nonResponderMean,
    pValue: v.pValue,
    significant: v.significant,
  }));

  return (
    <div className="bg-dark-card border border-dark-border p-6 rounded-xl shadow-2xl">
      <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
        <Users size={18} className="text-amber-400" />
        Responder Profiling <InfoTip>Identifies which clinical measurements best distinguish patients who responded well to Impella (CPO improved + lactate dropped + survived) from those who did not. The radar chart compares the profiles of responders vs. non-responders. "Key Differentiators" lists the measurements most different between the two groups, ranked by statistical significance.</InfoTip>
      </h3>
      <div className="mb-4 grid grid-cols-3 gap-4">
        <div className="bg-dark-accent rounded-lg p-4 text-center">
          <p className="text-xs text-dark-text-muted">Responder Rate</p>
          <p className="text-2xl font-semibold text-blue-400">{data.summary.responderRate}%</p>
          <p className="text-[10px] text-dark-text-muted">{data.summary.totalResponders} / {data.summary.totalResponders + data.summary.totalNonResponders}</p>
        </div>
        <div className="bg-dark-accent rounded-lg p-4 text-center">
          <p className="text-xs text-dark-text-muted">Definition</p>
          <p className="text-sm font-medium text-emerald-400">CPO↑</p>
          <p className="text-sm font-medium text-emerald-400">Lactate↓</p>
        </div>
        <div className="bg-dark-accent rounded-lg p-4 text-center">
          <p className="text-xs text-dark-text-muted">Outcome</p>
          <p className="text-sm font-medium text-emerald-400">Survived</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-[300px]">
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar name="Responder" dataKey="Responder" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.2} />
                <Radar name="Non-Responder" dataKey="Non-Responder" stroke="#f87171" fill="#f87171" fillOpacity={0.2} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-dark-text-muted text-sm py-8 text-center">No profile data available</p>
          )}
        </div>

        <div>
          <p className="text-xs text-dark-text-muted mb-2 font-semibold uppercase tracking-widest">Key Differentiators</p>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {topVars.map(v => (
              <div key={v.metric} className="bg-dark-accent rounded p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{v.metric}</span>
                  <span className={cn("text-xs", v.significant ? "text-emerald-400" : "text-dark-text-muted")}>
                    p={v.pValue.toFixed(4)}{v.significant ? " ✓" : ""}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-dark-text-muted mt-1">
                  <span className="text-blue-400">Resp: {v.responderMean.toFixed(2)}</span>
                  <span className="text-red-400">Non: {v.nonResponderMean.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function VentricularSection({ data }: { data: EffectivenessData["ventricularMechanics"] }) {
  const metrics = [...new Set(data.values.map(v => v.metric))].slice(0, 6);

  const chartData = metrics.map(m => {
    const surv = data.values.filter(v => v.metric === m && v.outcome === "survived" && v.value !== null);
    const exp = data.values.filter(v => v.metric === m && v.outcome === "expired" && v.value !== null);
    return {
      name: m,
      Survived: surv.length > 0 ? surv.reduce((a, b) => a + b.value!, 0) / surv.length : 0,
      Expired: exp.length > 0 ? exp.reduce((a, b) => a + b.value!, 0) / exp.length : 0,
    };
  });

  return (
    <div className="bg-dark-card border border-dark-border p-6 rounded-xl shadow-2xl">
      <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
        <Heart size={18} className="text-pink-400" />
        Ventricular Mechanics (PV Loop) <InfoTip>Compares heart-pump mechanics between survived and expired patients using PV loop data. Measurements include Ees (heart contractility), Ea (arterial load), and Ees/Ea ratio (coupling). Higher Ees/Ea = better heart-vessel matching. Smaller bars suggest that specific measurement was lower in non-survivors.</InfoTip>
      </h3>
      {chartData.length > 0 ? (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2D3748" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#718096" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#718096" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1A1D24", border: "1px solid #2D3748", borderRadius: "8px", color: "#E2E8F0" }}
              />
              <Bar dataKey="Survived" fill={SURVIVED_COLOR} radius={[2, 2, 0, 0]} />
              <Bar dataKey="Expired" fill={EXPIRED_COLOR} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-dark-text-muted text-sm py-8 text-center">No PV loop data available</p>
      )}
      <div className="mt-4 text-xs text-dark-text-muted space-y-1">
        {data.statisticalTests.filter(t => t.pValue < 0.15).map(t => (
          <div key={t.metric} className="flex gap-3">
            <span className={cn("font-medium", t.significant ? "text-emerald-400" : "")}>{t.metric}</span>
            <span>Surv: {t.survivedMean.toFixed(3)}</span>
            <span>Exp: {t.expiredMean.toFixed(3)}</span>
            <span>p={t.pValue.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MLCrossReferenceSection({ data }: { data: EffectivenessData["mlCrossReference"] }) {
  const topFeatures = data.features.slice(0, 15);
  const barData = topFeatures.slice(0, 10).map(f => ({
    name: f.name.length > 12 ? f.name.slice(0, 12) : f.name,
    consensus: f.consensus,
    description: f.description,
  }));

  return (
    <div className="bg-dark-card border border-dark-border p-6 rounded-xl shadow-2xl">
      <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
        <Brain size={18} className="text-orange-400" />
        ML Model Cross-Reference <InfoTip>Shows which clinical features are most important across all three ML models (mortality, escalation, RV dysfunction) combined. Features with higher consensus scores are more influential across multiple models. The description column explains what each feature measures and why it matters clinically.</InfoTip>
      </h3>
      {barData.length > 0 ? (
        <>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#2D3748" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#718096" }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94a3b8" }} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1A1D24", border: "1px solid #2D3748", borderRadius: "8px", color: "#E2E8F0" }}
                  formatter={(value: number) => [value.toFixed(2), "Consensus Score"]}
                />
                <Bar dataKey="consensus" radius={[0, 3, 3, 0]} fill="#c084fc" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 max-h-[300px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-dark-text-muted uppercase tracking-widest border-b border-dark-border">
                  <th className="text-left py-2 pr-2">Feature</th>
                  <th className="text-left py-2 px-2">Description</th>
                  <th className="text-right py-2 pl-2">Consensus</th>
                </tr>
              </thead>
              <tbody>
                {topFeatures.map(f => (
                  <tr key={f.name} className="border-b border-dark-border/50 hover:bg-dark-accent/50">
                    <td className="py-2 pr-2 font-mono text-dark-text-primary">{f.name}</td>
                    <td className="py-2 px-2 text-dark-text-muted">{f.description || "—"}</td>
                    <td className="py-2 pl-2 text-right text-purple-400">{f.consensus.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-dark-text-muted text-sm py-8 text-center">No ML cross-reference data available.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function EffectivenessDashboard() {
  const [data, setData] = useState<EffectivenessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | "survived" | "expired">("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get("/api/effectiveness");
        setData(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load effectiveness data. Run analyze_effectiveness.py first.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mb-4"
        />
        <p className="font-mono text-sm uppercase tracking-widest text-dark-text-muted">Loading effectiveness analysis...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <AlertTriangle size={32} className="text-red-400 mb-4" />
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <p className="text-dark-text-muted text-xs font-mono">Run: <code className="bg-dark-accent px-2 py-1 rounded">python3 analyze_effectiveness.py</code></p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-light flex items-center gap-3">
            <Activity className="text-purple-400" size={24} />
            Impella Effectiveness Analysis
          </h2>
          <p className="text-sm text-dark-text-muted mt-1">
            Multi-dimensional analysis of hemodynamic support outcomes · {data.survival.overall.total} patients
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-dark-card border border-dark-border p-4 rounded-lg">
          <p className="text-[10px] uppercase text-dark-text-muted tracking-widest">Patients</p>
          <p className="text-2xl font-light mt-1">{data.survival.overall.total}</p>
          <p className="text-xs text-dark-text-muted">{data.survival.overall.survived} survived / {data.survival.overall.expired} expired</p>
        </div>
        <div className="bg-dark-card border border-dark-border p-4 rounded-lg">
          <p className="text-[10px] uppercase text-dark-text-muted tracking-widest">Mortality</p>
          <p className="text-2xl font-light mt-1" style={{ color: data.survival.overall.mortalityRate > 20 ? "#f87171" : "#34d399" }}>
            {data.survival.overall.mortalityRate}%
          </p>
          <p className="text-xs text-dark-text-muted">Overall cohort</p>
        </div>
        <div className="bg-dark-card border border-dark-border p-4 rounded-lg">
          <p className="text-[10px] uppercase text-dark-text-muted tracking-widest">Responders</p>
          <p className="text-2xl font-light mt-1 text-blue-400">{data.responders.summary.responderRate}%</p>
          <p className="text-xs text-dark-text-muted">CPO↑ + Lactate↓ + Survived</p>
        </div>
        <div className="bg-dark-card border border-dark-border p-4 rounded-lg">
          <p className="text-[10px] uppercase text-dark-text-muted tracking-widest">Sig. Findings</p>
          <p className="text-2xl font-light mt-1 text-amber-400">
            {data.hemodynamics.statisticalTests.filter(t => t.significant).length +
             data.labs.statisticalTests.filter(t => t.significant).length +
             data.ventricularMechanics.statisticalTests.filter(t => t.significant).length}
          </p>
          <p className="text-xs text-dark-text-muted">p &lt; 0.05 across analyses</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 p-4 bg-dark-accent border border-dark-border rounded-lg">
        <span className="text-xs font-semibold uppercase tracking-widest text-dark-text-muted">Outcome Filter</span>
        {(["all", "survived", "expired"] as const).map(o => (
          <button
            key={o}
            onClick={() => setOutcomeFilter(o)}
            className={cn(
              "px-4 py-1.5 text-xs rounded font-medium transition-all",
              outcomeFilter === o
                ? o === "all" ? "bg-blue-600 text-white"
                  : o === "survived" ? "bg-emerald-600 text-white"
                  : "bg-red-600 text-white"
                : "bg-dark-card text-dark-text-muted hover:text-dark-text-primary border border-dark-border"
            )}
          >
            {o === "all" ? "All" : o === "survived" ? "Survived" : "Expired"}
          </button>
        ))}
        <div className="ml-auto text-xs text-dark-text-muted">
          <Info size={14} className="inline mr-1" />
          Outcome filter applies to hemodynamic and lab sections
        </div>
      </div>

      {/* Analysis panels */}
      <SurvivalSection data={data.survival.byIndication} />
      <HemodynamicSection data={data.hemodynamics} outcomeFilter={outcomeFilter} />
      <LabSection data={data.labs} outcomeFilter={outcomeFilter} />
      <ResponderSection data={data.responders} />
      <VentricularSection data={data.ventricularMechanics} />
      <MLCrossReferenceSection data={data.mlCrossReference} />
    </div>
  );
}
