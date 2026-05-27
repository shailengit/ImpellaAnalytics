import * as XLSX from "xlsx";
import { RandomForestRegression } from "ml-random-forest";
import * as fs from "fs";
import path from "path";
import { execFile } from "child_process";

export interface PatientData {
  id: string;
  name: string;
  age?: number;
  weightKg?: number;
  heightCm?: number;
  gender?: number;
  race?: number;
  causeOfShock?: number;
  scai?: any;
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

  // Risk scores (populated by prediction API)
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
    weaningCriteria: { label: string; passed: boolean; value: string; threshold: string }[];
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

/**
 * Clinical Logic: Process raw Excel data with robustness
 */
export function processExcelData(buffer: Buffer): PatientData[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (rawData.length === 0) return [];

  const patients: PatientData[] = [];
  const numColumns = rawData[0] ? rawData[0].length : 0;

  for (let colIndex = 1; colIndex < numColumns; colIndex++) {
    const firstRowValue = rawData[0][colIndex];
    if (!firstRowValue) continue;

    let patientData: any = {
      id: String(firstRowValue).trim(),
      name: "Patient " + colIndex,
      notes: "",
      isEscalated: false,
      survived: true,
      renalFailure: false,
      intubation: false,
    };

    let currentSection = "general";

    const parseNum = (val: any): number | undefined => {
      if (
        val === undefined ||
        val === null ||
        String(val).toLowerCase().trim() === "n/a"
      )
        return undefined;
      const n = parseFloat(val);
      return isNaN(n) ? undefined : n;
    };

    for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      if (!row || row.length === 0) continue;

      const label = String(row[0] || "")
        .toLowerCase()
        .trim();
      const value = row[colIndex];
      if (!label) continue;

      if (label.includes("general") || label.includes("outcomes")) {
        if (value && isNaN(Number(value))) {
          patientData.notes += String(value) + " ";
        }
      }

      // Section detection
      if (label.includes("index rhc data")) {
        currentSection = "pre";
        continue;
      }
      if (label.includes("48h post") || label.includes("supported rhc")) {
        currentSection = "post";
        continue;
      }
      if (label.includes("echo  (pre-impella)")) {
        currentSection = "echo_pre";
        continue;
      }
      if (label.includes("echo  (post-impella)")) {
        currentSection = "echo_post";
        continue;
      }
      if (label.includes("labs at rhc")) {
        currentSection = "labs_pre";
        continue;
      }
      if (label.includes("labs 48h after")) {
        currentSection = "labs_post";
        continue;
      }
      if (label.includes("inotropes at impella")) {
        currentSection = "inotropes";
        continue;
      }
      if (label.includes("diuretic requirements")) {
        if (label.includes("day prior")) currentSection = "diuretics_pre";
        else if (label.includes("48 hours")) currentSection = "diuretics_post";
        continue;
      }
      if (label === "impella") {
        currentSection = "impella";
        continue;
      }
      if (label.includes("outcomes")) {
        currentSection = "outcomes";
        continue;
      }
      if (label.includes("single beat pv loop")) {
        currentSection = "pv";
        continue;
      }

      if (currentSection === "general") {
        if (label.includes("first name"))
          patientData.name = String(value).trim();
        if (label.includes("last name") && value)
          patientData.name += " " + String(value).trim();
        if (label.includes("mrn")) patientData.id = String(value).trim();
        if (label === "age") patientData.age = parseNum(value);
        if (label.includes("weight")) patientData.weightKg = parseNum(value);
        if (label.includes("height")) patientData.heightCm = parseNum(value);
        if (label.includes("gender")) patientData.gender = parseNum(value);
        if (label.includes("race")) patientData.race = parseNum(value);
        if (label.includes("cause of shock"))
          patientData.causeOfShock = parseNum(value);
        if (label.includes("scai stage"))
          patientData.scai = String(value).trim();
        if (label.includes("days between rhc"))
          patientData.daysBetweenRhcAndImpella = parseNum(value) || 0;
      } else if (currentSection === "pre") {
        if (label.startsWith("ra pressure"))
          patientData.preRA = parseNum(value) || 0;
        if (label.startsWith("rvsp")) patientData.preRVSP = parseNum(value);
        if (label.startsWith("rvdp")) patientData.preRVDP = parseNum(value);
        if (label.startsWith("pasp")) patientData.prePASP = parseNum(value);
        if (label.startsWith("padp")) patientData.prePADP = parseNum(value);
        if (label.startsWith("map")) patientData.preMAP = parseNum(value);
        if (label.startsWith("pcwp"))
          patientData.prePCWP = parseNum(value) || 0;
        if (label.startsWith("pvr")) patientData.prePVR = parseNum(value);
        if (label.startsWith("sbp")) patientData.preSBP = parseNum(value);
        if (label.startsWith("dbp")) patientData.preDBP = parseNum(value);
        if (label.startsWith("hr (bpm)")) patientData.preHR = parseNum(value);
        if (label.startsWith("tdco")) patientData.preTDCO = parseNum(value);
        if (label.startsWith("sv")) patientData.preSV = parseNum(value);
        if (label.startsWith("pa o2")) patientData.prePaO2 = parseNum(value);
        if (label.startsWith("sp o2")) patientData.preSpO2 = parseNum(value);
        if (label.startsWith("papi"))
          patientData.prePAPI = parseNum(value) || 1.0;
        if (label.startsWith("cpo")) patientData.preCPO = parseNum(value) || 0;
        if (label.startsWith("rv-cpo")) patientData.preRVCPO = parseNum(value);
      } else if (currentSection === "post") {
        if (label.startsWith("ra pressure"))
          patientData.postRA = parseNum(value) || 0;
        if (label.startsWith("rvsp")) patientData.postRVSP = parseNum(value);
        if (label.startsWith("rvdp")) patientData.postRVDP = parseNum(value);
        if (label.startsWith("pasp")) patientData.postPASP = parseNum(value);
        if (label.startsWith("padp")) patientData.postPADP = parseNum(value);
        if (label.startsWith("map")) patientData.postMAP = parseNum(value);
        if (label.startsWith("pcwp"))
          patientData.postPCWP = parseNum(value) || 0;
        if (label.startsWith("pvr")) patientData.postPVR = parseNum(value);
        if (label.startsWith("sbp")) patientData.postSBP = parseNum(value);
        if (label.startsWith("dbp")) patientData.postDBP = parseNum(value);
        if (label.startsWith("hr (bpm)")) patientData.postHR = parseNum(value);
        if (label.startsWith("tdco")) patientData.postTDCO = parseNum(value);
        if (label.startsWith("sv")) patientData.postSV = parseNum(value);
        if (label.startsWith("pa o2")) patientData.postPaO2 = parseNum(value);
        if (label.startsWith("sp o2")) patientData.postSpO2 = parseNum(value);
        if (label.startsWith("papi"))
          patientData.postPAPI = parseNum(value) || 1.0;
        if (label.startsWith("cpo")) patientData.postCPO = parseNum(value) || 0;
        if (label.startsWith("rv-cpo")) patientData.postRVCPO = parseNum(value);
      } else if (currentSection === "echo_pre") {
        if (label.includes("rvedd")) patientData.preRVEDD = parseNum(value);
        if (label.includes("tapse")) patientData.preTAPSE = parseNum(value);
        if (label.includes("rv s'")) patientData.preRVS = parseNum(value);
        if (label.includes("rv fs%")) patientData.preRVFS = parseNum(value);
        if (label.includes("tr severity"))
          patientData.preTRSeverity = parseNum(value);
        if (label.includes("pasp")) patientData.preEchoPASP = parseNum(value);
        if (label.includes("lvedd")) patientData.preLVEDd = parseNum(value);
      } else if (currentSection === "echo_post") {
        if (label.includes("rvedd")) patientData.postRVEDD = parseNum(value);
        if (label.includes("tapse")) patientData.postTAPSE = parseNum(value);
        if (label.includes("rv s'")) patientData.postRVS = parseNum(value);
        if (label.includes("rv fs%")) patientData.postRVFS = parseNum(value);
        if (label.includes("tr severity"))
          patientData.postTRSeverity = parseNum(value);
        if (label.includes("pasp")) patientData.postEchoPASP = parseNum(value);
        if (label.includes("lvedd")) patientData.postLVEDd = parseNum(value);
      } else if (currentSection === "labs_pre") {
        if (label.includes("sodium")) patientData.preSodium = parseNum(value);
        if (label.includes("potassium"))
          patientData.prePotassium = parseNum(value);
        if (label.includes("hco3")) patientData.preHCO3 = parseNum(value);
        if (label.includes("creatinine"))
          patientData.preCreatinine = parseNum(value);
        if (label.includes("egfr")) patientData.preEGFR = parseNum(value);
        if (label.includes("hemoglobin"))
          patientData.preHemoglobin = parseNum(value);
        if (label.includes("wbc")) patientData.preWBC = parseNum(value);
        if (label.includes("ast")) patientData.preAST = parseNum(value);
        if (label.includes("alt")) patientData.preALT = parseNum(value);
        if (label.includes("bilirubin")) patientData.preBili = parseNum(value);
        if (label.includes("lactate")) patientData.preLactate = parseNum(value);
        if (label.includes("ph")) patientData.prePH = parseNum(value);
      } else if (currentSection === "labs_post") {
        if (label.includes("sodium")) patientData.postSodium = parseNum(value);
        if (label.includes("potassium"))
          patientData.postPotassium = parseNum(value);
        if (label.includes("hco3")) patientData.postHCO3 = parseNum(value);
        if (label.includes("creatinine"))
          patientData.postCreatinine = parseNum(value);
        if (label.includes("egfr")) patientData.postEGFR = parseNum(value);
        if (label.includes("hemoglobin"))
          patientData.postHemoglobin = parseNum(value);
        if (label.includes("wbc")) patientData.postWBC = parseNum(value);
        if (label.includes("ast")) patientData.postAST = parseNum(value);
        if (label.includes("alt")) patientData.postALT = parseNum(value);
        if (label.includes("bilirubin")) patientData.postBili = parseNum(value);
        if (label.includes("lactate"))
          patientData.postLactate = parseNum(value);
        if (label.includes("ph")) patientData.postPH = parseNum(value);
      } else if (currentSection === "inotropes") {
        if (label.includes("dopamine")) patientData.dopamine = parseNum(value);
        if (label.includes("dobutamine"))
          patientData.dobutamine = parseNum(value);
        if (label.includes("epinephrine"))
          patientData.epinephrine = parseNum(value);
        if (label.includes("milrinone"))
          patientData.milrinone = parseNum(value);
        if (label.includes("norepinephrine"))
          patientData.norepinephrine = parseNum(value);
        if (label.includes("vasopressin"))
          patientData.vasopressin = parseNum(value);
        if (label.includes("vis score")) {
          patientData.visScore = parseNum(value);
          patientData.preVIS = patientData.visScore;
        }
      } else if (currentSection === "diuretics_pre") {
        if (label.includes("furosemide"))
          patientData.preFurosemide = parseNum(value);
      } else if (currentSection === "diuretics_post") {
        if (label.includes("furosemide"))
          patientData.postFurosemide = parseNum(value);
      } else if (currentSection === "impella") {
        if (label.includes("performance level"))
          patientData.performanceLevel = parseNum(value) || 8;
        if (label.includes("flow"))
          patientData.impellaFlow = parseNum(value) || 4.0;
      } else if (currentSection === "outcomes") {
        if (label.includes("renal failure"))
          patientData.renalFailure = parseNum(value) === 1;
        if (label.includes("intubation"))
          patientData.intubation = parseNum(value) === 1;
        if (label.includes("mcs escalation")) {
          patientData.mcsEscalation = parseNum(value) === 1;
          patientData.isEscalated = patientData.mcsEscalation;
        }
        if (label.includes("outcome")) {
          const outStr = String(value).toLowerCase();
          const outVal = parseNum(value);
          // Outcome coding from cross-sheet validation:
          // 4 = expired, 3 = survived/other disposition (NOT death)
          const isExpired =
            outStr.includes("exp") ||
            outStr.includes("die") ||
            outVal === 4 ||
            outStr.includes("and 4");
          if (isExpired) {
            patientData.survived = false;
          }
        }
      } else if (currentSection === "pv") {
        if (label.includes("ees/ea")) patientData.eesEa = parseNum(value);
        if (label === "ees") patientData.ees = parseNum(value);
        if (label === "ea") patientData.ea = parseNum(value);
        if (label.includes("esp")) patientData.esp = parseNum(value);
        if (label.includes("edp")) patientData.edp = parseNum(value);
        if (label.includes("pmax")) patientData.pmax = parseNum(value);
        if (label.includes("esv")) patientData.esv = parseNum(value);
        if (label.includes("edv")) patientData.edv = parseNum(value);
        if (label === "sv") patientData.pvSV = parseNum(value);
        if (label.includes("dP/dt max")) patientData.dpDtMax = parseNum(value);
        if (label.includes("dP/dt min")) patientData.dpDtMin = parseNum(value);
      }
    }

    patientData.preCPO = patientData.preCPO || 0;
    patientData.postCPO = patientData.postCPO || 0;
    patientData.deltaCPO = patientData.postCPO - patientData.preCPO;
    const rawScore = (patientData.deltaCPO + 0.5) * 100;
    patientData.recoveryScore = Math.max(
      0,
      Math.min(100, Math.round(rawScore)),
    );
    patientData.impellaFlow = patientData.impellaFlow || 4.0;
    patientData.performanceLevel = patientData.performanceLevel || 8;

    patients.push(patientData);
  }

