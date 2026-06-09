import weights from "./model-weights.json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PatientInput {
  id: string;
  name?: string;
  age?: number;
  weightKg?: number;
  heightCm?: number;
  gender?: number;
  race?: number;
  causeOfShock?: number;
  scai?: string | number;
  daysBetweenRhcAndImpella?: number;
  preRA?: number; postRA?: number;
  preRVSP?: number; postRVSP?: number;
  preRVDP?: number; postRVDP?: number;
  prePASP?: number; postPASP?: number;
  prePADP?: number; postPADP?: number;
  preMAP?: number; postMAP?: number;
  prePCWP?: number; postPCWP?: number;
  prePVR?: number; postPVR?: number;
  preSBP?: number; postSBP?: number;
  preDBP?: number; postDBP?: number;
  preHR?: number; postHR?: number;
  preTDCO?: number; postTDCO?: number;
  preSV?: number; postSV?: number;
  prePaO2?: number; postPaO2?: number;
  preSpO2?: number; postSpO2?: number;
  prePAPI?: number; postPAPI?: number;
  preCPO?: number; postCPO?: number;
  preRVCPO?: number; postRVCPO?: number;
  preRVEDD?: number; postRVEDD?: number;
  preTAPSE?: number; postTAPSE?: number;
  preRVS?: number; postRVS?: number;
  preRVFS?: number; postRVFS?: number;
  preTRSeverity?: number; postTRSeverity?: number;
  preEchoPASP?: number; postEchoPASP?: number;
  preLVEDd?: number; postLVEDd?: number;
  preSodium?: number; postSodium?: number;
  prePotassium?: number; postPotassium?: number;
  preHCO3?: number; postHCO3?: number;
  preCreatinine?: number; postCreatinine?: number;
  preEGFR?: number; postEGFR?: number;
  preHemoglobin?: number; postHemoglobin?: number;
  preWBC?: number; postWBC?: number;
  preAST?: number; postAST?: number;
  preALT?: number; postALT?: number;
  preBili?: number; postBili?: number;
  preLactate?: number; postLactate?: number;
  prePH?: number; postPH?: number;
  dopamine?: number; dobutamine?: number;
  epinephrine?: number; milrinone?: number;
  norepinephrine?: number; vasopressin?: number;
  visScore?: number;
  preFurosemide?: number; postFurosemide?: number;
  performanceLevel?: number;
  impellaFlow?: number;
  renalFailure?: boolean;
  intubation?: boolean;
  mcsEscalation?: boolean;
  ees?: number; ea?: number; eesEa?: number;
  esp?: number; edp?: number; pmax?: number;
  esv?: number; edv?: number; pvSV?: number;
  dpDtMax?: number; dpDtMin?: number;
  notes?: string; survived?: boolean;
  isEscalated?: boolean;
  deltaCPO?: number; recoveryScore?: number;
}

interface RiskScores {
  survival: number;
  escalation: number;
  rvDysfunction: number;
}

interface ClusterResult {
  clusterLabel: number;
  clusterName: string;
  recommendation: string;
  distances: Record<string, number>;
  similarities: Record<string, number>;
}

