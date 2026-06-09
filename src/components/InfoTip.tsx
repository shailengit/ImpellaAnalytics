import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface InfoTipProps {
  children: React.ReactNode;
}

export default function InfoTip({ children }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-dark-text-muted/40 text-dark-text-muted hover:text-dark-text-primary hover:border-dark-text-primary transition-colors text-[10px] font-bold leading-none cursor-pointer shrink-0 ml-1.5"
        title="What's this?"
        aria-label="Show explanation"
      >
        ?
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, maxHeight: 0 }}
            animate={{ opacity: 1, maxHeight: 300 }}
            exit={{ opacity: 0, maxHeight: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="absolute top-6 left-0 z-50 w-72 bg-dark-card border border-dark-border rounded-lg shadow-2xl p-3 text-[11px] leading-relaxed text-dark-text-secondary pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}