  return patients;
}

export function trainAndPredict(patients: PatientData[]) {
  if (patients.length < 5) return null;

  const X = patients.map((p) => [
    p.preRA ?? 0,
    p.prePCWP ?? 0,
    p.preCPO ?? 0,
    p.prePAPI ?? 1.0,
    p.preVIS ?? 0,
    p.isEscalated ? 1 : 0,
  ]);

  const y = patients.map((p) => (p.survived ? 1 : 0));
  const predictions: { patientId: string; recoveryProbability: number }[] = [];

  for (let i = 0; i < patients.length; i++) {
    const trainingX = X.filter((_, idx) => idx !== i);
    const trainingY = y.filter((_, idx) => idx !== i);
    const testX = [X[i]];

    const rf = new RandomForestRegression({
      nEstimators: 50,
      seed: 42,
    });

    try {
      rf.train(trainingX, trainingY);
      const prob = rf.predict(testX)[0];
      predictions.push({
        patientId: patients[i].id,
        recoveryProbability: Math.min(Math.max(prob, 0), 1),
      });
    } catch (e) {
      console.error("[RF] Training failed for patient", patients[i].id, e);
    }
  }
  console.log("[RF] Generated", predictions.length, "survivability predictions out of", patients.length);
  return predictions;
}

export function checkEscalationAlerts(patients: PatientData[]) {
  try {
    const kbPath = path.join(process.cwd(), "impella_knowledge_base.json");
    if (!fs.existsSync(kbPath)) return patients;

    const kb = JSON.parse(fs.readFileSync(kbPath, "utf8"));

    return patients.map((p) => {
      if (p.eesEa === undefined) return p;

      // Find historical matches on Ees/Ea
      // "Strict" match within 10% or just closest
      const matches = kb.filter((h: any) => {
        const historicalEesEa = h.support_and_outcomes.ees_ea;
        if (typeof historicalEesEa !== "number") return false;
        const diff = Math.abs(historicalEesEa - (p.eesEa || 0));
        return diff < (p.eesEa || 0.1) * 0.15; // 15% tolerance
      });

      const hasEscalatedHistoricalMatch = matches.some(
        (m: any) => m.support_and_outcomes.escalated === 1,
      );

      if (hasEscalatedHistoricalMatch) {
        return { ...p, escalationAlert: true };
      }
      return p;
    });
  } catch (err) {
    console.error("Knowledge base check failed", err);
    return patients;
  }
}

