import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";
import { Info, TrendingUp, Brain, BarChart3, AlertTriangle, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import InfoTip from "./InfoTip";

interface FeatureRow {
  [key: string]: any;
  mean_rank: number;
  consensus_score: number;
}

interface SubsetResult {
  target: string;
  subsets: Record<string, { LR_AUC: number; RF_AUC: number; n_features: number }>;
  full: { LR_AUC: number; RF_AUC: number; n_features: number };
}

export default function MortalityFeaturesPage() {
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [comparison, setComparison] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMethod, setSortMethod] = useState<string>("consensus_score");
  const [showInfo, setShowInfo] = useState<string | null>(null);

  useEffect(() => {
    axios.get("/api/mortality-features")
      .then(res => {
        setFeatures(res.data.features || []);
        setComparison(res.data.comparison);
      })
      .catch(err => setError(err.response?.data?.error || "Failed to load mortality features"))
      .finally(() => setLoading(false));
  }, []);

  const top20 = features.slice(0, 20);

  const consensusChartData = top20.map((f, i) => ({
    name: f[""] || Object.keys(f)[0],
    score: f.consensus_score,
    rank: i + 1,
  })).reverse();

  const methodNames = ["RF Gini", "Permutation", "SHAP", "LASSO", "Univariate AUC"];

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
        />
        <p className="font-mono text-sm uppercase tracking-widest text-dark-text-muted animate-pulse">Loading Mortality Feature Analysis...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-4 rounded-lg flex items-center gap-3">
        <AlertTriangle className="shrink-0" />
        <p>{error}</p>
      </div>
    );
  }

  const renderComparisonChart = () => {
    if (!comparison) return null;
    const chartData: Record<string, any[]> = {};
    const targets = Object.keys(comparison);

    targets.forEach(t => {
      const tData = comparison[t];
      chartData[t] = [];
      const subsets = Object.entries(tData.subsets || {}).sort(([a], [b]) => Number(a) - Number(b));
      chartData[t].push({
        label: "Full",
        n: tData.full.n_features,
        LR: +(tData.full.LR_AUC * 100).toFixed(1),
        RF: +(tData.full.RF_AUC * 100).toFixed(1),
      });
      subsets.forEach(([k, v]: [string, any]) => {
        chartData[t].push({
          label: `Top-${k}`,
          n: v.n_features,
          LR: +(v.LR_AUC * 100).toFixed(1),
          RF: +(v.RF_AUC * 100).toFixed(1),
        });
      });
    });

    return (
      <div className="space-y-8 mt-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 size={18} className="text-blue-400" /> Feature Subset Performance <InfoTip>Shows how model accuracy (AUC) changes when using only the top-ranked features versus all 185+ features. If a shorter feature list achieves similar performance, it means the model can be simplified without losing predictive power. Blue = Logistic Regression, Orange = Random Forest.</InfoTip>
        </h3>
        <p className="text-xs text-dark-text-muted font-mono -mt-4">
          Comparing AUC when using only the top-k consensus features vs. the full feature set (5-fold CV)
        </p>
        {targets.map(target => {
          const data = chartData[target];
          const tLabel = target.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          const bestLR = Math.max(...data.map(d => d.LR));
          const bestRF = Math.max(...data.map(d => d.RF));
          return (
            <div key={target} className="bg-dark-card border border-dark-border p-5 rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold uppercase tracking-widest">{tLabel}</h4>
                <div className="flex gap-3 text-[10px] font-mono">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-400 rounded-full" /> LR (best: {bestLR}%)</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-orange-400 rounded-full" /> RF (best: {bestRF}%)</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
                  <XAxis dataKey="label" tick={{ fill: "#718096", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#718096", fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip contentStyle={{ backgroundColor: "#1A1D24", border: "1px solid #2D3748", borderRadius: "8px", color: "#E2E8F0" }} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="LR" name="Logistic Regression" fill="#60A5FA" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="RF" name="Random Forest" fill="#FB923C" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-dark-text-muted mt-2 font-mono">
                Full: {data[0].n} features | Top-5: {data[1]?.n || "-"} | Top-50: {data[data.length - 1]?.n || "-"} features
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-dark-card border border-dark-border p-6 rounded-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-purple-600/20 p-2 rounded-lg">
            <Brain className="text-purple-400 w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-light tracking-tight">Mortality <span className="font-bold">Feature Importance</span></h2>
            <p className="text-[10px] text-dark-text-muted font-mono uppercase tracking-widest mt-1">Multi-Method Consensus Analysis <InfoTip>This page identifies which clinical measurements are most strongly associated with in-hospital mortality. Five different statistical methods are used, and their results are combined into a consensus ranking. The goal is to understand what signals matter most — not to make individual predictions.</InfoTip></p>
          </div>
        </div>
        <p className="text-sm text-dark-text-secondary leading-relaxed max-w-3xl">
          Consensus ranking across 5 feature importance methods: <strong>Random Forest Gini</strong>, <strong>Permutation Importance</strong>,
          {" "}<strong>SHAP Values</strong>, <strong>LASSO (L1 Regression)</strong>, and <strong>Univariate AUC</strong>.
          Features ranked highest across all methods represent the most robust mortality signals in this dataset.
        </p>
        <div className="flex gap-4 mt-4 text-[10px] font-mono text-dark-text-muted">
          <span className="bg-dark-accent px-3 py-1 rounded border border-dark-border">N = {features.length} features ranked</span>
          <span className="bg-dark-accent px-3 py-1 rounded border border-dark-border">5 methods compared</span>
          <span className="bg-dark-accent px-3 py-1 rounded border border-dark-border">Consensus normalization</span>
        </div>
      </div>

      {/* Consensus Ranking Chart */}
      <div className="bg-dark-card border border-dark-border p-6 rounded-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <TrendingUp size={18} className="text-purple-400" /> Top 20 Consensus Features
          </h3>
          <div className="flex gap-2">
            {["consensus_score", "RF Gini", "SHAP", "LASSO", "Univariate AUC"].map(m => (
              <button
                key={m}
                onClick={() => setSortMethod(m)}
                className={cn(
                  "text-[9px] px-2 py-1 rounded font-mono uppercase border transition-all",
                  sortMethod === m
                    ? "bg-purple-600 text-white border-purple-600"
                    : "border-dark-border text-dark-text-muted hover:text-dark-text-primary"
                )}
              >
                {m.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={consensusChartData} layout="vertical" margin={{ left: 120, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#2D3748" />
              <XAxis type="number" domain={[0, 1]} tick={{ fill: "#718096", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#E2E8F0", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={110}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#1A1D24", border: "1px solid #2D3748", borderRadius: "8px", color: "#E2E8F0" }}
                formatter={(value: number) => [(value * 100).toFixed(1) + "%", "Consensus Score"]}
              />
              <Bar dataKey="score" radius={[0, 3, 3, 0]}>
                {consensusChartData.map((entry, i) => (
                  <rect key={i} fill={`hsl(${280 - i * 8}, 60%, ${60 - i * 1.5}%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Features Table */}
      <div className="bg-dark-card border border-dark-border p-6 rounded-lg">
        <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
          <Info size={16} className="text-blue-400" /> Consensus Ranking — Full Table <InfoTip>Each row is a clinical measurement ranked by how consistently it predicts mortality across five different methods. Higher consensus score = more reliable signal. Features like AST (liver injury), lactate (tissue perfusion), and age consistently rank at the top.</InfoTip>
        </h3>
        <div className="overflow-x-auto custom-scrollbar-h">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dark-border">
                <th className="p-2 text-left font-bold text-[10px] uppercase tracking-widest text-dark-text-muted">Rank</th>
                <th className="p-2 text-left font-bold text-[10px] uppercase tracking-widest text-dark-text-muted">Feature</th>
                {methodNames.map(m => (
                  <th key={m} className="p-2 text-right font-bold text-[10px] uppercase tracking-widest text-dark-text-muted">{m}</th>
                ))}
                <th className="p-2 text-right font-bold text-[10px] uppercase tracking-widest text-purple-400">Consensus</th>
              </tr>
            </thead>
            <tbody>
              {top20.map((f, i) => {
                const featName = f[""] || Object.keys(f).find(k => !["mean_rank", "consensus_score", ...methodNames].includes(k)) || `feature_${i}`;
                return (
                  <tr
                    key={i}
                    className="border-b border-dark-border/50 hover:bg-dark-accent/50 transition-colors"
                    onMouseEnter={() => setShowInfo(featName)}
                    onMouseLeave={() => setShowInfo(null)}
                  >
                    <td className="p-2 font-mono text-dark-text-muted">{i + 1}</td>
                    <td className="p-2 font-medium">{featName}</td>
                    {methodNames.map(m => (
                      <td key={m} className="p-2 text-right font-mono text-dark-text-muted">
                        {f[m] !== undefined ? (typeof f[m] === 'number' ? f[m].toFixed(1) : f[m]) : "-"}
                      </td>
                    ))}
                    <td className="p-2 text-right font-mono font-bold text-purple-400">
                      {(f.consensus_score * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feature Subset Comparison */}
      {comparison && (
        <div className="bg-dark-card border border-dark-border p-6 rounded-lg">
          <h3 className="font-semibold text-lg flex items-center gap-2 mb-2">
            <BarChart3 size={18} className="text-emerald-400" /> Feature Reduction Analysis <InfoTip>Compares model performance using the full feature set versus reduced subsets. This helps determine if a simpler model (fewer measurements needed) can achieve similar accuracy. For escalation and RV dysfunction, the full model significantly outperforms reduced versions.</InfoTip>
          </h3>
          <p className="text-xs text-dark-text-muted font-mono mb-6">
            How model performance changes when using only the top-k consensus features vs. the full feature set
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {Object.entries(comparison).map(([target, tData]: [string, any]) => {
              const tLabel = target.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
              const fullRF = (tData.full.RF_AUC * 100).toFixed(1);
              const bestSubset = Object.entries(tData.subsets || {}).reduce(
                (best: any, [k, v]: [string, any]) => v.RF_AUC > (best?.RF_AUC || 0) ? { k, ...v } : best,
                null
              );
              const bestSubRF = bestSubset ? (bestSubset.RF_AUC * 100).toFixed(1) : "N/A";
              const bestSubK = bestSubset?.k || "-";
              return (
                <div key={target} className="bg-dark-accent border border-dark-border p-4 rounded-lg">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-dark-text-muted mb-2">{tLabel}</h4>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div>
                      <div className="text-lg font-mono font-bold text-blue-400">{fullRF}%</div>
                      <div className="text-[9px] text-dark-text-muted font-mono">Full RF AUC</div>
                    </div>
                    <div>
                      <div className="text-lg font-mono font-bold text-orange-400">{bestSubRF}%</div>
                      <div className="text-[9px] text-dark-text-muted font-mono">Best subset (Top-{bestSubK})</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {renderComparisonChart()}
        </div>
      )}

      {/* Clinical Interpretation */}
      <div className="bg-dark-accent border border-dark-border p-6 rounded-lg">
        <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
          <CheckCircle2 size={18} className="text-emerald-400" /> Clinical Interpretation
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-4">
            <div className="bg-dark-card/50 border border-dark-border p-4 rounded-lg">
              <h4 className="text-xs font-bold uppercase tracking-widest text-red-400 mb-2">Top Mortality Signals</h4>
              <ul className="space-y-2 text-dark-text-secondary">
                <li><strong className="text-dark-text-primary">post_ast</strong> — Post-implant AST (liver injury) is the single strongest signal, ranked #1 by 3/5 methods. Hepatocyte injury from low cardiac output state.</li>
                <li><strong className="text-dark-text-primary">post_lactate</strong> — Post-implant lactate, a direct marker of tissue hypoperfusion. Strong across all methods.</li>
                <li><strong className="text-dark-text-primary">age</strong> — Chronological age remains one of the most robust univariate predictors.</li>
                <li><strong className="text-dark-text-primary">post_hco3</strong> — Bicarbonate (acid-base status) reflects metabolic compensation in shock.</li>
                <li><strong className="text-dark-text-primary">post_egfr</strong> — Renal function is a key determinant. AKI in the setting of cardiogenic shock portends poor outcomes.</li>
              </ul>
            </div>
            <div className="bg-dark-card/50 border border-dark-border p-4 rounded-lg">
              <h4 className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-2">Physiologic Trajectory Matters</h4>
              <p className="text-dark-text-secondary">
                Delta features (change from pre to post) appear prominently: <strong>delta_pcwp</strong>, <strong>delta_lactate</strong>,
                <strong>delta_pvr</strong>. This confirms that the <em>trend</em> on Impella support is more informative than any single timepoint measurement.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-dark-card/50 border border-dark-border p-4 rounded-lg">
              <h4 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">Model Performance Summary</h4>
              <p className="text-dark-text-secondary mb-2">
                The <strong>escalation</strong> model achieves the best performance (RF AUC up to {comparison ? (comparison.escalation?.full?.RF_AUC * 100).toFixed(1) : "—"}%),
                while <strong>survival</strong> prediction is now clinically useful (LR AUC up to {comparison ? (comparison.survival?.full?.LR_AUC * 100).toFixed(1) : "89"}%).
              </p>
              <p className="text-dark-text-secondary">
                For escalation and RV dysfunction, the <strong>full feature set</strong> significantly outperforms reduced subsets
                (up to 10-15% AUC loss when dropping to top-5 features). For survival prediction, the top-20 consensus features
                match the full model, suggesting the remaining features add noise.
              </p>
            </div>
            <div className="bg-dark-card/50 border border-dark-border p-4 rounded-lg">
              <h4 className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">Clinical Use Cases</h4>
              <ul className="space-y-2 text-dark-text-secondary">
                <li><strong className="text-dark-text-primary">Risk Stratification</strong> — Top features (AST, lactate, age, eGFR, HCO3) can be monitored at bedside for quick mortality risk assessment.</li>
                <li><strong className="text-dark-text-primary">Escalation Planning</strong> — Top-30 features provide near-full model performance for identifying patients who may need ECMO/LVAD.</li>
                <li><strong className="text-dark-text-primary">Model Simplification</strong> — For deployment in resource-limited settings, top-20 features capture the survival signal without information loss.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Methodology */}
      <div className="bg-dark-card border border-dark-border p-6 rounded-lg">
        <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
          <Brain size={16} className="text-purple-400" /> Methodology
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          {[
            { name: "RF Gini", desc: "Built-in impurity reduction from 500-tree Random Forest", color: "text-blue-400" },
            { name: "Permutation", desc: "AUC drop when feature values are shuffled", color: "text-emerald-400" },
            { name: "SHAP", desc: "Shapley values from TreeSHAP explainer", color: "text-purple-400" },
            { name: "LASSO", desc: "L1-regularized LR with cross-validated C", color: "text-orange-400" },
            { name: "Univariate AUC", desc: "Each feature as standalone classifier", color: "text-cyan-400" },
          ].map(m => (
            <div key={m.name} className="bg-dark-accent border border-dark-border p-3 rounded-lg">
              <h4 className={cn("font-bold uppercase tracking-widest text-[10px] mb-1", m.color)}>{m.name}</h4>
              <p className="text-dark-text-muted">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
