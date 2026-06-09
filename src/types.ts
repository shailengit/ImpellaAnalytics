/**
 * Clinical Hemodynamic Metrics for a Patient
 */
export interface PatientData {
  id: string;
  name: string;

  // Demographics
  age?: number;
  weightKg?: number;
  heightCm?: number;
  gender?: number;
  race?: number;
  causeOfShock?: number;
  scai?: string;
  daysBetweenRhcAndImpella: number;

  // Pre-implant RHC
  preRA: number;
  preRVSP?: number;
  preRVDP?: number;
  prePASP?: number;
  prePADP?: number;
  preMAP?: number;
  prePCWP: number;
  prePVR?: number;
  preSBP?: number;
  preDBP?: number;
  preHR?: number;
  preTDCO?: number;
  preSV?: number;
  prePaO2?: number;
  preSpO2?: number;
  prePAPI: number;
  preCPO: number;
  preRVCPO?: number;
  preVIS?: number;

  // Post-implant RHC
  postRA: number;
  postRVSP?: number;
  postRVDP?: number;
  postPASP?: number;
  postPADP?: number;
  postMAP?: number;
  postPCWP: number;
  postPVR?: number;
  postSBP?: number;
  postDBP?: number;
  postHR?: number;
  postTDCO?: number;
  postSV?: number;
  postPaO2?: number;
  postSpO2?: number;
  postPAPI: number;
  postCPO: number;
  postRVCPO?: number;
  postVIS?: number;

  // Echo
  preRVEDD?: number;
  preTAPSE?: number;
  preRVS?: number;
  preRVFS?: number;
  preTRSeverity?: number;
  preEchoPASP?: number;
  preLVEDd?: number;
  postRVEDD?: number;
  postTAPSE?: number;
  postRVS?: number;
  postRVFS?: number;
  postTRSeverity?: number;
  postEchoPASP?: number;
  postLVEDd?: number;

  // Labs
  preSodium?: number;
  prePotassium?: number;
  preHCO3?: number;
  preCreatinine?: number;
  preEGFR?: number;
  preHemoglobin?: number;
  preWBC?: number;
  preAST?: number;
  preALT?: number;
  preBili?: number;
  preLactate?: number;
  prePH?: number;
  postSodium?: number;
  postPotassium?: number;
  postHCO3?: number;
  postCreatinine?: number;
  postEGFR?: number;
  postHemoglobin?: number;
  postWBC?: number;
  postAST?: number;
  postALT?: number;
  postBili?: number;
  postLactate?: number;
  postPH?: number;

  // Inotropes / Support
  dopamine?: number;
  dobutamine?: number;
  epinephrine?: number;
  milrinone?: number;
  norepinephrine?: number;
  vasopressin?: number;
  visScore?: number;
  preFurosemide?: number;
  postFurosemide?: number;
  impellaFlow: number;
  performanceLevel: number;

  // PV Loop
  ees?: number;
  ea?: number;
  eesEa?: number;
  esp?: number;
  edp?: number;
  pmax?: number;
  esv?: number;
  edv?: number;
  pvSV?: number;
  dpDtMax?: number;
  dpDtMin?: number;

  // Outcomes
  renalFailure: boolean;
  intubation: boolean;
  survived: boolean;
  notes: string;
  isEscalated: boolean;
  mcsEscalation?: boolean;

  // Calculated
  deltaCPO: number;
  recoveryScore: number;
  escalationAlert?: boolean;

  // ML Risk scores (populated by /api/predict)
  riskScores?: {
    survival?: number;
    escalation?: number;
    rvDysfunction?: number;
  };

  // Weaning & Escalation Checklist Results
  checklistResults?: {
    weaningScore: number;       // Composite weaning index (0-100)
    weaningPassed: boolean;
    escalationWarning: boolean;
    weaningCriteria: { label: string; passed: boolean; value: string; threshold: string; score: number; }[];
    escalationCriteria: { label: string; triggered: boolean; value: string; threshold: string }[];
  };

  // Explainable AI (SHAP Drivers)
  riskDrivers?: {
    survivalDrivers: { feature: string; impact: number; label: string; value: string }[];
    escalationDrivers: { feature: string; impact: number; label: string; value: string }[];
    rvDrivers: { feature: string; impact: number; label: string; value: string }[];
  };

  // AI Shock Team Handoff Summary
  aiClinicalSummary?: string;
}

export interface ClusterAssignment {
  patientId: string;
  cluster_label: number;
  cluster_name: string;
  recommendation: string;
  distances: Record<string, number>;
  similarities: Record<string, number>;
}

export interface ClusterProfile {
  cluster_name: string;
  clinical_recommendation: string;
  patient_count: number;
  survival_rate: number | null;
  escalation_rate: number | null;
  renal_rate: number | null;
  mean_features: Record<string, number>;
  scai_distribution: Record<string, number>;
  mrn_list: string[];
}

export interface ClusterQuality {
  silhouette_score: number;
  n_clusters: number;
  n_features: number;
  n_patients: number;
  clustering_method: string;
  bootstrap_iterations: number;
  interpretation: "weak" | "moderate" | "strong";
  clinical_caution: string;
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
  clusterResults?: Record<string, ClusterAssignment>;
}
