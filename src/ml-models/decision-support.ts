import { predictFromJsModels } from "./predict";
import type { PatientData } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BootstrapResult {
  prediction_mean: number;
  ci_lower: number | null;
  ci_upper: number | null;
}

export interface PatientBootstrapResults {
  survival: BootstrapResult;
  escalation: BootstrapResult;
  rv_dysfunction: BootstrapResult;
}

export interface TrajectoryResult {
  cluster_id: number | null;
  cluster_name: string | null;
  matches: number;
  n_valid: number;
  delta_cpo_mean: number | null;
  delta_cpo_ci_lower: number | null;
  delta_cpo_ci_upper: number | null;
  delta_papi_mean: number | null;
  delta_papi_ci_lower: number | null;
  delta_papi_ci_upper: number | null;
  delta_lactate_mean: number | null;
  delta_lactate_ci_lower: number | null;
  delta_lactate_ci_upper: number | null;
  escalation_rate: number | null;
  survival_rate: number | null;
}

// ---------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Percentile helper
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * (p / 100);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const weight = idx - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// ---------------------------------------------------------------------------
// Bootstrap predictions
// ---------------------------------------------------------------------------

export function computeBootstrapPredictions(
  patients: PatientData[],
  nBootstrap = 500,
  randomSeed = 42,
): PatientBootstrapResults[] {
  const n = patients.length;
  if (n === 0) {
    return [];
  }

  if (n < 5) {
    // Return null CIs when sample is too small
    return patients.map(() => ({
      survival: { prediction_mean: 0, ci_lower: null, ci_upper: null },
      escalation: { prediction_mean: 0, ci_lower: null, ci_upper: null },
      rv_dysfunction: { prediction_mean: 0, ci_lower: null, ci_upper: null },
    }));
  }

  const rng = mulberry32(randomSeed);
  const predictionsPerPatient: Record<
    string,
    { survival: number[]; escalation: number[]; rv_dysfunction: number[] }
  > = {};

  for (const p of patients) {
    predictionsPerPatient[p.id] = { survival: [], escalation: [], rv_dysfunction: [] };
  }

  for (let b = 0; b < nBootstrap; b++) {
    const sampled: PatientData[] = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(rng() * n);
      sampled.push(patients[idx]);
    }
    const result = predictFromJsModels(sampled);
    for (const p of result.patients) {
      if (!p.riskScores) continue;
      const bucket = predictionsPerPatient[p.id];
      if (bucket) {
        bucket.survival.push(p.riskScores.survival);
        bucket.escalation.push(p.riskScores.escalation);
        bucket.rv_dysfunction.push(p.riskScores.rvDysfunction);
      }
    }
  }

  return patients.map((p) => {
    const bucket = predictionsPerPatient[p.id];
    const makeResult = (values: number[]): BootstrapResult => {
      if (values.length === 0) {
        return { prediction_mean: 0, ci_lower: null, ci_upper: null };
      }
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const sorted = [...values].sort((a, b) => a - b);
      return {
        prediction_mean: mean,
        ci_lower: percentile(sorted, 2.5),
        ci_upper: percentile(sorted, 97.5),
      };
    };

    return {
      survival: makeResult(bucket.survival),
      escalation: makeResult(bucket.escalation),
      rv_dysfunction: makeResult(bucket.rv_dysfunction),
    };
  });
}

// ---------------------------------------------------------------------------
// Similarity helpers
// ---------------------------------------------------------------------------

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  const m = mean(arr);
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function zScore(value: number, m: number, s: number): number {
  return s === 0 ? 0 : (value - m) / s;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ---------------------------------------------------------------------------
// Find similar patients
// ---------------------------------------------------------------------------

export function findSimilarPatients(
  patient: PatientData,
  cohort: PatientData[],
  k = 20,
): { patient: PatientData; similarity: number }[] {
  const featureKeys: (keyof PatientData)[] = [
    "preCPO",
    "prePAPI",
    "preLactate",
    "preRA",
    "preEGFR",
    "age",
  ];

  const featureValues = (p: PatientData): (number | undefined)[] =>
    featureKeys.map((k) => p[k] as number | undefined);

  // Compute cohort mean and std for each feature
  const stats: { mean: number; std: number }[] = [];
  for (let i = 0; i < featureKeys.length; i++) {
    const vals: number[] = [];
    for (const c of cohort) {
      const v = featureValues(c)[i];
      if (v !== undefined && !Number.isNaN(v)) {
        vals.push(v);
      }
    }
    stats.push({ mean: vals.length > 0 ? mean(vals) : 0, std: vals.length > 0 ? std(vals) : 1 });
  }

  const standardizeVector = (values: (number | undefined)[]): number[] =>
    values.map((v, i) =>
      v !== undefined && !Number.isNaN(v) ? zScore(v, stats[i].mean, stats[i].std) : 0,
    );

  const patientVec = standardizeVector(featureValues(patient));

  const scored = cohort
    .filter((c) => c.id !== patient.id)
    .map((c) => {
      const vec = standardizeVector(featureValues(c));
      return { patient: c, similarity: cosineSimilarity(patientVec, vec) };
    });

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}

// ---------------------------------------------------------------------------
// Compute trajectory metrics
// ---------------------------------------------------------------------------

export function computeTrajectoryMetrics(
  matches: { patient: PatientData; similarity: number }[],
): TrajectoryResult {
  const deltas = {
    cpo: matches
      .map((m) => m.patient.postCPO - m.patient.preCPO)
      .filter((v) => v !== null && !Number.isNaN(v)),
    papi: matches
      .map((m) => m.patient.postPAPI - m.patient.prePAPI)
      .filter((v) => v !== null && !Number.isNaN(v)),
    lactate: matches
      .map((m) => {
        const pre = m.patient.preLactate;
        const post = m.patient.postLactate;
        if (pre === undefined || post === undefined || pre === null || post === null) return null;
        return post - pre;
      })
      .filter((v): v is number => v !== null && !Number.isNaN(v)),
  };

  const computeMeanAndCI = (arr: number[]): { mean: number | null; ciLower: number | null; ciUpper: number | null } => {
    if (arr.length === 0) return { mean: null, ciLower: null, ciUpper: null };
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    if (arr.length < 5) {
      return { mean: m, ciLower: null, ciUpper: null };
    }
    const sorted = [...arr].sort((a, b) => a - b);
    return { mean: m, ciLower: percentile(sorted, 2.5), ciUpper: percentile(sorted, 97.5) };
  };

  const cpoStats = computeMeanAndCI(deltas.cpo);
  const papiStats = computeMeanAndCI(deltas.papi);
  const lactateStats = computeMeanAndCI(deltas.lactate);

  const escalationCount = matches.filter((m) => m.patient.isEscalated === true).length;
  const survivalCount = matches.filter((m) => m.patient.survived === true).length;

  return {
    cluster_id: null,
    cluster_name: null,
    matches: matches.length,
    n_valid: deltas.cpo.length,
    delta_cpo_mean: cpoStats.mean,
    delta_cpo_ci_lower: cpoStats.ciLower,
    delta_cpo_ci_upper: cpoStats.ciUpper,
    delta_papi_mean: papiStats.mean,
    delta_papi_ci_lower: papiStats.ciLower,
    delta_papi_ci_upper: papiStats.ciUpper,
    delta_lactate_mean: lactateStats.mean,
    delta_lactate_ci_lower: lactateStats.ciLower,
    delta_lactate_ci_upper: lactateStats.ciUpper,
    escalation_rate: matches.length > 0 ? escalationCount / matches.length : null,
    survival_rate: matches.length > 0 ? survivalCount / matches.length : null,
  };
}
