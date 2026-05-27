import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  Activity, 
  ArrowLeft, 
  CheckCircle2, 
  AlertOctagon, 
  Flame, 
  Sliders, 
  Sparkles, 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  RotateCcw, 
  HelpCircle, 
  ChevronRight,
  ShieldCheck,
  Zap,
  Clock,
  Heart
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import type { PatientData } from "../types";
import RiskMeter from "./RiskMeter";

interface ActivePatientMonitorProps {
  patient: PatientData;
  onBack: () => void;
  useLLM: boolean;
}

export default function ActivePatientMonitor({ patient: initialPatient, onBack, useLLM }: ActivePatientMonitorProps) {
  const [patient, setPatient] = useState<PatientData>(initialPatient);
  const [originalPatient] = useState<PatientData>(initialPatient);
  
  // Simulator State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simFlow, setSimFlow] = useState(initialPatient.impellaFlow);
  const [simPLevel, setSimPLevel] = useState(initialPatient.performanceLevel);
  const [simVIS, setSimVIS] = useState(
    initialPatient.postVIS !== undefined 
      ? initialPatient.postVIS 
      : (initialPatient.visScore !== undefined ? initialPatient.visScore : 0)
  );
  const [simLactate, setSimLactate] = useState(initialPatient.postLactate !== undefined ? initialPatient.postLactate : 1.5);
  const [simRA, setSimRA] = useState(initialPatient.postRA);
  const [simPAPI, setSimPAPI] = useState(initialPatient.postPAPI);
  const [simCPO, setSimCPO] = useState(initialPatient.postCPO);

  // AI Handoff Memo State
  const [aiMemo, setAiMemo] = useState<{ impression: string; hemodynamics: string; risk: string; management: string } | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<number>(0);

  const toggleSection = (idx: number) => {
    setOpenSection(prev => prev === idx ? -1 : idx);
  };

  // Cluster assignment for this patient
  const [clusterInfo, setClusterInfo] = useState<{ name: string; rec: string } | null>(null);

  // Fetch AI Handoff Note on mount (passes useLLM flag to server)
  useEffect(() => {
    setLoadingAi(true);
    setAiError(null);
    axios.post("/api/generate-summary", { ...initialPatient, useLLM })
      .then(res => {
        const s = res.data.summary;
        if (typeof s === "string") {
          // Backward compat: old string format wraps into impression card
          setAiMemo({ impression: s, hemodynamics: "", risk: "", management: "" });
        } else {
          setAiMemo({ impression: s.impression || "", hemodynamics: s.hemodynamics || "", risk: s.risk || "", management: s.management || "" });
        }
      })
      .catch(() => {
        setAiError("Failed to synthesize huddle note.");
      })
      .finally(() => {
        setLoadingAi(false);
      });
  }, [initialPatient, useLLM]);

  // Load patient cluster assignment
  useEffect(() => {
    axios.post("/api/cluster", initialPatient)
      .then(res => {
        if (res.data.cluster) {
          setClusterInfo({
            name: res.data.cluster.clusterName,
            rec: res.data.cluster.recommendation
          });
        }
      })
      .catch(() => {
        console.log("Phenotypic clustering not available for this patient");
      });
  }, [initialPatient]);

  // Handle Dynamic Simulation
  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const response = await axios.post("/api/simulate", {
        patient: originalPatient,
        adjustments: {
          impellaFlow: simFlow,
          performanceLevel: simPLevel,
          postVIS: simVIS,
          postLactate: simLactate,
          postRA: simRA,
          postPAPI: simPAPI,
          postCPO: simCPO,
        }
      });
      setPatient(response.data.patient);
    } catch (err) {
      console.error("Simulation request failed", err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Reset Simulation
  const handleReset = () => {
    setPatient(originalPatient);
    setSimFlow(originalPatient.impellaFlow);
    setSimPLevel(originalPatient.performanceLevel);
    setSimVIS(
      originalPatient.postVIS !== undefined 
        ? originalPatient.postVIS 
        : (originalPatient.visScore !== undefined ? originalPatient.visScore : 0)
    );
    setSimLactate(originalPatient.postLactate !== undefined ? originalPatient.postLactate : 1.5);
    setSimRA(originalPatient.postRA);
    setSimPAPI(originalPatient.postPAPI);
    setSimCPO(originalPatient.postCPO);
  };

  // Get primary status indicator
  const getClinicalStatus = () => {
    if (patient.checklistResults?.escalationWarning) {
      return {
        label: "CRITICAL / MONITOR RV",
        color: "text-red-400 bg-red-950/20 border-red-500/30",
        ring: "ring-red-500/20",
        bullet: "bg-red-500 shadow-[0_0_10px_#f87171]"
      };
    }
    if (patient.checklistResults?.weaningPassed) {
      return {
        label: "WEANING CANDIDATE",
        color: "text-emerald-400 bg-emerald-950/20 border-emerald-500/30",
        ring: "ring-emerald-500/20",
        bullet: "bg-emerald-500 shadow-[0_0_10px_#34d399]"
      };
    }
    return {
      label: "BORDERLINE / WATCH TRENDS",
      color: "text-amber-400 bg-amber-950/20 border-amber-500/30",
      ring: "ring-amber-500/20",
      bullet: "bg-amber-500 shadow-[0_0_10px_#fbbf24]"
    };
  };

  const status = getClinicalStatus();

  // Helper for trend direction
  const renderTrend = (pre: number | undefined, post: number, invert = false) => {
    if (pre === undefined) return null;
    const diff = post - pre;
    if (Math.abs(diff) < 0.01) return <span className="text-dark-text-muted">→ Stable</span>;
    
    const isGood = invert ? diff < 0 : diff > 0;
    if (isGood) {
      return (
        <span className="text-emerald-400 flex items-center gap-0.5 font-medium">
          <TrendingUp size={12} /> Improving ({diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)})
        </span>
      );
    }
    return (
      <span className="text-orange-400 flex items-center gap-0.5 font-medium">
        <TrendingDown size={12} /> Declining ({diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)})
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Telemetry Header */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 blur-3xl rounded-full"></div>
        <div className="flex items-center gap-4 z-10">
          <button
            onClick={onBack}
            className="p-2 border border-dark-border rounded-md hover:bg-dark-accent transition-all text-dark-text-secondary"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-light tracking-tight text-white">{patient.name}</h1>
              <div className={cn("px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border flex items-center gap-2", status.color)}>
                <div className={cn("w-1.5 h-1.5 rounded-full", status.bullet)}></div>
                {status.label}
              </div>
            </div>
            <div className="flex gap-4 mt-2 text-xs font-mono text-dark-text-muted">
              <span>MRN: #{patient.id.replace(/-/g, '').slice(0, 10)}</span>
              <span>•</span>
              <span>Age: {Math.round(patient.age ?? 60)} yo</span>
              <span>•</span>
              <span>Shock Stage: SCAI {patient.scai ?? "C"}</span>
              {clusterInfo && (
                <>
                  <span>•</span>
                  <span className="text-blue-400">Phenotype: {clusterInfo.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-4 z-10 w-full md:w-auto self-stretch md:self-auto border-t md:border-t-0 pt-4 md:pt-0 border-dark-border">
          <div className="flex-1 md:flex-initial p-4 bg-dark-accent/40 border border-dark-border rounded-lg text-center min-w-[130px]">
            <span className="text-[10px] text-dark-text-muted uppercase font-black tracking-widest block mb-1">Weaning Index</span>
            <div className="flex items-baseline justify-center gap-1">
              <span className={cn("text-3xl font-mono font-bold tracking-tighter", patient.checklistResults?.weaningPassed ? "text-emerald-400" : "text-amber-400")}>
                {patient.checklistResults?.weaningScore}
              </span>
              <span className="text-xs text-dark-text-muted">/100</span>
            </div>
          </div>
          <div className="flex-1 md:flex-initial p-4 bg-dark-accent/40 border border-dark-border rounded-lg text-center min-w-[130px]">
            <span className="text-[10px] text-dark-text-muted uppercase font-black tracking-widest block mb-1">Ees/Ea Coupling</span>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-mono font-bold tracking-tighter text-blue-300">
                {patient.eesEa ? patient.eesEa.toFixed(2) : "N/A"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left 8 Columns: Telemetry, Checklists, Simulator */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Section 1: Checklists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Weaning Checklist */}
            <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-2xl space-y-4">
              <h3 className="font-semibold text-sm uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <CheckCircle2 size={16} /> Weaning Readiness Assessment
              </h3>
              <div className="space-y-3.5 pt-2">
                {patient.checklistResults?.weaningCriteria.map((item, index) => (
                  <div key={index} className="flex justify-between items-center border-b border-dark-border/40 pb-2 text-sm">
                    <span className="text-dark-text-secondary">{item.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-dark-text-muted pr-1">{item.value}</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-sm text-[9px] font-mono font-bold tracking-widest uppercase",
                        item.passed ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-dark-accent text-dark-text-muted border border-dark-border"
                      )}>
                        {item.passed ? "PASSED" : "UNMET"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 text-xs leading-relaxed text-dark-text-secondary flex gap-2 items-start mt-2">
                <Clock size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <p>Weaning requires at least 4 out of 5 criteria to pass. Always down-titrate Impella flow gradually under direct ICU waveform observation.</p>
              </div>
            </div>

            {/* Escalation Warnings */}
            <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-2xl space-y-4">
              <h3 className="font-semibold text-sm uppercase tracking-widest text-red-400 flex items-center gap-2">
                <AlertOctagon size={16} className="animate-pulse" /> Escalation Danger Flags
              </h3>
              <div className="space-y-3.5 pt-2">
                {patient.checklistResults?.escalationCriteria.map((item, index) => (
                  <div key={index} className="flex justify-between items-center border-b border-dark-border/40 pb-2 text-sm">
                    <span className="text-dark-text-secondary">{item.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-dark-text-muted pr-1">{item.value}</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-sm text-[9px] font-mono font-bold tracking-widest uppercase",
                        item.triggered ? "bg-red-500 text-white shadow-lg shadow-red-950/20" : "bg-dark-accent text-dark-text-muted border border-dark-border"
                      )}>
                        {item.triggered ? "ALERT" : "STABLE"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 text-xs leading-relaxed text-dark-text-secondary flex gap-2 items-start mt-2">
                <Flame size={14} className="text-red-400 shrink-0 mt-0.5" />
                <p>Any primary alert triggers heightened Shock Team surveillance. Prepare bedside parameters for potential ECMO (ECpella) or right ventricular support.</p>
              </div>
            </div>
          </div>

          {/* Section 2: What-If Treatment Simulator */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-xl"></div>
            <div className="flex justify-between items-center border-b border-dark-border/60 pb-4">
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Sliders size={18} className="text-blue-400" /> Bedside "What-If" Treatment Simulator
                </h3>
                <p className="text-[10px] text-dark-text-muted uppercase font-mono mt-0.5 tracking-wider">
                  Virtually test clinical titrations and observe automated ML risk changes
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dark-border hover:bg-dark-accent text-xs font-medium font-mono text-dark-text-secondary transition-all"
                >
                  <RotateCcw size={12} /> Reset
                </button>
                <button
                  onClick={handleSimulate}
                  disabled={isSimulating}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-mono tracking-widest shadow-lg shadow-blue-900/20 transition-all uppercase disabled:opacity-50"
                >
                  {isSimulating ? "Recalculating..." : "Run Simulator"}
                </button>
              </div>
            </div>

            {/* Slider Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-2">
              {/* Slider 1: Flow */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-dark-text-secondary font-medium">Impella Flow Control</span>
                  <span className="text-blue-400 font-bold">{simFlow.toFixed(1)} L/min (P-{simPLevel})</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="5.0" 
                  step="0.1" 
                  value={simFlow} 
                  onChange={(e) => {
                    const f = parseFloat(e.target.value);
                    setSimFlow(f);
                    // Match flow roughly to P-levels
                    setSimPLevel(Math.min(9, Math.max(1, Math.round(f * 2))));
                  }}
                  className="w-full h-1.5 bg-dark-bg rounded-lg appearance-none cursor-pointer accent-blue-500 border border-white/5"
                />
              </div>

              {/* Slider 2: VIS */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-dark-text-secondary font-medium">Vasopressor Burden (VIS)</span>
                  <span className={cn("font-bold", simVIS > 15 ? "text-orange-400" : "text-emerald-400")}>{simVIS}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="40" 
                  step="1" 
                  value={simVIS} 
                  onChange={(e) => setSimVIS(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-dark-bg rounded-lg appearance-none cursor-pointer accent-blue-500 border border-white/5"
                />
              </div>

              {/* Slider 3: PAPI */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-dark-text-secondary font-medium">RV Pulsatility Index (PAPI)</span>
                  <span className={cn("font-bold", simPAPI < 1.0 ? "text-red-400" : "text-blue-400")}>{simPAPI.toFixed(2)}</span>
                </div>
                <input 
                  type="range" 
                  min="0.1" 
                  max="4.0" 
                  step="0.05" 
                  value={simPAPI} 
                  onChange={(e) => setSimPAPI(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-dark-bg rounded-lg appearance-none cursor-pointer accent-blue-500 border border-white/5"
                />
              </div>

              {/* Slider 4: Lactate */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-dark-text-secondary font-medium">Serum Lactate</span>
                  <span className={cn("font-bold", simLactate > 3.0 ? "text-red-400" : "text-emerald-400")}>{simLactate.toFixed(1)} mmol/L</span>
                </div>
                <input 
                  type="range" 
                  min="0.2" 
                  max="10.0" 
                  step="0.1" 
                  value={simLactate} 
                  onChange={(e) => setSimLactate(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-dark-bg rounded-lg appearance-none cursor-pointer accent-blue-500 border border-white/5"
                />
              </div>

              {/* Slider 5: RA */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-dark-text-secondary font-medium">Right Atrial Pressure</span>
                  <span className={cn("font-bold", simRA > 20 ? "text-red-400" : "text-emerald-400")}>{simRA} mmHg</span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="35" 
                  step="1" 
                  value={simRA} 
                  onChange={(e) => setSimRA(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-dark-bg rounded-lg appearance-none cursor-pointer accent-blue-500 border border-white/5"
                />
              </div>

              {/* Slider 6: postCPO */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-dark-text-secondary font-medium">Cardiac Power Output (CPO)</span>
                  <span className={cn("font-bold", simCPO >= 0.6 ? "text-emerald-400" : "text-amber-400")}>{simCPO.toFixed(2)} W</span>
                </div>
                <input 
                  type="range" 
                  min="0.1" 
                  max="2.0" 
                  step="0.05" 
                  value={simCPO} 
                  onChange={(e) => setSimCPO(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-dark-bg rounded-lg appearance-none cursor-pointer accent-blue-500 border border-white/5"
                />
              </div>
            </div>

            {/* Simulated Prediction Visualizer */}
            {patient.riskScores && (
              <div className="bg-dark-accent/40 border border-dark-border rounded-xl p-4 mt-6">
                <div className="text-[10px] text-dark-text-muted font-mono uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Zap size={10} className="text-yellow-400 shrink-0" /> Live Simulated Risk Outputs (Recalculated)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-3 bg-dark-card border border-dark-border/40 rounded-lg">
                    <span className="text-xs font-mono text-dark-text-secondary">Survival Risk</span>
                    <span className="text-lg font-mono font-bold text-red-400">
                      {Math.round((patient.riskScores.survival ?? 0) * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-dark-card border border-dark-border/40 rounded-lg">
                    <span className="text-xs font-mono text-dark-text-secondary">Escalation Risk</span>
                    <span className="text-lg font-mono font-bold text-orange-400">
                      {Math.round((patient.riskScores.escalation ?? 0) * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-dark-card border border-dark-border/40 rounded-lg">
                    <span className="text-xs font-mono text-dark-text-secondary">RV Failure Risk</span>
                    <span className="text-lg font-mono font-bold text-amber-400">
                      {Math.round((patient.riskScores.rvDysfunction ?? 0) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right 4 Columns: Explainable AI & Shock Team Memo */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Explainable AI Risk Drivers */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-2xl space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-widest text-blue-400 flex items-center gap-2">
              <Brain size={16} /> Explainable AI (Bedside Drivers)
            </h3>
            <p className="text-[10px] text-dark-text-muted font-mono leading-relaxed">
              Top specific clinical parameters driving risk predictions for this patient:
            </p>
            
            {patient.riskDrivers && (
              <div className="space-y-4 pt-2">
                {/* RV Dysfunction drivers */}
                <div className="bg-dark-accent/40 rounded-lg border border-dark-border p-3.5 space-y-2.5">
                  <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">RV Dysfunction Drivers</span>
                  <div className="space-y-2">
                    {patient.riskDrivers.rvDrivers.map((driver, idx) => (
                      <div key={idx} className="flex justify-between items-start text-xs border-b border-dark-border/20 pb-1.5">
                        <span className="text-dark-text-secondary pr-4 font-serif italic">{driver.label}</span>
                        <span className={cn(
                          "font-mono font-bold whitespace-nowrap",
                          driver.impact > 0 ? "text-orange-400" : "text-emerald-400"
                        )}>
                          {driver.impact > 0 ? "+" : ""}{Math.round(driver.impact * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Escalation Drivers */}
                <div className="bg-dark-accent/40 rounded-lg border border-dark-border p-3.5 space-y-2.5">
                  <span className="text-[10px] font-mono font-bold text-orange-400 uppercase tracking-widest">MCS Escalation Drivers</span>
                  <div className="space-y-2">
                    {patient.riskDrivers.escalationDrivers.map((driver, idx) => (
                      <div key={idx} className="flex justify-between items-start text-xs border-b border-dark-border/20 pb-1.5">
                        <span className="text-dark-text-secondary pr-4 font-serif italic">{driver.label}</span>
                        <span className={cn(
                          "font-mono font-bold whitespace-nowrap",
                          driver.impact > 0 ? "text-orange-400" : "text-emerald-400"
                        )}>
                          {driver.impact > 0 ? "+" : ""}{Math.round(driver.impact * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Shock Team Handoff Memo */}
          <div className="bg-dark-card border border-dark-border rounded-xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 blur-xl"></div>

            {/* Header */}
            <div className="p-6 pb-0 flex items-center justify-between">
              <h3 className={cn("font-semibold text-sm uppercase tracking-widest flex items-center gap-2", useLLM ? "text-purple-400" : "text-dark-text-muted")}>
                <Sparkles size={16} /> Clinical Huddle Memo
              </h3>
              <span className={cn(
                "text-[9px] font-mono uppercase tracking-widest border px-2 py-0.5 rounded-sm font-bold",
                useLLM
                  ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
                  : "text-amber-400 border-amber-500/30 bg-amber-500/5"
              )}>
                {useLLM ? "LLM" : "No LLM"}
              </span>
            </div>

            {loadingAi ? (
              <div className="p-12 flex flex-col items-center justify-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent shadow-[0_0_10px_#a855f7]"></div>
                <span className="text-[10px] uppercase font-mono text-dark-text-muted tracking-widest animate-pulse">Drafting clinical briefing...</span>
              </div>
            ) : aiError ? (
              <div className="m-6 text-xs text-red-400 border border-red-500/30 bg-red-950/10 rounded-lg p-4 font-mono leading-relaxed">
                {aiError}
              </div>
            ) : aiMemo ? (
              <div className="mt-4 divide-y divide-dark-border/60">
                {/* Clinical Impression */}
                {aiMemo.impression && (
                <div className="bg-gradient-to-r from-purple-500/[0.08] to-transparent border-l-4 border-purple-400">
                  <div className="flex items-center justify-between px-5 py-4 cursor-pointer select-none" onClick={() => toggleSection(0)}>
                    <div className="text-[10px] font-bold text-purple-300 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="text-purple-400">✦</span> Clinical Impression
                    </div>
                    <span className="text-purple-400 text-[10px] transition-transform duration-300">{openSection === 0 ? "▼" : "▶"}</span>
                  </div>
                  <div className={`overflow-hidden transition-all duration-300 ${openSection === 0 ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
                    <div className="px-5 pb-4">
                      <div className="text-[11px] leading-relaxed text-slate-100 font-mono">{aiMemo.impression}</div>
                    </div>
                  </div>
                </div>
                )}

                {/* Hemodynamic Spotlight */}
                {aiMemo.hemodynamics && (
                <div className="bg-gradient-to-r from-emerald-500/[0.07] to-transparent border-l-4 border-emerald-400">
                  <div className="flex items-center justify-between px-5 py-4 cursor-pointer select-none" onClick={() => toggleSection(1)}>
                    <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="text-emerald-400">✦</span> Hemodynamic Spotlight
                    </div>
                    <span className="text-emerald-400 text-[10px] transition-transform duration-300">{openSection === 1 ? "▼" : "▶"}</span>
                  </div>
                  <div className={`overflow-hidden transition-all duration-300 ${openSection === 1 ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
                    <div className="px-5 pb-4">
                      <div className="text-[11px] leading-relaxed text-slate-100 font-mono">{aiMemo.hemodynamics}</div>
                    </div>
                  </div>
                </div>
                )}

                {/* Risk Assessment */}
                {aiMemo.risk && (
                <div className="bg-gradient-to-r from-amber-500/[0.07] to-transparent border-l-4 border-amber-400">
                  <div className="flex items-center justify-between px-5 py-4 cursor-pointer select-none" onClick={() => toggleSection(2)}>
                    <div className="text-[10px] font-bold text-amber-300 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="text-amber-400">✦</span> Risk Assessment
                    </div>
                    <span className="text-amber-400 text-[10px] transition-transform duration-300">{openSection === 2 ? "▼" : "▶"}</span>
                  </div>
                  <div className={`overflow-hidden transition-all duration-300 ${openSection === 2 ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
                    <div className="px-5 pb-4">
                      <div className="text-[11px] leading-relaxed text-slate-100 font-mono">{aiMemo.risk}</div>
                    </div>
                  </div>
                </div>
                )}

                {/* Management Plan */}
                {aiMemo.management && (
                <div className="bg-gradient-to-r from-blue-500/[0.07] to-transparent border-l-4 border-blue-400">
                  <div className="flex items-center justify-between px-5 py-4 cursor-pointer select-none" onClick={() => toggleSection(3)}>
                    <div className="text-[10px] font-bold text-blue-300 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="text-blue-400">✦</span> Management Plan
                    </div>
                    <span className="text-blue-400 text-[10px] transition-transform duration-300">{openSection === 3 ? "▼" : "▶"}</span>
                  </div>
                  <div className={`overflow-hidden transition-all duration-300 ${openSection === 3 ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
                    <div className="px-5 pb-4">
                      <div className="text-[11px] leading-relaxed text-slate-100 font-mono whitespace-pre-line">{aiMemo.management}</div>
                    </div>
                  </div>
                </div>
                )}
              </div>
            ) : null}

            {/* Footer */}
            <div className="px-5 py-3 border-t border-dark-border/40 flex justify-between items-center bg-dark-accent/20">
              <span className="text-[8px] font-mono text-dark-text-muted uppercase tracking-wider">
                {useLLM ? "Generated via AI" : "Template-Based Summary"}
              </span>
              <span className="text-[8px] font-mono text-dark-text-muted">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* Section 4: Longitudinal Hemodynamic Trajectories (Sparkline cards) */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-2xl">
        <h3 className="font-semibold text-sm uppercase tracking-widest mb-6 flex items-center gap-2 text-white">
          <Heart size={16} className="text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]" /> Longitudinal Telemetry Trajectories (Pre vs 48h Post)
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {/* Metric 1: CPO */}
          <div className="bg-dark-accent/30 border border-dark-border/60 rounded-xl p-4 space-y-2">
            <span className="text-[10px] font-mono text-dark-text-muted uppercase block">Cardiac Power Output (CPO)</span>
            <div className="flex justify-between items-baseline pt-1">
              <div className="text-sm font-mono text-dark-text-secondary font-medium">
                {patient.preCPO?.toFixed(2) || "0.00"} <span className="text-[10px] text-dark-text-muted">pre</span>
              </div>
              <ChevronRight size={12} className="text-dark-text-muted" />
              <div className="text-2xl font-mono font-bold text-white">
                {patient.postCPO?.toFixed(2) || "0.00"} <span className="text-xs text-dark-text-muted">post</span>
              </div>
            </div>
            <div className="pt-2 flex justify-between items-center text-[10px]">
              <span className="text-dark-text-muted">CPO Trend</span>
              {renderTrend(patient.preCPO, patient.postCPO)}
            </div>
          </div>

          {/* Metric 2: PAPI */}
          <div className="bg-dark-accent/30 border border-dark-border/60 rounded-xl p-4 space-y-2">
            <span className="text-[10px] font-mono text-dark-text-muted uppercase block">Right Heart Index (PAPI)</span>
            <div className="flex justify-between items-baseline pt-1">
              <div className="text-sm font-mono text-dark-text-secondary font-medium">
                {patient.prePAPI?.toFixed(2) || "0.00"} <span className="text-[10px] text-dark-text-muted">pre</span>
              </div>
              <ChevronRight size={12} className="text-dark-text-muted" />
              <div className="text-2xl font-mono font-bold text-white">
                {patient.postPAPI?.toFixed(2) || "0.00"} <span className="text-xs text-dark-text-muted">post</span>
              </div>
            </div>
            <div className="pt-2 flex justify-between items-center text-[10px]">
              <span className="text-dark-text-muted">RV Trend</span>
              {renderTrend(patient.prePAPI, patient.postPAPI)}
            </div>
          </div>

          {/* Metric 3: Lactate */}
          <div className="bg-dark-accent/30 border border-dark-border/60 rounded-xl p-4 space-y-2">
            <span className="text-[10px] font-mono text-dark-text-muted uppercase block">Serum Lactate</span>
            <div className="flex justify-between items-baseline pt-1">
              <div className="text-sm font-mono text-dark-text-secondary font-medium">
                {patient.preLactate !== undefined ? `${patient.preLactate.toFixed(1)}` : "N/A"} <span className="text-[10px] text-dark-text-muted">pre</span>
              </div>
              <ChevronRight size={12} className="text-dark-text-muted" />
              <div className="text-2xl font-mono font-bold text-white">
                {patient.postLactate !== undefined ? `${patient.postLactate.toFixed(1)}` : "N/A"} <span className="text-xs text-dark-text-muted">post</span>
              </div>
            </div>
            <div className="pt-2 flex justify-between items-center text-[10px]">
              <span className="text-dark-text-muted">Perfusion Trend</span>
              {patient.preLactate !== undefined && patient.postLactate !== undefined 
                ? renderTrend(patient.preLactate, patient.postLactate, true)
                : <span className="text-dark-text-muted">No baseline</span>
              }
            </div>
          </div>

          {/* Metric 4: RA Pressure */}
          <div className="bg-dark-accent/30 border border-dark-border/60 rounded-xl p-4 space-y-2">
            <span className="text-[10px] font-mono text-dark-text-muted uppercase block">RA Pressure (Congestion)</span>
            <div className="flex justify-between items-baseline pt-1">
              <div className="text-sm font-mono text-dark-text-secondary font-medium">
                {patient.preRA} <span className="text-[10px] text-dark-text-muted">pre</span>
              </div>
              <ChevronRight size={12} className="text-dark-text-muted" />
              <div className="text-2xl font-mono font-bold text-white">
                {patient.postRA} <span className="text-xs text-dark-text-muted">post</span>
              </div>
            </div>
            <div className="pt-2 flex justify-between items-center text-[10px]">
              <span className="text-dark-text-muted">Congestion Trend</span>
              {renderTrend(patient.preRA, patient.postRA, true)}
            </div>
          </div>

          {/* Metric 5: PCWP */}
          <div className="bg-dark-accent/30 border border-dark-border/60 rounded-xl p-4 space-y-2">
            <span className="text-[10px] font-mono text-dark-text-muted uppercase block">Wedge Pressure (PCWP)</span>
            <div className="flex justify-between items-baseline pt-1">
              <div className="text-sm font-mono text-dark-text-secondary font-medium">
                {patient.prePCWP} <span className="text-[10px] text-dark-text-muted">pre</span>
              </div>
              <ChevronRight size={12} className="text-dark-text-muted" />
              <div className="text-2xl font-mono font-bold text-white">
                {patient.postPCWP} <span className="text-xs text-dark-text-muted">post</span>
              </div>
            </div>
            <div className="pt-2 flex justify-between items-center text-[10px]">
              <span className="text-dark-text-muted">LV Afterload Trend</span>
              {renderTrend(patient.prePCWP, patient.postPCWP, true)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
