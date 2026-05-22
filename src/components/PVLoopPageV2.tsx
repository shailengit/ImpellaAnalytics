import React, { useState, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/src/lib/utils";
import type { PatientData } from "../types";

interface PVLoopPageV2Props {
  patients: PatientData[];
}

interface PVLoopMetrics {
  ees: number;
  ea: number;
  esp: number;
  edp: number;
  pmax: number;
  eesEa: number;
}

function computeDerivedPV(m: Partial<PVLoopMetrics>): PVLoopMetrics {
  const ees = m.ees ?? 0.5;
  const ea = m.ea ?? 0.3;
  const esp = m.esp ?? 150;
  const edp = m.edp ?? 15;
  const pmax = m.pmax ?? esp;
  const eesEa = ees > 0 ? ees / ea : 0;
  return { ees, ea, esp, edp, pmax, eesEa };
}

function getEesEaZone(e: number): { label: string; color: string; bg: string; border: string } {
  if (e < 1.0) return { label: "High RV Load", color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" };
  if (e < 1.5) return { label: "Intermediate", color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" };
  if (e < 2.5) return { label: "Normal", color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" };
  return { label: "Favorable", color: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" };
}

const PVLoopPageV2 = React.memo(function PVLoopPageV2({ patients }: PVLoopPageV2Props) {
  const [selectedPatient, setSelectedPatient] = useState<PatientData | null>(null);

  const pvData = useMemo(() => {
    return patients
      .filter(p => {
        const m = computeDerivedPV(p);
        return m.eesEa > 0;
      })
      .map(p => {
        const m = computeDerivedPV(p);
        const zone = getEesEaZone(m.eesEa);
        return { ...p, ...m, zone };
      });
  }, [patients]);

  const pvChartData = useMemo(() => {
    return pvData.map(p => ({
      name: p.name,
      ees: p.ees,
      ea: p.ea,
      eesEa: p.eesEa,
      pmax: p.pmax,
      recoveryScore: p.recoveryScore,
    }));
  }, [pvData]);

  const hasPVData = pvData.length > 0;

  const getCellColor = useCallback((eesEa: number) => {
    if (eesEa >= 1.5) return "#34d399";
    if (eesEa >= 1.0) return "#fbbf24";
    return "#f87171";
  }, []);

  if (!hasPVData) {
    return (
      <div className="min-h-screen bg-dark-bg text-dark-text-primary p-6 space-y-8">
        <div className="border-b border-dark-border pb-4">
          <h1 className="text-3xl font-light tracking-tight">
            Pressure-Volume <span className="font-bold">Loop Analysis</span>
          </h1>
          <p className="text-xs font-mono text-dark-text-muted mt-1 uppercase tracking-widest">
            PV Loop Metrics (Ees, Ea, Ees/Ea) — V2 Design
          </p>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center">
          <p className="text-dark-text-muted">No PV Loop data available for this cohort.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text-primary p-6 space-y-8">
      {/* Header */}
      <div className="border-b border-dark-border pb-4">
        <h1 className="text-3xl font-light tracking-tight">
          Pressure-Volume <span className="font-bold">Loop Analysis</span>
        </h1>
        <p className="text-xs font-mono text-dark-text-muted mt-1 uppercase tracking-widest">
          PV Loop Metrics (Ees, Ea, Ees/Ea) · N={pvData.length} patients — V2 Design
        </p>
      </div>

      {/* Zone Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { range: "Ees/Ea < 1.0", label: "High RV Load", color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" },
          { range: "1.0 – 1.5", label: "Intermediate", color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" },
          { range: "1.5 – 2.5", label: "Normal", color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" },
          { range: "> 2.5", label: "Favorable", color: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" },
        ] as const).map(zone => (
          <div key={zone.label} className={cn("border rounded-lg p-3", zone.bg, zone.border)}>
            <div className="text-[10px] text-dark-text-muted uppercase tracking-widest">{zone.range}</div>
            <div className={cn("text-sm font-bold", zone.color)}>{zone.label}</div>
          </div>
        ))}
      </div>

      {/* Ees/Ea Bar Chart */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full" /> Ees/Ea Ratio by Patient
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
                itemStyle={{ fontSize: "12px" }}
              />
              <Bar dataKey="eesEa" radius={[2, 2, 0, 0]}>
                {pvChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getCellColor(entry.eesEa)} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PV Loop Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pvData.map((p, idx) => (
          <button
            key={p.id || idx}
            onClick={() => setSelectedPatient(p)}
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
                {p.eesEa.toFixed(2)}
              </div>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-dark-text-muted">Ees</span>
                <span className="text-dark-text-secondary tabular-nums">{p.ees.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-text-muted">Ea</span>
                <span className="text-dark-text-secondary tabular-nums">{p.ea.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-text-muted">ESP</span>
                <span className="text-dark-text-secondary tabular-nums">{p.esp.toFixed(0)} mmHg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-text-muted">EDP</span>
                <span className="text-dark-text-secondary tabular-nums">{p.edp.toFixed(0)} mmHg</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border", p.zone.color, p.zone.bg, p.zone.border)}>
                  {p.zone.label}
                </span>
                <span className="text-dark-text-muted">Recovery: {p.recoveryScore.toFixed(0)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Selected Patient Detail */}
      {selectedPatient && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
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
              { label: "Ees (End-Systolic Elastance)", value: selectedPatient.ees?.toFixed(3) || "N/A", unit: "mmHg/mL" },
              { label: "Ea (Arterial Elastance)", value: selectedPatient.ea?.toFixed(3) || "N/A", unit: "mmHg/mL" },
              { label: "Ees/Ea Ratio", value: selectedPatient.eesEa?.toFixed(3) || "N/A", unit: "" },
              { label: "ESP (End-Systolic Pressure)", value: selectedPatient.esp?.toFixed(0) || "N/A", unit: "mmHg" },
              { label: "EDP (End-Diastolic Pressure)", value: selectedPatient.edp?.toFixed(0) || "N/A", unit: "mmHg" },
              { label: "Pmax", value: selectedPatient.pmax?.toFixed(0) || "N/A", unit: "mmHg" },
              { label: "ESV (End-Systolic Volume)", value: selectedPatient.esv?.toFixed(1) || "N/A", unit: "mL" },
              { label: "EDV (End-Diastolic Volume)", value: selectedPatient.edv?.toFixed(1) || "N/A", unit: "mL" },
              { label: "Stroke Volume (PV)", value: selectedPatient.pvSV?.toFixed(1) || "N/A", unit: "mL" },
            ].map(metric => (
              <div key={metric.label} className="flex justify-between items-center border-b border-dark-border/50 py-2">
                <span className="text-dark-text-muted">{metric.label}</span>
                <span className="text-dark-text-primary font-bold tabular-nums">
                  {metric.value} {metric.unit && <span className="text-dark-text-muted text-[10px]">{metric.unit}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default PVLoopPageV2;
