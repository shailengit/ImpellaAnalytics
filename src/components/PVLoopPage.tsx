import React, { useState } from "react";
import axios from "axios";
import { cn } from "@/src/lib/utils";

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

interface PVLoopPageProps {
  patients?: Array<{
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
    riskScores?: {
      escalation?: number;
    };
  }>;
}

export default function PVLoopPage({ patients }: PVLoopPageProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "patients">("overview");
  const [shapData, setShapData] = useState<SHAPResult | null>(null);
  const [pvModelData, setPvModelData] = useState<PVLoopAnalysis | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<number | null>(null);

  // Load SHAP data if not already loaded
  React.useEffect(() => {
    if (!shapData) {
      fetch("/ml_output/pv_loop_shap.json")
        .then(r => r.json())
        .then(setShapData)
        .catch(() => {});
    }
  }, [shapData]);

  // Load PV model data if not already loaded
  React.useEffect(() => {
    if (!pvModelData) {
      fetch("/ml_output/pv_loop_escalation_model.json")
        .then(r => r.json())
        .then(setPvModelData)
        .catch(() => {});
    }
  }, [pvModelData]);

  const patientList = patients || [];

  const getEesEaZone = (e: number | undefined) => {
    if (e === undefined || e === null) return { label: "N/A", color: "text-gray-400", bg: "bg-gray-500/20", border: "border-gray-500/30" };
    if (e < 1.0) return { label: "High RV Load", color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" };
    if (e < 1.5) return { label: "Intermediate", color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" };
    if (e < 2.5) return { label: "Normal", color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" };
    return { label: "Favorable", color: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" };
  };

  const sortedPatients = [...patientList].sort((a, b) => (b.eesEa || 0) - (a.eesEa || 0));

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text-primary p-6 space-y-8">
      {/* Header */}
      <div className="border-b border-dark-border pb-4">
        <h1 className="text-3xl font-light tracking-tight">
          Pressure-Volume <span className="font-bold">Loop Analysis</span>
        </h1>
        <p className="text-xs font-mono text-dark-text-muted mt-1 uppercase tracking-widest">
          Pre-generated visualizations from PV Loop pipeline — Ees/Ea coupling, SHAP explainability
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

          {/* Coefficient Plot */}
          {pvModelData && Object.keys(pvModelData.coefficients).length > 0 && (
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" /> PV Loop Logistic Regression Coefficients
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
                      <div className="w-32 text-xs font-mono text-dark-text-secondary text-right">{feat}</div>
                      <div className="flex-1 h-6 bg-dark-bg rounded overflow-hidden">
                        <div
                          className={cn("h-full transition-all", isPositive ? "bg-red-500/60" : "bg-emerald-500/60")}
                          style={{ width: `${widthPct}%`, marginLeft: isPositive ? 0 : `${-widthPct + 100}%` }}
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
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-500/60" /> Positive = Higher escalation risk</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500/60" /> Negative = Lower escalation risk</span>
              </div>
            </div>
          )}

          {/* Pre-generated Images */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" /> Ees/Ea vs MCS Escalation
              </h3>
              <img
                src="/ml_output/pv_loop_scatter.png"
                alt="PV Loop Scatter"
                className="w-full rounded border border-dark-border"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full" /> SHAP Feature Importance
              </h3>
              <img
                src="/ml_output/shap_escalation_full.png"
                alt="SHAP Summary"
                className="w-full rounded border border-dark-border"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full" /> Ees/Ea SHAP Dependence
              </h3>
              <img
                src="/ml_output/shap_dependence_ees_ea.png"
                alt="SHAP Dependence"
                className="w-full rounded border border-dark-border"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            <div className="bg-dark-card border border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-teal-500 rounded-full" /> PV Loop Coefficients
              </h3>
              <img
                src="/ml_output/pv_loop_coefficients.png"
                alt="PV Loop Coefficients"
                className="w-full rounded border border-dark-border"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          </div>
        </>
      )}

      {activeTab === "patients" && (
        <>
          {/* Patient Table */}
          <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-dark-border bg-dark-accent/50">
              <h3 className="text-xs font-bold uppercase tracking-widest">Patient PV Loop Data</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-dark-border text-left">
                    <th className="py-3 px-4 text-dark-text-muted uppercase tracking-widest">Patient</th>
                    <th className="py-3 px-4 text-dark-text-muted uppercase tracking-widest text-right">Ees/Ea</th>
                    <th className="py-3 px-4 text-dark-text-muted uppercase tracking-widest text-right">Ees</th>
                    <th className="py-3 px-4 text-dark-text-muted uppercase tracking-widest text-right">Ea</th>
                    <th className="py-3 px-4 text-dark-text-muted uppercase tracking-widest text-right">ESP</th>
                    <th className="py-3 px-4 text-dark-text-muted uppercase tracking-widest text-right">EDP</th>
                    <th className="py-3 px-4 text-dark-text-muted uppercase tracking-widest text-right">Recovery</th>
                    <th className="py-3 px-4 text-dark-text-muted uppercase tracking-widest text-right">SHAP (Ees/Ea)</th>
                    <th className="py-3 px-4 text-dark-text-muted uppercase tracking-widest text-right">Escalation Prob</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPatients.map((p, idx) => {
                    const zone = getEesEaZone(p.eesEa);
                    const shapEntry = shapData?.patient_shap?.find(s => p.name.includes(s.name) || s.name.includes(p.name.split(" ")[0]));
                    return (
                      <tr
                        key={p.id || idx}
                        className={cn(
                          "border-b border-dark-border/50 hover:bg-dark-accent/30 cursor-pointer transition-all",
                          selectedPatient === idx ? "bg-dark-accent" : ""
                        )}
                        onClick={() => setSelectedPatient(selectedPatient === idx ? null : idx)}
                      >
                        <td className="py-3 px-4 text-dark-text-primary font-medium">{p.name}</td>
                        <td className={cn("py-3 px-4 text-right font-bold tabular-nums", zone.color)}>
                          {p.eesEa?.toFixed(3) || "—"}
                        </td>
                        <td className="py-3 px-4 text-right text-dark-text-secondary tabular-nums">
                          {p.ees?.toFixed(3) || "—"}
                        </td>
                        <td className="py-3 px-4 text-right text-dark-text-secondary tabular-nums">
                          {p.ea?.toFixed(3) || "—"}
                        </td>
                        <td className="py-3 px-4 text-right text-dark-text-secondary tabular-nums">
                          {p.esp?.toFixed(0) || "—"}
                        </td>
                        <td className="py-3 px-4 text-right text-dark-text-secondary tabular-nums">
                          {p.edp?.toFixed(0) || "—"}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {p.recoveryScore.toFixed(0)}
                        </td>
                        <td className={cn("py-3 px-4 text-right tabular-nums", (shapEntry?.ees_ea_shap || 0) > 0 ? "text-red-400" : "text-emerald-400")}>
                          {shapEntry?.ees_ea_shap?.toFixed(4) || "—"}
                        </td>
                        <td className={cn("py-3 px-4 text-right tabular-nums", (shapEntry?.prediction_probability || 0) > 0.3 ? "text-orange-400" : "text-emerald-400")}>
                          {shapEntry ? `${(shapEntry.prediction_probability * 100).toFixed(0)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
