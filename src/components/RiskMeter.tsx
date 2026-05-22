import React from "react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";
import { Info } from "lucide-react";

interface RiskMeterProps {
  label: string;
  value: number;
  color: string;
  info: React.ReactNode;
}

const bgMap: Record<string, string> = {
  "text-red-400": "bg-red-400",
  "text-orange-400": "bg-orange-400",
  "text-amber-400": "bg-amber-400",
  "text-emerald-400": "bg-emerald-400",
  "text-blue-400": "bg-blue-400",
};

export default function RiskMeter({ label, value, color, info }: RiskMeterProps) {
  const pct = Math.min(100, Math.max(0, value * 100));
  const [showInfo, setShowInfo] = React.useState(false);

  return (
    <div className="bg-dark-card border border-dark-border p-4 rounded-lg shadow-xl relative">
      <div className="flex justify-between items-start mb-2">
        <span className={cn("text-xs font-bold uppercase tracking-widest", color)}>{label}</span>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-dark-text-muted hover:text-dark-text-primary transition-colors"
        >
          <Info size={12} />
        </button>
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className={cn("text-3xl font-light tracking-tighter tabular-nums", color)}>
          {pct.toFixed(0)}%
        </span>
        <span className="text-xs text-dark-text-muted">cohort avg</span>
      </div>
      <div className="w-full bg-dark-bg h-2 rounded-full overflow-hidden border border-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn("h-full", bgMap[color] || color.replace("text-", "bg-"))}
        />
      </div>

      {showInfo && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 p-4 bg-dark-accent border border-dark-border rounded-lg shadow-2xl text-xs font-mono leading-relaxed space-y-2">
          {info}
        </div>
      )}
    </div>
  );
}
