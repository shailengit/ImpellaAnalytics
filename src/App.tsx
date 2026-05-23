import React, { useState, useCallback } from "react";
import axios from "axios";
import {
  Activity,
  Upload,
  ArrowLeft,
  ActivitySquare,
  BookOpen,
  Users,
  Brain,
  BarChart3,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import type { AnalyticsResult } from "./types";
import ClusteringPage from "./components/ClusteringPage";
import PVLoopPage from "./components/PVLoopPage";

import MortalityFeaturesPage from "./components/MortalityFeaturesPage";
import EffectivenessDashboard from "./components/EffectivenessDashboard";
import DashboardPage from "./components/DashboardPage";

export default function App() {
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<"dashboard" | "clusters" | "pvloop" | "mortality" | "effectiveness">("dashboard");

  const loadSampleData = useCallback(async () => {
    setIsUploading(true);
    setError(null);
    try {
      const response = await axios.get("/api/sample");
      setData(response.data);
    } catch (err: any) {
      setError("Failed to load sample data.");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const onFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("/api/analyze", formData);
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to upload and process file.");
    } finally {
      setIsUploading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text-primary font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-dark-border p-6 flex justify-between items-center bg-dark-bg/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-dark-accent p-2 rounded border border-dark-border shadow-inner">
            <Activity className="text-blue-400 w-6 h-6" />
          </div>
          <div>
            <h1 className="font-light text-2xl tracking-tight uppercase cursor-pointer" onClick={() => setActivePage("dashboard")}>Impella <span className="font-bold">Analytics</span></h1>
            <p className="text-[10px] uppercase text-dark-text-muted font-mono tracking-widest">Hemodynamic Recovery Lead</p>
          </div>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={() => setActivePage("pvloop")}
            className={cn(
              "px-4 py-2 rounded-sm transition-all flex items-center gap-2 text-sm font-medium border",
              activePage === "pvloop"
                ? "bg-teal-600 text-white border-teal-600"
                : "border-dark-border hover:bg-dark-accent"
            )}
          >
            <ActivitySquare size={16} className={activePage === "pvloop" ? "text-teal-200" : "text-teal-400"} />            PV Loop
          </button>
          <button
            onClick={() => setActivePage("clusters")}
            className={cn(
              "px-4 py-2 rounded-sm transition-all flex items-center gap-2 text-sm font-medium border",
              activePage === "clusters"
                ? "bg-purple-600 text-white border-purple-600"
                : "border-dark-border hover:bg-dark-accent"
            )}
          >
            <Users size={16} className={activePage === "clusters" ? "text-purple-200" : "text-purple-400"} />
            Patient Phenotypes
          </button>
          <button
            onClick={() => setActivePage("mortality")}
            className={cn(
              "px-4 py-2 rounded-sm transition-all flex items-center gap-2 text-sm font-medium border",
              activePage === "mortality"
                ? "bg-purple-600 text-white border-purple-600"
                : "border-dark-border hover:bg-dark-accent"
            )}
          >
            <Brain size={16} className={activePage === "mortality" ? "text-purple-200" : "text-purple-400"} />
            Mortality Features
          </button>
          <button
            onClick={() => setActivePage("effectiveness")}
            className={cn(
              "px-4 py-2 rounded-sm transition-all flex items-center gap-2 text-sm font-medium border",
              activePage === "effectiveness"
                ? "bg-amber-600 text-white border-amber-600"
                : "border-dark-border hover:bg-dark-accent"
            )}
          >
            <BarChart3 size={16} className={activePage === "effectiveness" ? "text-amber-200" : "text-amber-400"} />
            Effectiveness
          </button>
          <button
            onClick={() => window.open('/guide.html', '_blank')}
            className="flex items-center gap-2 text-sm font-medium border border-dark-border px-4 py-2 rounded-sm hover:bg-dark-accent transition-all text-dark-text-secondary"
          >
            <BookOpen size={16} /> Guide
          </button>
          <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-sm hover:bg-blue-500 transition-all flex items-center gap-2 text-sm font-medium shadow-lg shadow-blue-900/20">
            <Upload size={16} />
            {isUploading ? "Processing..." : "Upload Clinical RHC"}
            <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={onFileUpload} disabled={isUploading} />
          </label>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {activePage === "clusters" ? (
          <div className="space-y-6">
            <button
              onClick={() => setActivePage("dashboard")}
              className="flex items-center gap-2 text-sm font-medium text-dark-text-muted hover:text-dark-text-primary transition-colors"
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </button>
            <ClusteringPage />
          </div>
        ) : activePage === "pvloop" ? (
          data && data.patients ? (
            <div className="space-y-6">
              <button
                onClick={() => setActivePage("dashboard")}
                className="flex items-center gap-2 text-sm font-medium text-dark-text-muted hover:text-dark-text-primary transition-colors"
              >
                <ArrowLeft size={16} /> Back to Dashboard
              </button>
              <PVLoopPage patients={data.patients} />
            </div>
          ) : (
            <div className="h-[60vh] flex items-center justify-center text-dark-text-muted font-mono text-sm uppercase tracking-widest">
              Load patient data first to view PV Loop analysis
            </div>
          )
        ) : activePage === "mortality" ? (
          <div className="space-y-6">
            <button
              onClick={() => setActivePage("dashboard")}
              className="flex items-center gap-2 text-sm font-medium text-dark-text-muted hover:text-dark-text-primary transition-colors"
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </button>
            <MortalityFeaturesPage />
          </div>
        ) : activePage === "effectiveness" ? (
          <div className="space-y-6">
            <button
              onClick={() => setActivePage("dashboard")}
              className="flex items-center gap-2 text-sm font-medium text-dark-text-muted hover:text-dark-text-primary transition-colors"
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </button>
            <EffectivenessDashboard />
          </div>
        ) : null}

          <DashboardPage
            data={data}
            isUploading={isUploading}
            error={error}
            onLoadSample={loadSampleData}
            onFileUpload={onFileUpload}
          />
      </main>

      {/* Footer / Context */}
      <footer className="border-t border-dark-border p-12 mt-12 bg-dark-card/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 h-full opacity-60">
          <div className="col-span-2">
            <h4 className="text-[10px] font-mono font-black uppercase tracking-[0.4em] mb-6 opacity-30">Clinician Intelligence Platform</h4>
            <p className="text-xs leading-relaxed max-w-lg mb-4 text-dark-text-secondary">
              Predictive survivability models calculated via LOOCV ensemble trees.
              Always calibrate AI insights with real-time RHC waveform analysis.
              For clinical research use only.
            </p>
            <div className="flex gap-4">
               <div className="h-0.5 w-12 bg-blue-500/40 rounded-full" />
               <div className="h-0.5 w-12 bg-emerald-500/40 rounded-full" />
               <div className="h-0.5 w-12 bg-orange-500/40 rounded-full" />
            </div>
          </div>
          <div className="text-[10px] font-mono leading-loose uppercase tracking-widest space-y-1">
             <div className="font-black opacity-30 mb-2">Metrics Hub</div>
             <div>Delta_CPO Threshold: 0.15</div>
             <div>Risk Indexing: RV/PAPI</div>
             <div>LOOCV Seed: 42</div>
          </div>
          <div className="text-[10px] font-mono leading-loose uppercase tracking-widest text-right flex flex-col justify-end">
             <div className="opacity-30">Ver: 4.2.0.BUILD_CLINICAL</div>
             <div>Sync State: <span className="text-emerald-500">Live</span></div>
             <div>Last Access: {new Date().toLocaleTimeString()}</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

