import React, { useState, useEffect } from "react";
import axios from "axios";
import { cn } from "@/src/lib/utils";
import { Info, AlertTriangle, ShieldCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { ClusterProfile, ClusterQuality } from "../types";
import InfoTip from "./InfoTip";

interface ClusterProfilesResponse {
  profiles: Record<string, ClusterProfile>;
  quality: ClusterQuality | null;
}

const CLUSTER_COLORS: Record<string, string> = {
  "Non-congested (Low-risk)": "#34d399",
  "Cardiorenal (Moderate-risk)": "#fbbf24",
  "Cardiometabolic (High-risk)": "#f87171",
};

const CLUSTER_BG: Record<string, string> = {
  "Non-congested (Low-risk)": "bg-emerald-500/10 border-emerald-500/30",
  "Cardiorenal (Moderate-risk)": "bg-amber-500/10 border-amber-500/30",
  "Cardiometabolic (High-risk)": "bg-red-500/10 border-red-500/30",
};

function getClusterColor(name: string): string {
  return CLUSTER_COLORS[name] || "#60a5fa"; // blue-400 fallback
}

function getClusterBg(name: string): string {
  return CLUSTER_BG[name] || "bg-blue-500/10 border-blue-500/30";
}

export default function ClusteringPage() {
  const [profiles, setProfiles] = useState<Record<string, ClusterProfile> | null>(null);
  const [quality, setQuality] = useState<ClusterQuality | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string>("0");
  const [showQualityInfo, setShowQualityInfo] = useState(false);

  useEffect(() => {
    axios.get<ClusterProfilesResponse>("/api/cluster-profiles")
      .then(res => {
        setProfiles(res.data.profiles);
        setQuality(res.data.quality);
      })
      .catch(() => setError("Cluster profiles not available. Run clustering_pipeline.py first."));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-dark-bg p-8">
        <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-6 rounded-lg">
          <p className="font-bold mb-2">Clustering Not Available</p>
          <p className="text-sm">{error}</p>
          <p className="text-xs mt-3 text-red-400/70">Run: <code className="bg-red-950/50 px-1 py-0.5 rounded">/tmp/venv/bin/python clustering_pipeline.py</code></p>
        </div>
      </div>
    );
  }

  if (!profiles) {
    return (
      <div className="min-h-screen bg-dark-bg p-8 flex items-center justify-center">
        <div className="animate-pulse text-dark-text-muted font-mono text-sm uppercase tracking-widest">Loading clustering data...</div>
      </div>
    );
  }

  const sortedClusters = (Object.entries(profiles) as [string, ClusterProfile][]).sort(([a], [b]) => Number(a) - Number(b));
  const selected = profiles[selectedCluster];

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text-primary p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dark-border pb-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight">
            Patient <span className="font-bold">Phenotypes</span>
          </h1>
          <p className="text-xs font-mono text-dark-text-muted mt-1 uppercase tracking-widest">
            Consensus K-Means Clustering (k=3) · 10 features · 200 bootstrap iterations
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums">{(Object.values(profiles) as ClusterProfile[]).reduce((s, p) => s + p.patient_count, 0)}</div>
          <div className="text-[10px] font-mono text-dark-text-muted uppercase tracking-widest">Total Patients</div>
        </div>
      </div>

      {/* Cluster Quality Banner */}
      {quality && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {quality.interpretation === "strong" ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              ) : quality.interpretation === "moderate" ? (
                <Info className="w-5 h-5 text-amber-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400" />
              )}
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider",
                  quality.interpretation === "strong"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : quality.interpretation === "moderate"
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-red-500/10 text-red-400"
                )}
              >
                {quality.interpretation} separation
              </span>
              <span className="text-sm text-dark-text-secondary">
                Silhouette Score: <span className="font-bold tabular-nums">{quality.silhouette_score.toFixed(3)}</span>
              </span>
            </div>
            <button
              onClick={() => setShowQualityInfo(!showQualityInfo)}
              className="text-dark-text-muted hover:text-dark-text-primary transition-colors"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
          {showQualityInfo && (
            <div className="text-xs text-dark-text-secondary leading-relaxed space-y-2">
              <p>
                The silhouette score measures how similar patients are to their assigned cluster versus other clusters. Scores range from -1 to 1; higher values indicate clearer, more reliable groupings.
              </p>
              <p className="text-dark-text-muted italic">{quality.clinical_caution}</p>
              <div className="flex gap-4 text-[10px] font-mono text-dark-text-muted pt-1">
                <span>k = {quality.n_clusters}</span>
                <span>{quality.n_features} features</span>
                <span>{quality.n_patients} patients</span>
                <span>{quality.bootstrap_iterations} bootstrap iterations</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cluster Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sortedClusters.map(([id, prof]) => (
          <button
            key={id}
            onClick={() => setSelectedCluster(id)}
            className={cn(
              "border rounded-xl p-6 text-left transition-all",
              selectedCluster === id ? "ring-2 ring-blue-500 bg-dark-accent" : "bg-dark-card hover:bg-dark-accent/50",
              getClusterBg(prof.cluster_name)
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[10px] font-mono text-dark-text-muted uppercase tracking-widest mb-1">Cluster {id}</div>
                <div className={cn("text-sm font-bold")} style={{ color: getClusterColor(prof.cluster_name) }}>
                  {prof.cluster_name}
                </div>
              </div>
              <div className="text-3xl font-bold tabular-nums">{prof.patient_count}</div>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-dark-text-muted">Survival</span>
                <span className={cn(prof.survival_rate != null && prof.survival_rate < 0.7 ? "text-red-400" : "text-emerald-400")}>
                  {prof.survival_rate != null ? `${(prof.survival_rate * 100).toFixed(0)}%` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-text-muted">Escalation</span>
                <span className={cn(prof.escalation_rate != null && prof.escalation_rate > 0.15 ? "text-orange-400" : "text-dark-text-secondary")}>
                  {prof.escalation_rate != null ? `${(prof.escalation_rate * 100).toFixed(0)}%` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-text-muted">Renal Failure</span>
                <span className={cn(prof.renal_rate != null && prof.renal_rate > 0.15 ? "text-red-400" : "text-dark-text-secondary")}>
                  {prof.renal_rate != null ? `${(prof.renal_rate * 100).toFixed(0)}%` : "—"}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Selected Cluster Detail */}
      {selected && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold mb-1">{selected.cluster_name}</h2>
              <p className="text-sm text-dark-text-secondary">{selected.clinical_recommendation}</p>
            </div>
            <div className="text-right text-xs font-mono text-dark-text-muted">
              <div>{selected.patient_count} patients</div>
              <div>Cluster {selectedCluster}</div>
            </div>
          </div>

          {/* Feature Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left py-2 text-dark-text-muted uppercase tracking-widest">Feature</th>
                  <th className="text-right py-2 text-dark-text-muted uppercase tracking-widest">Mean Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(selected.mean_features)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([feat, val]) => (
                    <tr key={feat} className="border-b border-dark-border/50">
                      <td className="py-2 text-dark-text-secondary">{feat}</td>
                      <td className="py-2 text-right tabular-nums">{typeof val === "number" ? val.toFixed(3) : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* SCAI Distribution */}
          {selected.scai_distribution && Object.keys(selected.scai_distribution).length > 0 && (
            <div className="mt-6 pt-6 border-t border-dark-border">
              <h3 className="text-xs font-mono text-dark-text-muted uppercase tracking-widest mb-3">SCAI Stage Distribution</h3>
              <div className="flex gap-3 flex-wrap">
                {Object.entries(selected.scai_distribution).sort(([a], [b]) => Number(a) - Number(b)).map(([stage, count]) => (
                  <div key={stage} className="bg-dark-accent border border-dark-border rounded px-3 py-2 text-center">
                    <div className="text-lg font-bold tabular-nums">{(count as number)}</div>
                    <div className="text-[10px] text-dark-text-muted uppercase">Stage {stage === "1.0" ? "B" : stage === "2.0" ? "C" : stage === "3.0" ? "D" : "E"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PCA Scatter */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full" /> Patient Clusters (PCA) <InfoTip>This plot shows how patients group into clusters based on their clinical measurements. Each dot is a patient, and the colors represent different patient subtypes (phenotypes). Patients that appear close together have similar clinical profiles. This helps identify natural patterns in how patients respond to Impella support.</InfoTip>
          </h3>
          <img
            src="/ml_output/clusters/pca_scatter.png"
            alt="PCA Scatter"
            className="w-full rounded border border-dark-border"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        {/* Outcome Rates */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-orange-500 rounded-full" /> Outcome Rates by Cluster <InfoTip>This chart shows how each patient cluster performed in terms of key outcomes: survival, escalation needs, and renal failure. Compare across clusters to see which patient subtypes had better or worse outcomes. For example, one cluster may have high survival but also high escalation needs.</InfoTip>
          </h3>
          <img
            src="/ml_output/clusters/outcome_rates.png"
            alt="Outcome Rates"
            className="w-full rounded border border-dark-border"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        {/* Dendrogram */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" /> Hierarchical Dendrogram
          </h3>
          <img
            src="/ml_output/clusters/dendrogram.png"
            alt="Dendrogram"
            className="w-full rounded border border-dark-border"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        {/* Consensus Matrix */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full" /> Consensus Matrix <InfoTip>This matrix shows how consistently patients were grouped together across multiple runs of the clustering algorithm. Darker squares mean patients were frequently placed in the same cluster — indicating a more reliable grouping. Lighter areas suggest the cluster boundary is less stable.</InfoTip>
          </h3>
          <img
            src="/ml_output/clusters/consensus_matrix.png"
            alt="Consensus Matrix"
            className="w-full rounded border border-dark-border"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      </div>

      {/* Silhouette and Cluster Profiles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" /> Silhouette Analysis
          </h3>
          <img
            src="/ml_output/clusters/silhouette.png"
            alt="Silhouette"
            className="w-full rounded border border-dark-border"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-pink-500 rounded-full" /> Cluster Feature Profiles
          </h3>
          <img
            src="/ml_output/clusters/cluster_profiles_heatmap.png"
            alt="Cluster Profiles"
            className="w-full rounded border border-dark-border"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      </div>
    </div>
  );
}