export function runPythonPredictions(patients: PatientData[]): Promise<{ patients: PatientData[]; clusterResults: Record<string, any> }> {
  return new Promise((resolve) => {
    const payloadPatients = patients.map((p) => {
      const mapping: Record<string, any> = {
        id: p.id,
        name: p.name,
        age: p.age,
        weight_kg: p.weightKg,
        height_cm: p.heightCm,
        gender: p.gender,
        race: p.race,
        cause_of_shock: p.causeOfShock,
        scai_stage: p.scai,
        days_between_rhc_and_impella: p.daysBetweenRhcAndImpella,
        pre_ra: p.preRA,
        pre_rvsp: p.preRVSP,
        pre_rvdp: p.preRVDP,
        pre_pasp: p.prePASP,
        pre_padp: p.prePADP,
        pre_map: p.preMAP,
        pre_pcwp: p.prePCWP,
        pre_pvr: p.prePVR,
        pre_sbp: p.preSBP,
        pre_dbp: p.preDBP,
        pre_hr: p.preHR,
        pre_tdco: p.preTDCO,
        pre_sv: p.preSV,
        pre_pa_o2: p.prePaO2,
        pre_sp_o2: p.preSpO2,
        pre_papi: p.prePAPI,
        pre_cpo: p.preCPO,
        pre_rv_cpo: p.preRVCPO,
        post_ra: p.postRA,
        post_rvsp: p.postRVSP,
        post_rvdp: p.postRVDP,
        post_pasp: p.postPASP,
        post_padp: p.postPADP,
        post_map: p.postMAP,
        post_pcwp: p.postPCWP,
        post_pvr: p.postPVR,
        post_sbp: p.postSBP,
        post_dbp: p.postDBP,
        post_hr: p.postHR,
        post_tdco: p.postTDCO,
        post_sv: p.postSV,
        post_pa_o2: p.postPaO2,
        post_sp_o2: p.postSpO2,
        post_papi: p.postPAPI,
        post_cpo: p.postCPO,
        post_rv_cpo: p.postRVCPO,
        pre_rvedd: p.preRVEDD,
        pre_tapse: p.preTAPSE,
        pre_rv_s: p.preRVS,
        pre_rv_fs: p.preRVFS,
        pre_tr_severity: p.preTRSeverity,
        pre_echo_pasp: p.preEchoPASP,
        pre_lvedd: p.preLVEDd,
        post_rvedd: p.postRVEDD,
        post_tapse: p.postTAPSE,
        post_rv_s: p.postRVS,
        post_rv_fs: p.postRVFS,
        post_tr_severity: p.postTRSeverity,
        post_echo_pasp: p.postEchoPASP,
        post_lvedd: p.postLVEDd,
        pre_sodium: p.preSodium,
        pre_potassium: p.prePotassium,
        pre_hco3: p.preHCO3,
        pre_creatinine: p.preCreatinine,
        pre_egfr: p.preEGFR,
        pre_hemoglobin: p.preHemoglobin,
        pre_wbc: p.preWBC,
        pre_ast: p.preAST,
        pre_alt: p.preALT,
        pre_bili: p.preBili,
        pre_lactate: p.preLactate,
        pre_ph: p.prePH,
        post_sodium: p.postSodium,
        post_potassium: p.postPotassium,
        post_hco3: p.postHCO3,
        post_creatinine: p.postCreatinine,
        post_egfr: p.postEGFR,
        post_hemoglobin: p.postHemoglobin,
        post_wbc: p.postWBC,
        post_ast: p.postAST,
        post_alt: p.postALT,
        post_bili: p.postBili,
        post_lactate: p.postLactate,
        post_ph: p.postPH,
        dopamine: p.dopamine,
        dobutamine: p.dobutamine,
        epinephrine: p.epinephrine,
        milrinone: p.milrinone,
        norepinephrine: p.norepinephrine,
        vasopressin: p.vasopressin,
        vis_score: p.visScore,
        pre_furosemide: p.preFurosemide,
        post_furosemide: p.postFurosemide,
        impella_performance: p.performanceLevel,
        impella_flow: p.impellaFlow,
        renal_failure: p.renalFailure ? 1 : 0,
        intubation: p.intubation ? 1 : 0,
        mcs_escalation: p.mcsEscalation ? 1 : 0,
        ees: p.ees,
        ea: p.ea,
        ees_ea: p.eesEa,
        esp: p.esp,
        edp: p.edp,
        pmax: p.pmax,
        esv: p.esv,
        edv: p.edv,
        pv_sv: p.pvSV,
        dp_dt_max: p.dpDtMax,
        dp_dt_min: p.dpDtMin,
        notes: p.notes,
        survived: p.survived ? 1 : 0,
        is_escalated: p.isEscalated ? 1 : 0,
        delta_cpo: p.deltaCPO,
        recovery_score: p.recoveryScore,
      };
      return mapping;
    });

    const payload = JSON.stringify({ patients: payloadPatients });

    // ---------------------------------------------------------------------------
    // HTTP path — used on Vercel where Python is a separate serverless function
    // ---------------------------------------------------------------------------
    const pythonApiUrl = process.env.PYTHON_API_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    if (pythonApiUrl) {
      const url = `${pythonApiUrl.replace(/\/+$/, "")}/api/predict`;
      console.log("[ML] Calling HTTP endpoint:", url);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: controller.signal,
      })
        .then(async (res) => {
          clearTimeout(timeout);
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
          }
          return res.json();
        })
        .then((result) => {
          const predictions = result.predictions || [];
          const clusters = result.clusters || [];
          console.log("[ML] Received", predictions.length, "predictions and", clusters.length, "clusters via HTTP");

          const enhanced = patients.map((p) => {
            const match = predictions.find((pred: any) => pred.patientId === p.id);
            if (match && match.scores) {
              return {
                ...p,
                riskScores: {
                  survival: match.scores.survival,
                  escalation: match.scores.escalation,
                  rvDysfunction: match.scores.rv_dysfunction,
                },
              };
            }
            return p;
          });

          const clusterResults: Record<string, any> = {};
          for (const c of clusters) {
            clusterResults[c.patientId] = {
              clusterLabel: c.cluster_label,
              clusterName: c.cluster_name,
              recommendation: c.recommendation,
              distances: c.distances,
              similarities: c.similarities,
            };
          }
          resolve({ patients: enhanced, clusterResults });
        })
        .catch((err) => {
          clearTimeout(timeout);
          console.error("[ML] HTTP prediction failed:", err);
          resolve({ patients, clusterResults: {} });
        });
      return;
    }

    // ---------------------------------------------------------------------------
    // Subprocess path — local development
    // ---------------------------------------------------------------------------
    // Find a working Python interpreter with required packages
    const pythonCandidates = [
      process.env.PYTHON_PATH,
      "/Users/shailendrakaushik/Documents/Python/AlgoTrading/ALGOVIBES/venv/bin/python3",
      "/opt/anaconda3/bin/python3",
      "/opt/homebrew/bin/python3",
      "/usr/local/bin/python3",
      "python3",
    ].filter(Boolean) as string[];

    let defaultPython = "python3";
    for (const py of pythonCandidates) {
      if (fs.existsSync(py)) {
        defaultPython = py;
        break;
      }
    }
    console.log("[ML] Spawning scripts/predict_all.py for", patients.length, "patients using", defaultPython);
    const child = execFile(
      defaultPython,
      ["scripts/predict_all.py"],
      { cwd: process.cwd(), timeout: 60000 },
      (error, stdout, stderr) => {
        if (!stdout) {
          console.error("[ML] scripts/predict_all.py produced no stdout:", error, stderr);
          resolve({ patients, clusterResults: {} });
          return;
        }
        if (error) {
          console.error("[ML] scripts/predict_all.py exited with error:", error, stderr);
        }
        try {
          const result = JSON.parse(stdout.trim());
          if (result.error) {
            console.error("[ML] scripts/predict_all.py returned error:", result.error);
            resolve({ patients, clusterResults: {} });
            return;
          }
          const predictions = result.predictions || [];
          const clusters = result.clusters || [];
          console.log("[ML] Received", predictions.length, "predictions and", clusters.length, "clusters");

          const enhanced = patients.map((p) => {
            const match = predictions.find((pred: any) => pred.patientId === p.id);
            if (match && match.scores) {
              return {
                ...p,
                riskScores: {
                  survival: match.scores.survival,
                  escalation: match.scores.escalation,
                  rvDysfunction: match.scores.rv_dysfunction,
                },
              };
            }
            return p;
          });

          const clusterResults: Record<string, any> = {};
          for (const c of clusters) {
            clusterResults[c.patientId] = {
              clusterLabel: c.cluster_label,
              clusterName: c.cluster_name,
              recommendation: c.recommendation,
              distances: c.distances,
              similarities: c.similarities,
            };
          }
          resolve({ patients: enhanced, clusterResults });
        } catch (parseErr) {
          console.error("[ML] Failed to parse Python output:", parseErr, stdout);
          resolve({ patients, clusterResults: {} });
        }
      },
    );

    child.on("error", (spawnErr) => {
      console.error("Failed to spawn Python process:", spawnErr);
      resolve({ patients, clusterResults: {} });
    });

    child.stdin?.on("error", (stdinErr: any) => {
      console.error("Python stdin error (EPIPE):", stdinErr.message);
      resolve({ patients, clusterResults: {} });
    });

    try {
      child.stdin?.write(JSON.stringify({ patients: payloadPatients }));
      child.stdin?.end();
    } catch (pipeErr) {
      console.error("Failed to write to Python stdin (EPIPE):", pipeErr);
      resolve({ patients, clusterResults: {} });
    }
  });
}
