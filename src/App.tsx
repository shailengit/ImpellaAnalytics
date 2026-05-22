import React, { useState, useCallback } from "react";
import axios from "axios";
import {
  Activity,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  TrendingUp,
  Clock,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  ChevronRight,
  Download,
  Info,
  Users,
  LayoutDashboard,
  ActivitySquare,
  BookOpen,
  Brain
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, ScatterChart, Scatter, ZAxis, Cell
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import type { PatientData, AnalyticsResult } from "./types";
import ClusteringPage from "./components/ClusteringPage";
import PVLoopPage from "./components/PVLoopPage";
import PVLoopPageV2 from "./components/PVLoopPageV2";
import MortalityFeaturesPage from "./components/MortalityFeaturesPage";
import RiskMeter from "./components/RiskMeter";

export default function App() {
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePatient, setActivePatient] = useState<PatientData | null>(null);
  const [activePage, setActivePage] = useState<"dashboard" | "clusters" | "pvloop" | "pvloopv2" | "mortality">("dashboard");
  const [showDeltaCPOInfo, setShowDeltaCPOInfo] = useState(false);
  const [showRiskCounterInfo, setShowRiskCounterInfo] = useState(false);
  const [showRecoveryScoreInfo, setShowRecoveryScoreInfo] = useState(false);
  const [showEscalationFlagsInfo, setShowEscalationFlagsInfo] = useState(false);

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

  const getRiskColor = (p: PatientData) => {
    if (p.postRA > 20 || p.postPAPI < 1.0) return "text-red-500";
    if (p.postRA > 15 || p.postPAPI < 1.5) return "text-amber-500";
    return "text-emerald-500";
  };

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
            <ActivitySquare size={16} className={activePage === "pvloop" ? "text-teal-200" : "text-teal-400"} />
            PV Loop (Original)
          </button>
          <button
            onClick={() => setActivePage("pvloopv2")}
            className={cn(
              "px-4 py-2 rounded-sm transition-all flex items-center gap-2 text-sm font-medium border",
              activePage === "pvloopv2"
                ? "bg-cyan-600 text-white border-cyan-600"
                : "border-dark-border hover:bg-dark-accent"
            )}
          >
            <ActivitySquare size={16} className={activePage === "pvloopv2" ? "text-cyan-200" : "text-cyan-400"} />
            PV Loop (V2)
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
        ) : activePage === "pvloopv2" ? (
          data && data.patients ? (
            <div className="space-y-6">
              <button
                onClick={() => setActivePage("dashboard")}
                className="flex items-center gap-2 text-sm font-medium text-dark-text-muted hover:text-dark-text-primary transition-colors"
              >
                <ArrowLeft size={16} /> Back to Dashboard
              </button>
              <PVLoopPageV2 patients={data.patients} />
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
        ) : (
          !data ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="h-[60vh] flex flex-col items-center justify-center border-2 border-dashed border-dark-border rounded-xl bg-dark-card/30"
            >
            <FileSpreadsheet className="w-16 h-16 text-dark-text-muted mb-4 opacity-30" />
            <h2 className="text-3xl font-light mb-2 italic serif">Patient Cohort Analysis</h2>
            <p className="text-dark-text-secondary max-w-md text-center mb-8 text-sm">
              Upload your clinical Excel sheet. Ensure patients are in columns 
              and hemodynamic rows include RA, PCWP, CPO, and PAPI.
            </p>
            <div className="flex gap-4">
               <button 
                onClick={loadSampleData}
                className="flex items-center gap-2 text-sm font-medium border border-dark-border bg-dark-accent px-6 py-2 rounded-sm hover:bg-dark-border transition-all"
               >
                 <Activity size={16} className="text-emerald-400" /> Load Sample Clinical Cohort
               </button>
               <button 
                onClick={() => {
                  window.location.href = "/api/download-example";
                }}
                className="flex items-center gap-2 text-sm font-medium border border-dark-border/50 px-6 py-2 rounded-sm hover:bg-dark-accent transition-all text-dark-text-secondary"
               >
                 <Download size={16} /> Excel Template
               </button>
            </div>
          </motion.div>
          ) : null
        )}

        {isUploading && (
           <div className="h-[60vh] flex flex-col items-center justify-center">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
              />
              <p className="font-mono text-sm uppercase tracking-widest text-dark-text-muted animate-pulse">Running LOOCV RandomForest Prediction...</p>
           </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-4 rounded-lg flex items-center gap-3">
            <AlertTriangle className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {activePage === "dashboard" && data && data.summary && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Top Cards */}
            <div className="lg:col-span-1 bg-dark-card border border-dark-border p-6 rounded-lg shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/10 transition-all"></div>
              <div className="flex justify-between items-start mb-1">
                <p className="text-[10px] font-mono uppercase text-dark-text-muted tracking-widest italic serif">Avg Delta CPO</p>
                <button onClick={() => setShowDeltaCPOInfo(!showDeltaCPOInfo)} className="text-dark-text-muted hover:text-dark-text-primary transition-colors">
                  <Info size={12} />
                </button>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-light tracking-tighter tabular-nums">
                  {data.summary.averageDeltaCPO?.toFixed(2) || "0.00"}
                </span>
                <span className="text-sm text-dark-text-muted">Watts</span>
              </div>
              <p className="text-xs mt-2 text-emerald-400 flex items-center gap-1 font-medium">
                <TrendingUp size={12} /> Post-implant effectiveness
              </p>
              {showDeltaCPOInfo && (
                <div className="absolute top-full left-0 right-0 z-50 mt-2 p-4 bg-dark-accent border border-dark-border rounded-lg shadow-2xl text-xs font-mono leading-relaxed space-y-2">
                  <p><strong>What it is:</strong> Cardiac Power Output (CPO) = (MAP × TDCO) / 451. Delta CPO is the change from pre-implant to 48h post-implant.</p>
                  <p><strong>What it means:</strong> Positive delta = hemodynamic improvement on Impella support. Negative or flat delta suggests poor recovery.</p>
                  <p><strong>Clinical threshold:</strong> Delta CPO &gt; 0.2 W generally correlates with improved survival and weaning candidacy.</p>
                </div>
              )}
            </div>

            <div className="lg:col-span-1 bg-dark-card border border-dark-border p-6 rounded-lg shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 blur-2xl"></div>
              <div className="flex justify-between items-start mb-1">
                <p className="text-[10px] font-mono uppercase text-dark-text-muted tracking-widest italic serif">Risk Counter</p>
                <button onClick={() => setShowRiskCounterInfo(!showRiskCounterInfo)} className="text-dark-text-muted hover:text-dark-text-primary transition-colors">
                  <Info size={12} />
                </button>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn("text-4xl font-light tracking-tighter tabular-nums", (data.summary.riskPatientCount || 0) > 0 ? "text-orange-400" : "")}>
                  {data.summary.riskPatientCount || 0}
                </span>
                <span className="text-sm text-dark-text-muted">High Risk</span>
              </div>
              <p className="text-xs mt-2 text-dark-text-muted font-medium">Flag: RA &gt;20 or PAPI &lt;1.0</p>
              {showRiskCounterInfo && (
                <div className="absolute top-full left-0 right-0 z-50 mt-2 p-4 bg-dark-accent border border-dark-border rounded-lg shadow-2xl text-xs font-mono leading-relaxed space-y-2">
                  <p><strong>What it is:</strong> Count of patients meeting traditional hemodynamic danger thresholds based on 48h post-implant RHC.</p>
                  <p><strong>RA &gt; 20 mmHg:</strong> Right atrial pressure above 20 suggests right ventricular failure or volume overload. Watch for rising inotrope needs and falling PAPI.</p>
                  <p><strong>PAPI &lt; 1.0:</strong> Pulmonary Artery Pulsatility Index below 1.0 indicates severe RV dysfunction. PAPI = (PASP &#8722; PADP) / RA. Low PAPI predicts cardiogenic shock refractory to Impella alone.</p>
                </div>
              )}
            </div>

            <div className="lg:col-span-1 bg-dark-card border border-dark-border p-6 rounded-lg shadow-xl relative">
              <div className="flex justify-between items-start mb-1">
                <p className="text-[10px] font-mono uppercase text-dark-text-muted tracking-widest italic serif">Recovery Score</p>
                <button onClick={() => setShowRecoveryScoreInfo(!showRecoveryScoreInfo)} className="text-dark-text-muted hover:text-dark-text-primary transition-colors">
                  <Info size={12} />
                </button>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-light tracking-tighter tabular-nums text-blue-400">
                  {Math.round(data.summary.recoveryScoreAverage || 0)}
                </span>
                <span className="text-sm text-dark-text-muted">/ 100</span>
              </div>
              <p className="text-xs mt-2 text-dark-text-muted font-medium font-serif">Cohort effectiveness index</p>
              {showRecoveryScoreInfo && (
                <div className="absolute top-full left-0 right-0 z-50 mt-2 p-4 bg-dark-accent border border-dark-border rounded-lg shadow-2xl text-xs font-mono leading-relaxed space-y-2">
                  <p><strong>What it is:</strong> A composite index (0&#8211;100) quantifying how well the cohort is recovering on Impella support.</p>
                  <p><strong>How it is calculated:</strong> Derived from delta CPO, PAPI improvement, RA trend, and inotrope reduction. Higher = better hemodynamic recovery trajectory.</p>
                  <p><strong>How to use it:</strong> Score &gt; 70 suggests favorable weaning candidacy. Score &lt; 40 warrants evaluation for escalation (ECMO/LVAD) rather than weaning.</p>
                </div>
              )}
            </div>

            <div className="lg:col-span-1 bg-dark-accent border border-dark-border p-6 rounded-lg shadow-xl relative">
              <div className="flex justify-between items-start mb-1">
                <p className="text-[10px] font-mono uppercase text-dark-text-muted tracking-widest italic serif">Escalation Flags</p>
                <button onClick={() => setShowEscalationFlagsInfo(!showEscalationFlagsInfo)} className="text-dark-text-muted hover:text-dark-text-primary transition-colors">
                  <Info size={12} />
                </button>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-light tracking-tighter tabular-nums text-orange-400">
                  {data.patients.filter(p => p.isEscalated).length}
                </span>
                <span className="text-sm text-dark-text-muted font-medium">Complex Cases</span>
              </div>
              <p className="text-xs mt-2 text-orange-400/70 font-medium font-serif italic uppercase tracking-tighter">ECMO • LVAD • ARREST</p>
              {showEscalationFlagsInfo && (
                <div className="absolute top-full left-0 right-0 z-50 mt-2 p-4 bg-dark-accent border border-dark-border rounded-lg shadow-2xl text-xs font-mono leading-relaxed space-y-2">
                  <p><strong>What it is:</strong> Number of patients in this cohort who required mechanical circulatory support escalation beyond Impella alone.</p>
                  <p><strong>ECMO:</strong> Extracorporeal membrane oxygenation for refractory cardiogenic shock or biventricular failure.</p>
                  <p><strong>LVAD:</strong> Left ventricular assist device as destination therapy or bridge-to-transplant when native recovery is unlikely.</p>
                  <p><strong>ARREST:</strong> Cardiac arrest while on Impella support — often signals irreversible myocardial damage or severe RV failure.</p>
                  <p><strong>Why it matters:</strong> High escalation count = sicker cohort. Consider earlier advanced heart failure consultation and family counseling.</p>
                </div>
              )}
            </div>

            {/* Cohort Risk Stratification */}
            {data.patients.some(p => p.riskScores) && (
              <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                <RiskMeter
                  label="Mortality Risk"
                  value={data.patients.filter(p => p.riskScores).reduce((sum, p) => sum + (p.riskScores?.survival || 0), 0) / data.patients.filter(p => p.riskScores).length}
                  color="text-red-400"
                  info={
                    <>
                      <p><strong>What it is:</strong> Machine learning estimate of the probability that a patient will not survive to discharge.</p>
                      <p><strong>How it's calculated:</strong> A Random Forest model trained on 185+ features (pre-implant RHC, echo, labs, demographics, Impella settings). The displayed value is the cohort average.</p>
                      <p><strong>What it means:</strong> Higher percentage = worse prognosis. A 30% cohort average means that, on average, 3 in 10 patients in this group are predicted to expire.</p>
                      <p><strong>Limitation:</strong> The survival model has limited predictive power (AUC ~0.54). Do not use this number alone for triage.</p>
                    </>
                  }
                />
                <RiskMeter
                  label="Escalation Risk"
                  value={data.patients.filter(p => p.riskScores).reduce((sum, p) => sum + (p.riskScores?.escalation || 0), 0) / data.patients.filter(p => p.riskScores).length}
                  color="text-orange-400"
                  info={
                    <>
                      <p><strong>What it is:</strong> Machine learning estimate of the probability that a patient will need MCS escalation (ECMO, LVAD, transplant) or will arrest while on Impella.</p>
                      <p><strong>How it's calculated:</strong> A Random Forest model trained on 185+ features. The displayed value is the cohort average of individual patient probabilities.</p>
                      <p><strong>What it means:</strong> Higher = plan early for ECMO/LVAD readiness, ensure crash cart availability, and consider early consultation with advanced heart failure team.</p>
                      <p><strong>Limitation:</strong> AUC ~0.86 on our data, but expect AUC ~0.80–0.85 on new hospital patients.</p>
                    </>
                  }
                />
                <RiskMeter
                  label="RV Dysfunction Risk"
                  value={data.patients.filter(p => p.riskScores).reduce((sum, p) => sum + (p.riskScores?.rvDysfunction || 0), 0) / data.patients.filter(p => p.riskScores).length}
                  color="text-amber-400"
                  info={
                    <>
                      <p><strong>What it is:</strong> Machine learning estimate of the probability that a patient will develop right ventricular failure during Impella support.</p>
                      <p><strong>How it's calculated:</strong> A Logistic Regression model trained on 185+ features. The displayed value is the cohort average.</p>
                      <p><strong>What it means:</strong> Higher = watch for rising RA pressure, falling PAPI, echo signs of RV dilation, and increased inotrope requirements.</p>
                      <p><strong>Limitation:</strong> AUC ~0.92 on our data. RV failure is often a dynamic process — use this as a screening flag, not a definitive diagnosis.</p>
                    </>
                  }
                />
              </div>
            )}

            {/* Clinical Visualizations */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-dark-card border border-dark-border p-6 rounded-xl shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-semibold text-lg flex items-center gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full" /> Hemodynamic Trends</h3>
                  <div className="flex gap-4 text-xs font-mono uppercase text-dark-text-muted">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500/50 rounded-full" /> Delta CPO</span>
                  </div>
                </div>
                <div className="h-[400px] overflow-x-auto custom-scrollbar-h">
                  <div style={{ width: data.patients.length > 30 ? `${data.patients.length * 25}px` : '100%', height: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.patients} margin={{ bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2D3748" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#718096' }} 
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#718096' }} label={{ value: 'Delta CPO (W)', angle: -90, position: 'insideLeft', fill: '#718096', fontSize: 10 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1A1D24', border: '1px solid #2D3748', borderRadius: '8px', color: '#E2E8F0' }}
                          itemStyle={{ fontSize: '12px' }}
                          cursor={{ fill: '#ffffff05' }}
                        />
                        <Bar dataKey="deltaCPO" radius={[2, 2, 0, 0]}>
                          {data.patients.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.deltaCPO >= 0 ? '#34d399' : '#f87171'} fillOpacity={0.6} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

               {/* Risk Grid Scatter */}
               <div className="bg-dark-card border border-dark-border p-6 rounded-xl shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-semibold text-lg flex items-center gap-2"><div className="w-2 h-2 bg-orange-500 rounded-full" /> Risk Distribution</h3>
                  <p className="text-[10px] text-orange-400 flex items-center gap-1 font-mono uppercase italic tracking-tighter"><Info size={10} /> Lower right is critical zone</p>
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
                      <XAxis 
                        type="number" 
                        dataKey="postRA" 
                        name="RA Pressure" 
                        unit=" mmHg" 
                        domain={[0, 40]} 
                        allowDataOverflow={true}
                        label={{ value: 'RA Pressure', position: 'bottom', fontSize: 10, fill: '#718096' }} 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#718096', fontSize: 10 }} 
                      />
                      <YAxis 
                        type="number" 
                        dataKey="postPAPI" 
                        name="PAPI" 
                        unit="" 
                        domain={[0, 5]} 
                        allowDataOverflow={true}
                        label={{ value: 'PAPI', angle: -90, position: 'left', fontSize: 10, fill: '#718096' }} 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#718096', fontSize: 10 }} 
                      />
                      <ZAxis type="number" dataKey="recoveryScore" range={[50, 400]} />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#1A1D24', border: '1px solid #2D3748', color: '#E2E8F0' }} />
                      <Scatter name="Patients" data={data.patients}>
                        {data.patients.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getRiskColor(entry).includes('red') ? '#f87171' : '#60a5fa'} fillOpacity={0.8} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Patient List Sidebar / Prediction */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-dark-accent p-6 rounded-xl shadow-2xl border border-dark-border relative overflow-hidden flex flex-col" style={{ maxHeight: "500px" }}>
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full"></div>
                <h3 className="font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2 shrink-0">
                  <ShieldCheck size={14} className="text-emerald-400" /> ML Survivability
                </h3>
                <div className="max-h-[380px] overflow-y-auto scrollbar-thin scrollbar-thumb-dark-border space-y-5 pr-2 flex-1">
                  {data.predictions && data.predictions.length > 0 ? (
                    data.predictions.map((pred, idx) => {
                      const patient = data.patients.find(p => p.id === pred.patientId);
                      return (
                        <div key={idx} className="pb-2">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-medium text-dark-text-secondary">{patient?.name}</span>
                            <span className={cn("text-[10px] font-mono font-bold tracking-widest", pred.recoveryProbability > 0.7 ? "text-emerald-400" : "text-orange-400")}>
                              {Math.round(pred.recoveryProbability * 100)}%
                            </span>
                          </div>
                          <div className="w-full bg-dark-bg h-1 rounded-full overflow-hidden border border-white/5">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pred.recoveryProbability * 100}%` }}
                              className={cn("h-full shadow-[0_0_8px_rgba(52,211,153,0.3)]", pred.recoveryProbability > 0.7 ? "bg-emerald-400" : "bg-orange-400")}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6">
                      <div className="text-dark-text-muted text-xs mb-2">No survivability predictions available</div>
                      <div className="text-dark-text-muted/60 text-[10px] font-mono">
                        {data.patients.length < 5
                          ? `Need ≥5 patients for LOOCV model (current: ${data.patients.length})`
                          : "Upload Excel file to generate predictions"}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-dark-border shrink-0">
                  <p className="text-[9px] text-dark-text-muted uppercase font-mono leading-tight tracking-tighter">
                    RandomForest (LOOCV) • N={data.patients.length} • Seed 42
                  </p>
                </div>
              </div>

              <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-dark-border bg-dark-accent/50 flex justify-between items-center">
                  <h3 className="font-bold text-xs uppercase tracking-widest italic serif">Patient Records</h3>
                  <button className="text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-all">
                    Export <Download size={10} />
                  </button>
                </div>
                <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-dark-border">
                  {data.patients.map((p, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setActivePatient(p)}
                      className={cn(
                        "w-full text-left p-4 border-b border-dark-border transition-all group relative",
                        activePatient?.id === p.id ? "bg-blue-600 text-white" : "hover:bg-dark-accent"
                      )}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={cn("text-xs font-bold truncate pr-4", activePatient?.id === p.id ? "text-white" : "text-dark-text-primary")}>{p.name}</span>
                        <div className="flex gap-1 items-center">
                          {p.escalationAlert && <AlertTriangle size={12} className={cn("text-red-400 animate-pulse transition-all", activePatient?.id === p.id ? "text-white" : "")} />}
                          {p.isEscalated && !activePatient?.id === p.id && <div className="w-1.5 h-1.5 bg-orange-400 rounded-full shrink-0 shadow-[0_0_5px_rgba(251,146,60,0.5)]" />}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono opacity-60">
                        <span>PAPI: {p.postPAPI.toFixed(1)}</span>
                        <span>CPO: {p.postCPO.toFixed(2)}</span>
                      </div>
                      {activePatient?.id === p.id && <motion.div layoutId="active-indicator" className="absolute left-0 top-0 bottom-0 w-1 bg-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Patient Detail Modal */}
      <AnimatePresence>
        {activePatient && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-20">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-dark-bg/90 backdrop-blur-md"
              onClick={() => setActivePatient(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative bg-dark-card w-full max-w-5xl max-h-full overflow-hidden rounded-xl border border-dark-border shadow-[0_0_100px_rgba(0,0,0,0.5)]"
            >
              <div className="p-10 border-b border-dark-border bg-dark-accent flex justify-between items-end">
                <div>
                  <span className="text-dark-text-muted uppercase tracking-[0.3em] text-[10px] font-bold mb-2 block italic serif">Clinical Profile / Cardiac Analysis</span>
                  <div className="flex items-center gap-4">
                    <h2 className="text-5xl font-light tracking-tight">{activePatient.name}</h2>
                    <div className="flex gap-2">
                      {activePatient.isEscalated && (
                        <span className="bg-orange-500/10 text-orange-400 border border-orange-500/30 text-[10px] px-3 py-1 rounded font-black uppercase tracking-widest shadow-lg shadow-orange-950/20">Escalated</span>
                      )}
                      {activePatient.escalationAlert && (
                        <motion.span 
                          animate={{ opacity: [1, 0.5, 1], scale: [1, 1.05, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="bg-red-500 text-white text-[10px] px-3 py-1 rounded font-black uppercase tracking-widest shadow-lg shadow-red-900/50 flex items-center gap-1"
                        >
                          <AlertTriangle size={10} /> Escalation Alert
                        </motion.span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-6 mt-4 text-xs font-mono text-dark-text-muted">
                    <span>ID: #{activePatient.id.split('-').join('')}00</span>
                    <span>Timing: {activePatient.daysBetweenRhcAndImpella} days post-RHC</span>
                    {activePatient.age && <span>Age: {Math.round(activePatient.age)}</span>}
                    {activePatient.scai && <span>SCAI: {activePatient.scai}</span>}
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="p-4 bg-dark-bg border border-dark-border rounded text-center min-w-[120px]">
                    <div className="text-[10px] text-dark-text-muted uppercase font-black mb-1">Status</div>
                    <div className="text-lg text-emerald-400 font-bold tracking-widest uppercase">Stabilizing</div>
                  </div>
                  <button 
                    onClick={() => setActivePatient(null)}
                    className="bg-dark-border/50 p-2 rounded-full hover:bg-dark-border transition-all h-8 w-8 flex items-center justify-center self-start"
                  >
                    <AlertTriangle size={16} className="rotate-45" />
                  </button>
                </div>
              </div>

              <div className="p-10 grid grid-cols-12 gap-12 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
                <div className="col-span-12 lg:col-span-8 space-y-10">
                  <section>
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-semibold flex items-center gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full" /> Hemodynamic Trends (48h Window)</h3>
                      <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest text-dark-text-muted">
                        <span>Baseline</span>
                        <span>48h Post</span>
                      </div>
                    </div>
                    {activePatient.escalationAlert && (
                      <div className="mb-8 p-4 bg-red-950/30 border-l-4 border-red-500 rounded-r shadow-lg animate-in fade-in slide-in-from-left duration-500">
                        <div className="flex items-center gap-3 text-red-400 mb-2">
                          <AlertTriangle size={18} />
                          <span className="font-bold uppercase tracking-[0.1em] text-xs">Knowledge Base Prioritized Alert</span>
                        </div>
                        <p className="text-sm text-red-200/80 leading-relaxed font-serif italic">
                          This patient's PV Loop (Ees/Ea: {activePatient.eesEa?.toFixed(3)}) mirrors historical outcomes that required critical escalation. Prioritize immediate clinical review and potential escalation preparation.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-16 gap-y-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-dark-border py-3">
                          <span className="text-dark-text-secondary font-medium text-sm">RA Pressure</span>
                          <div className="flex gap-4 items-center">
                            <span className="text-dark-text-muted font-mono text-xs line-through">{activePatient.preRA}</span>
                            <span className={cn("text-3xl font-mono", activePatient.postRA > 20 ? "text-orange-400" : "text-dark-text-primary")}>{activePatient.postRA}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center border-b border-dark-border py-3">
                          <span className="text-dark-text-secondary font-medium text-sm">PCWP (Wedge)</span>
                          <div className="flex gap-4 items-center">
                            <span className="text-dark-text-muted font-mono text-xs line-through">{activePatient.prePCWP}</span>
                            <span className="text-3xl font-mono text-emerald-400">{activePatient.postPCWP}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center border-b border-dark-border py-3">
                          <span className="text-dark-text-secondary font-medium text-sm">CPO (Power)</span>
                          <div className="flex gap-4 items-center">
                            <span className="text-dark-text-muted font-mono text-xs line-through">{activePatient.preCPO.toFixed(2)}</span>
                            <span className="text-3xl font-mono">{activePatient.postCPO.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-dark-border py-4">
                          <span className="text-dark-text-secondary font-medium text-sm">PAPI Index</span>
                          <div className="flex gap-4 items-center">
                            <span className={cn("text-3xl font-mono", activePatient.postPAPI < 1.0 ? "text-red-400" : "text-blue-400")}>{activePatient.postPAPI.toFixed(2)}</span>
                            <span className="text-[10px] text-dark-text-muted font-bold uppercase tracking-widest">{activePatient.postPAPI > 1.5 ? "Good" : "Monitor"}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center border-b border-dark-border py-4">
                          <span className="text-dark-text-secondary font-medium text-sm">PV Loop (Ees/Ea)</span>
                          <div className="flex gap-4 items-center">
                            <span className="text-3xl font-mono text-blue-300">{activePatient.eesEa?.toFixed(3) || "N/A"}</span>
                            <span className="text-[10px] text-dark-text-muted font-bold uppercase tracking-widest italic font-serif">Simulated</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center border-b border-dark-border py-4">
                          <span className="text-dark-text-secondary font-medium text-sm">VIS Score</span>
                          <div className="flex gap-4 items-center">
                            <span className="text-dark-text-muted font-mono text-xs line-through">{activePatient.preVIS}</span>
                            <span className="text-3xl font-mono">{activePatient.postVIS}</span>
                          </div>
                        </div>
                        <div className="p-4 bg-dark-accent rounded-lg flex items-center justify-between border border-white/5">
                           <span className="text-[10px] font-black uppercase text-dark-text-muted tracking-widest">Local Survivability</span>
                           <span className="text-xl font-mono text-blue-400 font-bold">
                             {Math.round((data.predictions?.find(p => p.patientId === activePatient.id)?.recoveryProbability || 0) * 100)}%
                           </span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="bg-dark-accent p-6 rounded-xl border border-dark-border">
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-6"><div className="w-2 h-2 bg-emerald-500 rounded-full" /> Mechanical Support</h3>
                    <div className="grid grid-cols-3 gap-8">
                       <div className="border-r border-dark-border pr-6">
                         <div className="text-[10px] text-dark-text-muted uppercase font-black mb-1">Model</div>
                         <div className="text-xl font-light">Impella CP</div>
                         <div className="text-xs text-blue-400 mt-1 uppercase tracking-widest">Normal Placement</div>
                       </div>
                       <div className="border-r border-dark-border pr-6">
                         <div className="text-[10px] text-dark-text-muted uppercase font-black mb-1">Current Flow</div>
                         <div className="text-3xl font-mono text-emerald-400">{activePatient.impellaFlow}<span className="text-sm ml-1 text-dark-text-muted">L/min</span></div>
                       </div>
                       <div>
                         <div className="text-[10px] text-dark-text-muted uppercase font-black mb-1">P-Level</div>
                         <div className="text-3xl font-mono tracking-tighter">P-{activePatient.performanceLevel}</div>
                       </div>
                    </div>
                  </section>
                </div>

                <div className="col-span-12 lg:col-span-4 space-y-10">
                  <section>
                    <h3 className="text-lg font-semibold mb-6 italic serif">Clinical Outcomes</h3>
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-full border flex items-center justify-center transition-all", activePatient.renalFailure ? "bg-red-900/20 border-red-500/50 text-red-500" : "bg-emerald-900/20 border-emerald-500/50 text-emerald-500")}>
                          {activePatient.renalFailure ? "✕" : "✔"}
                        </div>
                        <div>
                          <div className="font-bold text-sm tracking-wide">Renal Function</div>
                          <div className="text-xs text-dark-text-muted uppercase font-mono">{activePatient.renalFailure ? "Failure Reported" : "Normal Clearance"}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-full border flex items-center justify-center transition-all", activePatient.intubation ? "bg-red-900/20 border-red-500/50 text-red-500" : "bg-emerald-900/20 border-emerald-500/50 text-emerald-500")}>
                          {activePatient.intubation ? "✕" : "✔"}
                        </div>
                        <div>
                          <div className="font-bold text-sm tracking-wide">Airway Status</div>
                          <div className="text-xs text-dark-text-muted uppercase font-mono">{activePatient.intubation ? "Mechanical Vent" : "Spontaneous Breathing"}</div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="border-l-4 border-blue-500 bg-dark-accent p-6 rounded relative shadow-2xl">
                    <h4 className="text-[10px] font-black uppercase text-dark-text-muted tracking-widest mb-4">Attending Clinician Note</h4>
                    <p className="text-sm italic leading-relaxed text-dark-text-secondary">
                      {activePatient.notes || "Initial recovery phase. Hemodynamics within acceptable drift range. Continued monitoring of RV pressures recommended via PAPI indexing."}
                    </p>
                    <div className="mt-6 flex justify-end">
                       <span className="text-[10px] font-mono text-dark-text-muted italic">Digitally Signed // Secure System</span>
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