interface PredictionResult {
  patients: (PatientInput & { riskScores?: RiskScores })[];
  clusterResults: Record<string, ClusterResult>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Median-fill imputation: replace null/undefined with pre-computed median. */
function impute(row: number[], medians: number[]): number[] {
  return row.map((v, i) => (v === null || v === undefined || Number.isNaN(v) || !isFinite(v) ? medians[i] : v));
}

/** Z-score standardization. */
function standardize(row: number[], mean: number[], scale: number[]): number[] {
  return row.map((v, i) => (v - mean[i]) / (scale[i] || 1));
}

/** Sigmoid function for logistic regression. */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// ---------------------------------------------------------------------------
// Feature engineering (matches predict_all.py:engineer_risk_features)
// ---------------------------------------------------------------------------

function safeDiff(pre: number | undefined | null, post: number | undefined | null): number | null {
  if (pre == null || post == null) return null;
  return post - pre;
}

function safeRatio(pre: number | undefined | null, post: number | undefined | null): number | null {
  if (pre == null || post == null || pre === 0) return null;
  return post / pre;
}

function engineerFeatures(p: PatientInput): Record<string, number | null> {
  const f: Record<string, number | null> = {};

  // Raw patient fields
  const rawFields: [string, keyof PatientInput][] = [
    ["age", "age"], ["weight_kg", "weightKg"], ["height_cm", "heightCm"],
    ["gender", "gender"], ["race", "race"], ["cause_of_shock", "causeOfShock"],
    ["days_between_rhc_and_impella", "daysBetweenRhcAndImpella"],
    ["pre_ra", "preRA"], ["post_ra", "postRA"],
    ["pre_rvsp", "preRVSP"], ["post_rvsp", "postRVSP"],
    ["pre_rvdp", "preRVDP"], ["post_rvdp", "postRVDP"],
    ["pre_pasp", "prePASP"], ["post_pasp", "postPASP"],
    ["pre_padp", "prePADP"], ["post_padp", "postPADP"],
    ["pre_map", "preMAP"], ["post_map", "postMAP"],
    ["pre_pcwp", "prePCWP"], ["post_pcwp", "postPCWP"],
    ["pre_pvr", "prePVR"], ["post_pvr", "postPVR"],
    ["pre_sbp", "preSBP"], ["post_sbp", "postSBP"],
    ["pre_dbp", "preDBP"], ["post_dbp", "postDBP"],
    ["pre_hr", "preHR"], ["post_hr", "postHR"],
    ["pre_tdco", "preTDCO"], ["post_tdco", "postTDCO"],
    ["pre_sv", "preSV"], ["post_sv", "postSV"],
    ["pre_pa_o2", "prePaO2"], ["post_pa_o2", "postPaO2"],
    ["pre_sp_o2", "preSpO2"], ["post_sp_o2", "postSpO2"],
    ["pre_papi", "prePAPI"], ["post_papi", "postPAPI"],
    ["pre_cpo", "preCPO"], ["post_cpo", "postCPO"],
    ["pre_rv_cpo", "preRVCPO"], ["post_rv_cpo", "postRVCPO"],
    ["pre_rvedd", "preRVEDD"], ["post_rvedd", "postRVEDD"],
    ["pre_tapse", "preTAPSE"], ["post_tapse", "postTAPSE"],
    ["pre_rv_s", "preRVS"], ["post_rv_s", "postRVS"],
    ["pre_rv_fs", "preRVFS"], ["post_rv_fs", "postRVFS"],
    ["pre_tr_severity", "preTRSeverity"], ["post_tr_severity", "postTRSeverity"],
    ["pre_echo_pasp", "preEchoPASP"], ["post_echo_pasp", "postEchoPASP"],
    ["pre_lvedd", "preLVEDd"], ["post_lvedd", "postLVEDd"],
    ["pre_sodium", "preSodium"], ["post_sodium", "postSodium"],
    ["pre_potassium", "prePotassium"], ["post_potassium", "postPotassium"],
    ["pre_hco3", "preHCO3"], ["post_hco3", "postHCO3"],
    ["pre_creatinine", "preCreatinine"], ["post_creatinine", "postCreatinine"],
    ["pre_egfr", "preEGFR"], ["post_egfr", "postEGFR"],
    ["pre_hemoglobin", "preHemoglobin"], ["post_hemoglobin", "postHemoglobin"],
    ["pre_wbc", "preWBC"], ["post_wbc", "postWBC"],
    ["pre_ast", "preAST"], ["post_ast", "postAST"],
    ["pre_alt", "preALT"], ["post_alt", "postALT"],
    ["pre_bili", "preBili"], ["post_bili", "postBili"],
    ["pre_lactate", "preLactate"], ["post_lactate", "postLactate"],
    ["pre_ph", "prePH"], ["post_ph", "postPH"],
    ["dopamine", "dopamine"], ["dobutamine", "dobutamine"],
    ["epinephrine", "epinephrine"], ["milrinone", "milrinone"],
    ["norepinephrine", "norepinephrine"], ["vasopressin", "vasopressin"],
    ["vis_score", "visScore"],
    ["pre_furosemide", "preFurosemide"], ["post_furosemide", "postFurosemide"],
    ["impella_performance", "performanceLevel"], ["impella_flow", "impellaFlow"],
    ["ees", "ees"], ["ea", "ea"], ["ees_ea", "eesEa"],
    ["esp", "esp"], ["edp", "edp"], ["pmax", "pmax"],
    ["esv", "esv"], ["edv", "edv"], ["pv_sv", "pvSV"],
    ["dp_dt_max", "dpDtMax"], ["dp_dt_min", "dpDtMin"],
  ];

  for (const [jsonKey, srcKey] of rawFields) {
    const v = p[srcKey];
    f[jsonKey] = v !== undefined ? (typeof v === "boolean" ? (v ? 1 : 0) : Number(v)) : null;
  }

  // BMI
  const w = p.weightKg;
  const h = p.heightCm;
  f["bmi"] = w !== undefined && h !== undefined && h > 0 ? w / ((h / 100) ** 2) : null;

  // RHC delta/ratio
  const rhcVars = ["ra", "rvsp", "rvdp", "pasp", "padp", "map", "pcwp", "pvr",
    "sbp", "dbp", "hr", "tdco", "sv", "pa_o2", "sp_o2", "papi", "cpo", "rv_cpo"];
  for (const v of rhcVars) {
    f[`delta_${v}`] = safeDiff(f[`pre_${v}`] as number | undefined, f[`post_${v}`] as number | undefined);
    f[`ratio_${v}`] = safeRatio(f[`pre_${v}`] as number | undefined, f[`post_${v}`] as number | undefined);
  }

  // Echo delta/ratio
  const echoVars = ["rvedd", "tapse", "rv_s", "rv_fs", "tr_severity", "echo_pasp", "lvedd"];
  for (const v of echoVars) {
    f[`delta_${v}`] = safeDiff(f[`pre_${v}`] as number | undefined, f[`post_${v}`] as number | undefined);
    f[`ratio_${v}`] = safeRatio(f[`pre_${v}`] as number | undefined, f[`post_${v}`] as number | undefined);
  }

  // Lab delta
  const labVars = ["sodium", "potassium", "hco3", "creatinine", "egfr",
    "hemoglobin", "wbc", "ast", "alt", "bili", "lactate", "ph"];
  for (const v of labVars) {
    f[`delta_${v}`] = safeDiff(f[`pre_${v}`] as number | undefined, f[`post_${v}`] as number | undefined);
  }

  // Derived metrics
  f["delta_cpo"] = safeDiff(f["pre_cpo"] as number | undefined, f["post_cpo"] as number | undefined);
  const dCPO = f["delta_cpo"];
  f["recovery_score"] = dCPO !== null ? Math.max(0, Math.min(100, (dCPO + 0.5) * 100)) : null;

  const vis = f["vis_score"] as number | null;
  f["vis_high"] = vis !== null && vis > 15 ? 1 : 0;

  const inotropeCols = ["dopamine", "dobutamine", "epinephrine", "milrinone", "norepinephrine", "vasopressin"];
  f["inotrope_count"] = inotropeCols.reduce((sum, c) => sum + ((f[c] as number) ?? 0 > 0 ? 1 : 0), 0);

  // SCAI numeric
  const scaiRaw = p.scai;
  let scaiNum: number | null = null;
  if (scaiRaw !== undefined && scaiRaw !== null) {
    const s = String(scaiRaw).toLowerCase().trim();
    const scaiMap: Record<string, number> = { b: 1, c: 2, d: 3, e: 4 };
    scaiNum = scaiMap[s] ?? null;
  }
  f["scai_numeric"] = scaiNum;
  f["scai_stage"] = scaiNum;

  f["shock_cause_numeric"] = f["cause_of_shock"] !== null ? Number(f["cause_of_shock"]) : null;
  f["gender_numeric"] = f["gender"] !== null ? Number(f["gender"]) : null;
  f["race_numeric"] = f["race"] !== null ? Number(f["race"]) : null;

  // outcome field if supported
  f["outcome"] = null;

  // Fields from model_metadata.json not yet mapped
  f["Unnamed: 6"] = null;
  f["Absolute Value"] = null;
  f["Unnamed: 11"] = null;
  f["Unnamed: 12"] = null;
  f["Age"] = f["age"];
  f["pre_augmentation"] = null;
  f["post_augmentation"] = null;
  f["mcs_escalation"] = p.mcsEscalation !== undefined ? (p.mcsEscalation ? 1 : 0) : null;
  f["is_escalated"] = p.isEscalated !== undefined ? (p.isEscalated ? 1 : 0) : null;
  f["renal_failure"] = p.renalFailure !== undefined ? (p.renalFailure ? 1 : 0) : null;
  f["intubation"] = p.intubation !== undefined ? (p.intubation ? 1 : 0) : null;

  return f;
}

// ---------------------------------------------------------------------------
// Logistic Regression Predictor
// ---------------------------------------------------------------------------

function predictLogisticRegression(
  rowFeatures: Record<string, number | null>,
  featureNames: string[],
  coef: number[],
  intercept: number,
  scalerMean: number[],
  scalerScale: number[],
  imputerStats: number[],
): number {
  const raw = featureNames.map((name) => (rowFeatures[name] !== undefined ? rowFeatures[name] : null) ?? null);
  const imp = impute(raw as number[], imputerStats);
  const scl = standardize(imp, scalerMean, scalerScale);
  const logit = intercept + scl.reduce((sum, v, i) => sum + v * coef[i], 0);
  return sigmoid(logit);
}

// ---------------------------------------------------------------------------
// Random Forest Predictor
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tree-based model helpers
// ---------------------------------------------------------------------------

interface Tree {
  children_left: number[];
  children_right: number[];
  feature: number[];
  threshold: number[];
  value: number[][][];
}

function predictTree(features: number[], tree: Tree, outputIdx = 1): number {
  let node = 0;
  while (tree.children_left[node] !== -1) {
    const featVal = features[tree.feature[node]] ?? 0;
    node = featVal <= tree.threshold[node] ? tree.children_left[node] : tree.children_right[node];
  }
  return tree.value[node][0][outputIdx];
}

function predictRandomForest(
  rowFeatures: Record<string, number | null>,
  featureNames: string[],
  trees: Tree[],
  scalerMean: number[],
  scalerScale: number[],
  imputerStats: number[],
): number {
  const raw = featureNames.map((name) => (rowFeatures[name] !== undefined ? rowFeatures[name] : null) ?? null);
  const imp = impute(raw as number[], imputerStats);
  const scl = standardize(imp, scalerMean, scalerScale);
  const probs = trees.map((t) => predictTree(scl, t));
  return probs.reduce((a, b) => a + b, 0) / probs.length;
}

// ---------------------------------------------------------------------------
// Cluster Assignment
// ---------------------------------------------------------------------------

function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

function assignCluster(p: PatientInput): ClusterResult | null {
  const c = weights.cluster;
  if (!c) {
    return {
      clusterLabel: -1,
      clusterName: "Unavailable",
      recommendation: "",
      distances: {},
      similarities: {},
    };
  }

  // Build feature vector from patient
  const raw = c.feature_names.map((name: string) => {
    // Map from snake_case to camelCase patient fields
    const camelMap: Record<string, keyof PatientInput> = {
      pre_egfr: "preEGFR", pre_hco3: "preHCO3", pre_lactate: "preLactate",
      pre_alt: "preALT", pre_wbc: "preWBC", pre_hemoglobin: "preHemoglobin",
      pre_ra: "preRA", age: "age",
    };
    const extraMap: Record<string, () => number | null> = {
      bmi: () => p.weightKg && p.heightCm ? p.weightKg / ((p.heightCm / 100) ** 2) : null,
      scai_numeric: () => {
        if (!p.scai) return null;
        const s = String(p.scai).toLowerCase().trim();
        const m: Record<string, number> = { b: 1, c: 2, d: 3, e: 4 };
        return m[s] ?? null;
      },
    };

    if (camelMap[name]) {
      const v = p[camelMap[name]];
      return v !== undefined ? Number(v) : null;
    }
    if (extraMap[name]) return extraMap[name]();
    return null;
  });

  const imp = impute(raw as number[], c.imputer.statistics_);
  const scl = standardize(imp, c.scaler.mean_, c.scaler.scale_);

  // PCA transform
  let projected = scl;
  if (c.pca) {
    projected = c.pca.components_.map((comp: number[]) =>
      comp.reduce((sum: number, v: number, i: number) => sum + v * (scl[i] - (c.pca?.mean_?.[i] ?? 0)), 0)
    );
  }

  // Distance to centroids
  const centroids: number[][] = c.kmeans_centroids;
  const distances: number[] = centroids.map((cent: number[]) => euclidean(projected, cent));
  const label = distances.indexOf(Math.min(...distances));

  // Similarities (inverse distance softmax)
  const invDist = distances.map((d: number) => 1 / (d + 1e-8));
  const simSum = invDist.reduce((a: number, b: number) => a + b, 0);
  const similarities: Record<string, number> = {};
  const distDict: Record<string, number> = {};
  centroids.forEach((_: number[], i: number) => {
    similarities[String(i)] = invDist[i] / simSum;
    distDict[String(i)] = distances[i];
  });

  let clusterName = "Unknown";
  let recommendation = "";
  if (c.profiles && c.profiles[String(label)]) {
    clusterName = c.profiles[String(label)].cluster_name || "Unknown";
    recommendation = c.profiles[String(label)].clinical_recommendation || "";
  }

  return {
    clusterLabel: label,
    clusterName,
    recommendation,
    distances: distDict,
    similarities,
  };
}

// ---------------------------------------------------------------------------
// Gradient Boosting Predictor
// ---------------------------------------------------------------------------

function predictGradientBoosting(
  rowFeatures: Record<string, number | null>,
  featureNames: string[],
  gbData: { trees: Tree[]; learning_rate: number; init_constant: number },
  scalerMean: number[],
  scalerScale: number[],
  imputerStats: number[],
): number {
  const raw = featureNames.map((name) => (rowFeatures[name] !== undefined ? rowFeatures[name] : null) ?? null);
  const imp = impute(raw as number[], imputerStats);
  const scl = standardize(imp, scalerMean, scalerScale);
  // GB binary classification: sigmoid(init_log_odds + lr * sum of tree values)
  const rawSum = gbData.trees.reduce((sum, tree) => sum + predictTree(scl, tree, 0), 0);
  return sigmoid(gbData.init_constant + gbData.learning_rate * rawSum);
}

// ---------------------------------------------------------------------------
// Main prediction function (replaces runPythonPredictions)
// ---------------------------------------------------------------------------

export function predictFromJsModels(patients: PatientInput[]): PredictionResult {
  const w = weights;
  const featureNames: string[] = w.feature_names;
  const scalerMean: number[] = w.scaler.mean_;
  const scalerScale: number[] = w.scaler.scale_;
  const imputerStats: number[] = w.imputer.statistics_;

  const enhanced = patients.map((p) => {
    const features = engineerFeatures(p);

    const survival = predictLogisticRegression(
      features, featureNames,
      w.survival.coef, w.survival.intercept,
      scalerMean, scalerScale, imputerStats,
    );

    const rvDysfunction = w.rv_dysfunction.type === "gradient_boosting"
      ? predictGradientBoosting(
          features, featureNames,
          w.rv_dysfunction as unknown as { trees: Tree[]; learning_rate: number; init_constant: number },
          scalerMean, scalerScale, imputerStats,
        )
      : predictLogisticRegression(
          features, featureNames,
          w.rv_dysfunction.coef, w.rv_dysfunction.intercept,
          scalerMean, scalerScale, imputerStats,
        );

    const escalation = predictRandomForest(
      features, featureNames,
      w.escalation.trees,
      scalerMean, scalerScale, imputerStats,
    );

    return {
      ...p,
      riskScores: {
        survival: Math.round(survival * 10000) / 10000,
        escalation: Math.round(escalation * 10000) / 10000,
        rvDysfunction: Math.round(rvDysfunction * 10000) / 10000,
      } as RiskScores,
    };
  });

  const clusterResults: Record<string, ClusterResult> = {};
  for (const p of enhanced) {
    const result = assignCluster(p);
    if (result) {
      clusterResults[p.id] = result;
    }
  }

  return { patients: enhanced, clusterResults };
}