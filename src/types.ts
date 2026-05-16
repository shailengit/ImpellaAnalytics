/**
 * Clinical Hemodynamic Metrics for a Patient
 */
export interface PatientData {
  id: string;
  name: string;
  
  // Baseline (Pre)
  preRA: number;     // Right Atrial Pressure
  prePCWP: number;   // Pulmonary Capillary Wedge Pressure
  preCPO: number;    // Cardiac Power Output
  prePAPI: number;   // Pulmonary Artery Pulsatility Index
  preVIS: number;    // Vasoactive Inotropic Score
  
  // 48h Post
  postRA: number;
  postPCWP: number;
  postCPO: number;
  postPAPI: number;
  postVIS: number;
  
  // Support
  impellaFlow: number; // L/min
  performanceLevel: number; // P-level
  
  // Timing
  daysBetweenRhcAndImpella: number;
  
  // Outcomes
  renalFailure: boolean;
  intubation: boolean;
  survived: boolean;
  
  // Qualitative
  notes: string;
  isEscalated: boolean; // Flag if ECMO, LVAD, Arrest, Transplant found in notes

  // Calculated
  deltaCPO: number;
  recoveryScore: number;

  // Knowledge Base Extension
  eesEa?: number;
  escalationAlert?: boolean;
}

export interface AnalyticsResult {
  patients: PatientData[];
  summary: {
    averageDeltaCPO: number;
    riskPatientCount: number;
    recoveryScoreAverage: number;
  };
  predictions?: {
    patientId: string;
    recoveryProbability: number;
  }[];
}
