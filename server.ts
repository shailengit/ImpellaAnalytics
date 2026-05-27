import "dotenv/config";
import express from "express";
import path from "path";
import multer from "multer";
import * as XLSX from "xlsx";
import { GoogleGenAI } from "@google/genai";
import * as ss from "simple-statistics";
import * as fs from "fs";
import { execFile } from "child_process";
import { PatientData, processExcelData, trainAndPredict, checkEscalationAlerts, runPythonPredictions } from "./src/excel-parser";

const app = express();
const PORT = 2956;

// Clinical Gemini client is initialized dynamically inside generateClinicalSummary on-demand.

// Clinical Decision Support Checklist & Driver Calculator
function calculateChecklistAndDrivers(p: PatientData): PatientData {
  // 1. Weaning Criteria
  const cpoVal = p.postCPO ?? 0;
  const cpoPassed = cpoVal >= 0.6;
  
  const lactateVal = p.postLactate !== undefined ? p.postLactate : 1.5; 
  const lactatePassed = lactateVal < 2.0;
  
  const visVal = p.postVIS !== undefined ? p.postVIS : (p.visScore !== undefined ? p.visScore : 0);
  const visPassed = visVal < 10;
  
  const papiVal = p.postPAPI ?? 1.0;
  const papiPassed = papiVal >= 1.5;
  
  const intubationVal = !!p.intubation;
  const intubationPassed = !intubationVal;

  const weaningCriteria = [
    { label: "Cardiac Power Output (CPO)", passed: cpoPassed, value: `${cpoVal.toFixed(2)} W`, threshold: "≥ 0.60 W" },
    { label: "Serum Lactate (Perfusion)", passed: lactatePassed, value: p.postLactate !== undefined ? `${p.postLactate.toFixed(1)} mmol/L` : "N/A", threshold: "< 2.0 mmol/L" },
    { label: "Vasopressor Burden (VIS)", passed: visPassed, value: String(visVal), threshold: "< 10" },
    { label: "RV Pulsatility Index (PAPI)", passed: papiPassed, value: papiVal.toFixed(2), threshold: "≥ 1.50" },
    { label: "Spontaneous Breathing (Extubated)", passed: intubationPassed, value: intubationVal ? "Intubated" : "Extubated", threshold: "Extubated" }
  ];

  const weaningPassedCount = weaningCriteria.filter(c => c.passed).length;
  const weaningScore = Math.round((weaningPassedCount / weaningCriteria.length) * 100);
  const weaningPassed = weaningPassedCount >= 4;

  // 2. Escalation Danger Warnings
  const raVal = p.postRA ?? 0;
  const raTriggered = raVal > 20;
  const papiTriggered = papiVal < 1.0;
  const astVal = p.postAST !== undefined ? p.postAST : 35;
  const astTriggered = astVal > 200;
  const lactateTriggered = lactateVal > 3.0;

  const escalationCriteria = [
    { label: "Severe RV Congestion (RA Pressure)", triggered: raTriggered, value: `${raVal} mmHg`, threshold: "> 20 mmHg" },
    { label: "Refractory RV Shock (PAPI)", triggered: papiTriggered, value: papiVal.toFixed(2), threshold: "< 1.00" },
    { label: "Hepatocellular Damage (AST)", triggered: astTriggered, value: p.postAST !== undefined ? `${p.postAST} U/L` : "N/A", threshold: "> 200 U/L" },
    { label: "Severe Tissue Perfusion Deficit (Lactate)", triggered: lactateTriggered, value: p.postLactate !== undefined ? `${p.postLactate.toFixed(1)} mmol/L` : "N/A", threshold: "> 3.0 mmol/L" }
  ];

  const escalationWarning = escalationCriteria.some(c => c.triggered) || p.escalationAlert === true;

  // 3. Risk Drivers
  const survivalDrivers: any[] = [];
  const escalationDrivers: any[] = [];
  const rvDrivers: any[] = [];

  if (p.postPAPI < 1.2) {
    rvDrivers.push({ feature: "postPAPI", impact: 0.35, label: "RV Pulsatility Index (PAPI) is depressed", value: p.postPAPI.toFixed(2) });
  } else {
    rvDrivers.push({ feature: "postPAPI", impact: -0.15, label: "RV Pulsatility Index (PAPI) is preserved", value: p.postPAPI.toFixed(2) });
  }
  if (p.postRA > 16) {
    rvDrivers.push({ feature: "postRA", impact: 0.25, label: "Right Atrial Pressure is elevated (congestion)", value: `${p.postRA} mmHg` });
  } else {
    rvDrivers.push({ feature: "postRA", impact: -0.10, label: "Right Atrial Pressure is stable", value: `${p.postRA} mmHg` });
  }
  if (visVal > 15) {
    rvDrivers.push({ feature: "postVIS", impact: 0.15, label: "High vasoactive-inotropic score burden", value: String(visVal) });
  }
  if (rvDrivers.length < 3) {
    rvDrivers.push({ feature: "eesEa", impact: p.eesEa && p.eesEa < 0.6 ? 0.20 : -0.05, label: p.eesEa && p.eesEa < 0.6 ? "Ventricular-Arterial decoupling" : "Stable ventriculo-arterial coupling", value: p.eesEa ? p.eesEa.toFixed(2) : "N/A" });
  }

  if (p.isEscalated || p.mcsEscalation) {
    escalationDrivers.push({ feature: "isEscalated", impact: 0.60, label: "Prior MCS escalation recorded", value: "Yes" });
  }
  if (p.postRA > 20 || p.postPAPI < 1.0) {
    escalationDrivers.push({ feature: "hemodynamicCrit", impact: 0.30, label: "Meets critical RA/PAPI thresholds", value: "Triggered" });
  }
  if (visVal > 15) {
    escalationDrivers.push({ feature: "visScore", impact: 0.20, label: "High mechanical/pharmacological burden (VIS)", value: String(visVal) });
  } else {
    escalationDrivers.push({ feature: "visScore", impact: -0.10, label: "Low vasopressor requirements (VIS)", value: String(visVal) });
  }
  if (escalationDrivers.length < 3) {
    escalationDrivers.push({ feature: "deltaCPO", impact: p.deltaCPO < 0.1 ? 0.15 : -0.15, label: p.deltaCPO < 0.1 ? "Suboptimal cardiac power recruitment" : "Excellent cardiac power clearance", value: `${p.deltaCPO.toFixed(2)} W` });
  }

  if (p.postLactate !== undefined && p.postLactate > 2.5) {
    survivalDrivers.push({ feature: "postLactate", impact: 0.25, label: "Sustained tissue perfusion deficit (Lactate)", value: `${p.postLactate.toFixed(1)} mmol/L` });
  } else {
    survivalDrivers.push({ feature: "postLactate", impact: -0.15, label: "Cleared tissue perfusion markers (Lactate)", value: p.postLactate !== undefined ? `${p.postLactate.toFixed(1)} mmol/L` : "N/A" });
  }
  if (p.postAST !== undefined && p.postAST > 100) {
    survivalDrivers.push({ feature: "postAST", impact: 0.30, label: "Hepatocellular necrosis / Liver congestion (AST)", value: `${p.postAST} U/L` });
  } else {
    survivalDrivers.push({ feature: "postAST", impact: -0.10, label: "Normal hepatocellular markers (AST)", value: p.postAST !== undefined ? `${p.postAST} U/L` : "N/A" });
  }
  if (p.age && p.age > 65) {
    survivalDrivers.push({ feature: "age", impact: 0.15, label: "Advanced patient age", value: `${Math.round(p.age)} yrs` });
  } else {
    survivalDrivers.push({ feature: "age", impact: -0.10, label: "Favorable age margin", value: p.age ? `${Math.round(p.age)} yrs` : "N/A" });
  }

  return {
    ...p,
    checklistResults: {
      weaningScore,
      weaningPassed,
      escalationWarning,
      weaningCriteria,
      escalationCriteria
    },
    riskDrivers: {
      survivalDrivers: survivalDrivers.slice(0, 3),
      escalationDrivers: escalationDrivers.slice(0, 3),
      rvDrivers: rvDrivers.slice(0, 3)
    }
  };
}

// Generate Clinical Summary — Gemini (primary), Ollama (fallback), or template
// Returns structured 4-section object for card-based rendering
async function generateClinicalSummary(patient: PatientData, useGemini: boolean): Promise<{
  impression: string; hemodynamics: string; risk: string; management: string
}> {
  const geminiKey = process.env.GEMINI_API_KEY || "";
  const ollamaKey = process.env.OLLAMA_API_KEY || "";
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";
  const ollamaModel = process.env.OLLAMA_MODEL || "glm-5.1";

  // Parses an LLM response with labeled sections into the structured object
  const parseLLMResponse = (text: string): {
    impression: string; hemodynamics: string; risk: string; management: string
  } | null => {
    const sectionRegex = /CLINICAL IMPRESSION[:\s]*([\s\S]*?)HEMODYNAMIC SPOTLIGHT[:\s]*([\s\S]*?)RISK ASSESSMENT[:\s]*([\s\S]*?)MANAGEMENT PLAN[:\s]*([\s\S]*)$/i;
    const match = text.match(sectionRegex);
    if (match) {
      return {
        impression: match[1].trim(),
        hemodynamics: match[2].trim(),
        risk: match[3].trim(),
        management: match[4].trim(),
      };
    }
    return null;
  };

  // Deterministic template (no LLM involved)
  const getFallbackSummary = (p: PatientData, isFallback: boolean) => {
    const weaningPassed = p.checklistResults?.weaningPassed ?? false;
    const weaningScore = p.checklistResults?.weaningScore ?? 0;
    const deltaCPO = p.deltaCPO ?? (p.postCPO - p.preCPO);
    const rvDesc = p.postPAPI < 1.0 ? "impaired — heightened RV failure risk"
      : p.postPAPI < 1.5 ? "borderline — monitor closely during wean"
      : "preserved — favorable for weaning tolerance";
    const lactateDesc = p.postLactate !== undefined
      ? (p.postLactate > 3.0 ? "elevated — ongoing tissue hypoperfusion"
        : p.postLactate > 2.0 ? "mildly elevated — resolving"
        : "normal — adequate perfusion")
      : "not available";
    const survRisk = p.riskScores?.survival !== undefined
      ? (p.riskScores.survival < 0.3 ? "Low Risk" : p.riskScores.survival < 0.6 ? "Moderate Risk" : "High Risk")
      : "N/A";
    const escRisk = p.riskScores?.escalation !== undefined
      ? (p.riskScores.escalation < 0.3 ? "Low Risk" : p.riskScores.escalation < 0.6 ? "Moderate Risk" : "High Risk")
      : "N/A";
    const rvRisk = p.riskScores?.rvDysfunction !== undefined
      ? (p.riskScores.rvDysfunction < 0.3 ? "Low Risk" : p.riskScores.rvDysfunction < 0.6 ? "Moderate Risk" : "High Risk")
      : "N/A";

    const fallbackLabel = isFallback ? " (LLM unavailable)" : "";

    return {
      impression: weaningPassed
        ? `Weaning candidate${fallbackLabel}. CPO improved by ${deltaCPO.toFixed(2)} W with favorable hemodynamic trajectory. No alarm features detected.`
        : `Not yet ready for weaning${fallbackLabel}. Weaning score ${weaningScore}/100 — ${5 - (p.checklistResults?.weaningCriteria.filter(c => c.passed).length ?? 0)} of 5 criteria not met. Continue support and re-assess.`,
      hemodynamics: `Post-CPO ${p.postCPO.toFixed(2)} W (Δ${deltaCPO >= 0 ? "+" : ""}${deltaCPO.toFixed(2)}), PAPI ${p.postPAPI.toFixed(2)}, RA ${p.postRA} mmHg, Lactate ${lactateDesc}. RV pulsatility is ${rvDesc}.`,
      risk: `Survival: ${survRisk} · Escalation: ${escRisk} · RV Failure: ${rvRisk}.${p.checklistResults?.escalationWarning ? " Escalation danger flags present — maintain elevated surveillance." : " No escalation triggers active."}`,
      management: weaningPassed
        ? "1. Reduce Impella 0.5L q2h under continuous monitoring.\n2. Hold wean if PAPI drops below 1.5 or RA rises above 15.\n3. Target P-2 for explant evaluation if CPO remains above 0.6 W."
        : `1. Maintain P-${p.performanceLevel} support for continued unloading.\n2. Optimize RV afterload (consider milrinone/iNO if PAPI < 1.0).\n3. Reassess weaning readiness in 12-24h.`,
    };
  };

  // AI OFF — skip all LLMs, return deterministic template
  if (!useGemini) {
    return getFallbackSummary(patient, false);
  }

  // Build the clinical prompt (shared by Gemini and Ollama)
  const clinicalPrompt = `You are an experienced cardiologist on the Shock Team. Based on the patient data below, write a concise clinical analysis in exactly 4 sections. Use the EXACT labels shown. Write clinical JUDGMENT (what the numbers mean and what to do), not a data sheet.

CLINICAL IMPRESSION:
HEMODYNAMIC SPOTLIGHT:
RISK ASSESSMENT:
MANAGEMENT PLAN:

Patient Name: ${patient.name}
Age: ${patient.age}
SCAI Shock Stage: ${patient.scai}
Pre-implant RHC: RA=${patient.preRA}, PCWP=${patient.prePCWP}, CPO=${patient.preCPO}, PAPI=${patient.prePAPI}, VIS=${patient.preVIS}
Post-implant RHC (48h): RA=${patient.postRA}, PCWP=${patient.postPCWP}, CPO=${patient.postCPO}, PAPI=${patient.postPAPI}, VIS=${patient.postVIS}
Device: Flow=${patient.impellaFlow} L/min, Performance Level=P-${patient.performanceLevel}
Blood Labs: Pre-Lactate=${patient.preLactate}, Post-Lactate=${patient.postLactate}, Pre-AST=${patient.preAST}, Post-AST=${patient.postAST}, Pre-eGFR=${patient.preEGFR}, Post-eGFR=${patient.postEGFR}
Renal Failure: ${patient.renalFailure ? "Yes" : "No"}, Intubated: ${patient.intubation ? "Yes" : "No"}
ML Risk Scores (lower = better): Mortality=${patient.riskScores?.survival !== undefined ? (patient.riskScores.survival * 100).toFixed(0) + "%" : "N/A"}, Escalation=${patient.riskScores?.escalation !== undefined ? (patient.riskScores.escalation * 100).toFixed(0) + "%" : "N/A"}, RV Dysfunction=${patient.riskScores?.rvDysfunction !== undefined ? (patient.riskScores.rvDysfunction * 100).toFixed(0) + "%" : "N/A"}
Weaning Score: ${patient.checklistResults?.weaningScore}/100, Weaning Candidate: ${patient.checklistResults?.weaningPassed ? "Yes" : "No"}`;

  // Helper: call Ollama via native API (properly separates reasoning from content for glm-5.1)
  const callOllama = async (): Promise<string | null> => {
    if (!ollamaKey) return null;
    const nativeUrl = ollamaBaseUrl.replace(/\/v1\/?$/, "") + "/api/chat";
    try {
      const response = await fetch(nativeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ollamaKey}`,
        },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            { role: "system", content: "CRITICAL: Do NOT show any reasoning or thinking. Output ONLY the 4 labeled sections. No analysis, no planning, no chain-of-thought." },
            { role: "user", content: clinicalPrompt },
          ],
          stream: false,
          options: { temperature: 0.2, num_predict: 2000 },
        }),
      });
      if (!response.ok) {
        console.warn(`Ollama API returned ${response.status}: ${await response.text()}`);
        return null;
      }
      const data = await response.json();
      const msg = data.message;
      return msg?.content || msg?.thinking || null;
    } catch (err) {
      console.error("Ollama API call failed:", err);
      return null;
    }
  };

  let llmText: string | null = null;

  // Try Gemini first (if key is set)
  if (geminiKey) {
    try {
      const aiClient = new GoogleGenAI({ apiKey: geminiKey });
      const response = await aiClient.models.generateContent({
        model: "gemini-2.0-flash",
        contents: clinicalPrompt,
      });
      if (response.text) llmText = response.text;
    } catch (err) {
      console.error("Gemini handoff failed:", err);
    }
  }

  // Gemini unavailable/failed — try Ollama
  if (!llmText) {
    llmText = await callOllama();
  }

  // Parse LLM output into sections, or fall back to template
  if (llmText) {
    const parsed = parseLLMResponse(llmText);
    if (parsed) return parsed;
    // LLM responded but didn't follow format — wrap raw output in impression card
    console.warn("LLM response did not match expected section format, displaying as raw text");
    return {
      impression: llmText,
      hemodynamics: "",
      risk: "",
      management: "",
    };
  }

  // Both LLMs failed — template with fallback indicator
  return getFallbackSummary(patient, true);
}

async function startServer() {
  const upload = multer({ storage: multer.memoryStorage() });

  app.use(express.json());

  app.get("/api/download-example", (req, res) => {
    const exampleData = [
      [
        "Metric",
        "Patient A",
        "Patient B",
        "Patient C",
        "Patient D",
        "Patient E",
      ],
      [
        "Name",
        "John Doe",
        "Jane Smith",
        "Robert Brown",
        "Victoria Lane",
        "James Bond",
      ],
      ["Age", 65, 72, 58, 62, 45],
      ["SCAI Stage", "C", "D", "B", "E", "D"],
      ["Pre-implant RA", 15, 22, 10, 25, 18],
      ["Post-implant RA", 12, 24, 8, 18, 14],
      ["Pre-implant PCWP", 25, 35, 20, 32, 28],
      ["Post-implant PCWP", 18, 30, 15, 22, 20],
      ["Pre-implant CPO", 0.6, 0.4, 0.8, 0.3, 0.5],
      ["Post-implant CPO", 0.9, 0.42, 1.1, 0.5, 0.75],
      ["Pre-implant PAPI", 1.2, 0.8, 2.5, 0.5, 1.1],
      ["Post-implant PAPI", 1.8, 0.7, 3.0, 1.0, 1.5],
      ["Pre-implant VIS", 5, 15, 2, 25, 10],
      ["Post-implant VIS", 2, 20, 0, 12, 4],
      ["Impella Flow", 3.5, 3.1, 4.2, 3.8, 3.9],
      ["P-Level", 6, 5, 8, 7, 7],
      ["Ees/Ea", 0.8, 0.4, 1.2, 0.3, 0.6],
      [
        "Notes",
        "Good recovery",
        "Escalated to ECMO",
        "Minimal support",
        "Transplant candidate",
        "Arrested in ED",
      ],
      ["Outcome", "Survived", "Deceased", "Survived", "Survived", "Survived"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(exampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SampleData");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="impella_clinical_sample.xlsx"',
    );
    res.send(buf);
  });

  app.get("/api/sample", async (req, res) => {
    const samplePatients: PatientData[] = [
      {
        id: "P-1",
        name: "Bryan Jones",
        age: 55,
        scai: "2",
        preRA: 16,
        prePCWP: 33,
        preCPO: 0.6,
        prePAPI: 1.5,
        preVIS: 3,
        visScore: 3,
        postRA: 18,
        postPCWP: 30,
        postCPO: 0.65,
        postPAPI: 1.4,
        postVIS: 3,
        impellaFlow: 3.7,
        performanceLevel: 6,
        daysBetweenRhcAndImpella: 2,
        renalFailure: false,
        intubation: false,
        survived: true,
        notes: "Stable support, no issues.",
        isEscalated: false,
        deltaCPO: 0.05,
        recoveryScore: 45,
        eesEa: 0.82,
      },
      {
        id: "P-2",
        name: "Sarah Miller",
        age: 62,
        scai: "3",
        preRA: 22,
        prePCWP: 35,
        preCPO: 0.45,
        prePAPI: 0.8,
        preVIS: 12,
        visScore: 12,
        postRA: 24,
        postPCWP: 32,
        postCPO: 0.42,
        postPAPI: 0.7,
        postVIS: 15,
        impellaFlow: 3.2,
        performanceLevel: 5,
        daysBetweenRhcAndImpella: 4,
        renalFailure: true,
        intubation: true,
        survived: false,
        notes: "Arrested pre-implant, ECMO required.",
        isEscalated: true,
        deltaCPO: -0.03,
        recoveryScore: 10,
        eesEa: 0.33,
      },
      {
        id: "P-3",
        name: "Mark Thompson",
        age: 45,
        scai: "2",
        preRA: 12,
        prePCWP: 28,
        preCPO: 0.7,
        prePAPI: 2.1,
        preVIS: 2,
        visScore: 2,
        postRA: 10,
        postPCWP: 18,
        postCPO: 0.95,
        postPAPI: 2.5,
        postVIS: 0,
        impellaFlow: 4.1,
        performanceLevel: 8,
        daysBetweenRhcAndImpella: 1,
        renalFailure: false,
        intubation: false,
        survived: true,
        notes: "Rapid recovery post-Impella CP.",
        isEscalated: false,
        deltaCPO: 0.25,
        recoveryScore: 90,
        eesEa: 1.1,
      },
    ];

    let enhancedPatients = checkEscalationAlerts(samplePatients);
    let mlResult;
    try {
      mlResult = await runPythonPredictions(enhancedPatients);
    } catch (e) {
      console.log("[ML] Python unavailable, using fallback predictions");
      mlResult = {
        patients: enhancedPatients.map(p => ({ ...p, riskScores: { survival: 0.5, escalation: 0.5, rvDysfunction: 0.5 } })),
        clusterResults: {},
      };
    }
    enhancedPatients = mlResult.patients.map(calculateChecklistAndDrivers);
    const predictions = trainAndPredict(enhancedPatients);
    const summary = {
      averageDeltaCPO:
        enhancedPatients.length > 0
          ? ss.mean(enhancedPatients.map((p) => p.deltaCPO))
          : 0,
      riskPatientCount: enhancedPatients.filter(
        (p) => p.postRA > 20 || p.postPAPI < 1.0,
      ).length,
      recoveryScoreAverage:
        enhancedPatients.length > 0
          ? ss.mean(enhancedPatients.map((p) => p.recoveryScore))
          : 0,
    };
    res.json({ patients: enhancedPatients, summary, predictions, clusterResults: mlResult.clusterResults });
  });

  app.post("/api/analyze", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      let patients = processExcelData(req.file.buffer);
      if (patients.length === 0) {
        return res
          .status(400)
          .json({
            error:
              "No valid patient data found in the Excel file. please ensure metrics are in rows and patients in columns.",
          });
      }
      patients = checkEscalationAlerts(patients);
      let mlResult;
      try {
        mlResult = await runPythonPredictions(patients);
      } catch (e) {
        console.log("[ML] Python unavailable, using fallback predictions");
        mlResult = {
          patients: patients.map(p => ({ ...p, riskScores: { survival: 0.5, escalation: 0.5, rvDysfunction: 0.5 } })),
          clusterResults: {},
        };
      }
      patients = mlResult.patients.map(calculateChecklistAndDrivers);
      const predictions = trainAndPredict(patients);
      const summary = {
        averageDeltaCPO:
          patients.length > 0 ? ss.mean(patients.map((p) => p.deltaCPO)) : 0,
        riskPatientCount: patients.filter(
          (p) => p.postRA > 20 || p.postPAPI < 1.0,
        ).length,
        recoveryScoreAverage:
          patients.length > 0
            ? ss.mean(patients.map((p) => p.recoveryScore))
            : 0,
      };
      res.json({ patients, summary, predictions, clusterResults: mlResult.clusterResults });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to process data" });
    }
  });

  // Mortality Feature Importance API
  app.get("/api/mortality-features", async (req, res) => {
    try {
      const cwd = process.cwd();
      const consensusPath = path.join(cwd, "mortality_feature_consensus.csv");
      const comparisonPath = path.join(cwd, "ml_output/feature_subset_comparison.json");

      if (!fs.existsSync(consensusPath)) {
        return res.status(404).json({ error: "Mortality feature analysis not found. Run scripts/mortality_feature_analysis.py first." });
      }

      // Read consensus CSV
      const csvContent = fs.readFileSync(consensusPath, "utf8");
      const lines = csvContent.trim().split("\n");
      const headers = lines[0].split(",");
      const features = lines.slice(1).filter(l => l.trim()).map(line => {
        const vals = line.split(",");
        const row: Record<string, any> = {};
        headers.forEach((h, i) => {
          const v = vals[i]?.trim();
          row[h.trim()] = isNaN(Number(v)) ? v : Number(v);
        });
        return row;
      });

      // Read comparison results if available
      let comparison = null;
      if (fs.existsSync(comparisonPath)) {
        comparison = JSON.parse(fs.readFileSync(comparisonPath, "utf8"));
      }

      res.json({ features: features.slice(0, 50), comparison });
    } catch (err) {
      console.error("Mortality features error:", err);
      res.status(500).json({ error: "Failed to load mortality feature data" });
    }
  });

  // Impella Effectiveness Analysis API
  app.get("/api/effectiveness", async (req, res) => {
    try {
      const dataPath = path.join(process.cwd(), "public/effectiveness-data.json");
      if (!fs.existsSync(dataPath)) {
        return res.status(404).json({ error: "Effectiveness analysis not found. Run scripts/analyze_effectiveness.py first." });
      }
      const raw = fs.readFileSync(dataPath, "utf8");
      const data = JSON.parse(raw);
      // Basic schema validation — check required top-level keys exist
      const requiredKeys = ["survival", "hemodynamics", "labs", "responders", "ventricularMechanics", "mlCrossReference"];
      const missing = requiredKeys.filter(k => !(k in data));
      if (missing.length > 0) {
        return res.status(500).json({ error: `Effectiveness data missing required sections: ${missing.join(", ")}. Re-run analyze_effectiveness.py.` });
      }
      res.json(data);
    } catch (err) {
      console.error("Effectiveness data error:", err);
      res.status(500).json({ error: "Failed to load effectiveness data" });
    }
  });

  // PV Loop Analysis API
  app.get("/api/pv-loop-data", async (req, res) => {
    try {
      const outputDir = path.join(process.cwd(), "ml_output");
      const modelPath = path.join(outputDir, "pv_loop_escalation_model.json");
      const shapPath = path.join(outputDir, "pv_loop_shap.json");

      let modelData: any = null;
      let shapData: any = null;

      if (fs.existsSync(modelPath)) {
        modelData = JSON.parse(fs.readFileSync(modelPath, "utf8"));
      }
      if (fs.existsSync(shapPath)) {
        shapData = JSON.parse(fs.readFileSync(shapPath, "utf8"));
      }

      res.json({
        model: modelData,
        shap: shapData,
        images: {
          scatter: "/ml_output/pv_loop_scatter.png",
          coefficients: "/ml_output/pv_loop_coefficients.png",
          shapSummary: "/ml_output/shap_escalation_full.png",
          shapDependence: "/ml_output/shap_dependence_ees_ea.png",
        },
      });
    } catch (err) {
      console.error("PV loop data error:", err);
      res.status(500).json({ error: "Failed to load PV loop analysis data" });
    }
  });

  // Serve ml_output images statically
  app.use("/ml_output", express.static(path.join(process.cwd(), "ml_output")));

  // ---------------------------------------------------------------------------
  // Cluster Analysis API
  // ---------------------------------------------------------------------------

  function runClusterAssignment(patient: PatientData): Promise<{
    clusterLabel: number;
    clusterName: string;
    recommendation: string;
    distances: Record<string, number>;
    similarities: Record<string, number>;
  } | null> {
    return new Promise((resolve) => {
      const pythonCandidates = [
        process.env.PYTHON_PATH,
        "/Users/shailendrakaushik/Documents/Python/AlgoTrading/ALGOVIBES/venv/bin/python3",
        "/opt/anaconda3/bin/python3",
        "/opt/homebrew/bin/python3",
        "/usr/local/bin/python3",
        "python3",
      ].filter(Boolean) as string[];

      let pythonPath = "python3";
      for (const py of pythonCandidates) {
        if (fs.existsSync(py)) {
          pythonPath = py;
          break;
        }
      }

      const payload = {
        id: patient.id,
        name: patient.name,
        age: patient.age,
        weight_kg: patient.weightKg,
        height_cm: patient.heightCm,
        gender: patient.gender,
        race: patient.race,
        scai_stage: patient.scai,
        pre_ra: patient.preRA,
        pre_rvsp: patient.preRVSP,
        pre_rvdp: patient.preRVDP,
        pre_pasp: patient.prePASP,
        pre_padp: patient.prePADP,
        pre_map: patient.preMAP,
        pre_pcwp: patient.prePCWP,
        pre_pvr: patient.prePVR,
        pre_sbp: patient.preSBP,
        pre_dbp: patient.preDBP,
        pre_hr: patient.preHR,
        pre_tdco: patient.preTDCO,
        pre_papi: patient.prePAPI,
        pre_cpo: patient.preCPO,
        post_ra: patient.postRA,
        post_rvsp: patient.postRVSP,
        post_rvdp: patient.postRVDP,
        post_pasp: patient.postPASP,
        post_padp: patient.postPADP,
        post_map: patient.postMAP,
        post_pcwp: patient.postPCWP,
        post_pvr: patient.postPVR,
        post_sbp: patient.postSBP,
        post_dbp: patient.postDBP,
        post_hr: patient.postHR,
        post_tdco: patient.postTDCO,
        post_papi: patient.postPAPI,
        post_cpo: patient.postCPO,
        pre_lactate: patient.preLactate,
        post_lactate: patient.postLactate,
        pre_creatinine: patient.preCreatinine,
        post_creatinine: patient.postCreatinine,
        pre_egfr: patient.preEGFR,
        pre_hco3: patient.preHCO3,
        pre_alt: patient.preALT,
        pre_sodium: patient.preSodium,
        pre_wbc: patient.preWBC,
        pre_hemoglobin: patient.preHemoglobin,
        pre_bili: patient.preBili,
        pre_tapse: patient.preTAPSE,
        pre_lvedd: patient.preLVEDd,
      };

      const child = execFile(
        pythonPath,
        ["scripts/predict_all.py"],
        { cwd: process.cwd(), timeout: 15000 },
        (error, stdout, stderr) => {
          if (!stdout) {
            console.error("[Cluster] No stdout:", error, stderr);
            resolve(null);
            return;
          }
          try {
            const result = JSON.parse(stdout.trim());
            if (result.error) {
              console.error("[Cluster] Error:", result.error);
              resolve(null);
              return;
            }
            const clusters = result.clusters || [];
            if (clusters.length === 0) {
              resolve(null);
              return;
            }
            const c = clusters[0];
            resolve({
              clusterLabel: c.cluster_label,
              clusterName: c.cluster_name,
              recommendation: c.recommendation,
              distances: c.distances,
              similarities: c.similarities,
            });
          } catch (parseErr) {
            console.error("[Cluster] Parse error:", parseErr, "stdout:", stdout);
            resolve(null);
          }
        },
      );

      child.on("error", (spawnErr) => {
        console.error("[Cluster] Spawn error:", spawnErr);
        resolve(null);
      });

      child.stdin?.on("error", (stdinErr: any) => {
        console.error("[Cluster] Python stdin error (EPIPE):", stdinErr.message);
        resolve(null);
      });

      try {
        child.stdin?.write(JSON.stringify({ patients: [payload] }));
        child.stdin?.end();
      } catch (pipeErr) {
        console.error("[Cluster] Pipe error:", pipeErr);
        resolve(null);
      }
    });
  }

  app.get("/api/cluster-profiles", async (req, res) => {
    try {
      const profilesPath = path.join(process.cwd(), "ml_output/clusters/cluster_profiles.json");
      if (!fs.existsSync(profilesPath)) {
        return res.status(404).json({ error: "Cluster profiles not found. Run scripts/clustering_pipeline.py first." });
      }
      const profiles = JSON.parse(fs.readFileSync(profilesPath, "utf8"));
      const qualityPath = path.join(process.cwd(), "ml_output/clusters/quality_metrics.json");
      let quality = null;
      if (fs.existsSync(qualityPath)) {
        quality = JSON.parse(fs.readFileSync(qualityPath, "utf8"));
      }
      res.json({ profiles, quality });
    } catch (err) {
      console.error("Cluster profiles error:", err);
      res.status(500).json({ error: "Failed to load cluster profiles" });
    }
  });

  app.post("/api/cluster", async (req, res) => {
    try {
      const patient: PatientData = req.body;
      if (!patient || !patient.id) {
        return res.status(400).json({ error: "Patient data required" });
      }
      const result = await runClusterAssignment(patient);
      if (!result) {
        return res.status(503).json({ error: "Cluster service unavailable" });
      }
      res.json({ patientId: patient.id, cluster: result });
    } catch (err) {
      console.error("Cluster assignment error:", err);
      res.status(500).json({ error: "Failed to assign cluster" });
    }
  });

  // Dynamic Clinical Huddle Summary Endpoint (Gemini or Template)
  app.post("/api/generate-summary", async (req, res) => {
    try {
      const { patient: patientBody, useLLM } = req.body;
      const patient: PatientData = patientBody || req.body;
      if (!patient || !patient.id) {
        return res.status(400).json({ error: "Patient data required" });
      }
      // Re-calculate checklists & drivers to be robust
      const processed = calculateChecklistAndDrivers(patient);
      const useGemini = useLLM !== false;
      const summary = await generateClinicalSummary(processed, useGemini);
      res.json({ patientId: patient.id, summary, usedLLM: useGemini });
    } catch (err) {
      console.error("Failed to generate clinical summary:", err);
      res.status(500).json({ error: "Failed to generate clinical summary" });
    }
  });

  // What-If Treatment & Weaning Simulator Endpoint
  app.post("/api/simulate", async (req, res) => {
    try {
      const { patient, adjustments } = req.body;
      if (!patient || !patient.id) {
        return res.status(400).json({ error: "Patient data required" });
      }

      // Merge patient data with dynamic clinical adjustments
      const simulatedPatient: PatientData = {
        ...patient,
        impellaFlow: adjustments.impellaFlow !== undefined ? Number(adjustments.impellaFlow) : patient.impellaFlow,
        performanceLevel: adjustments.performanceLevel !== undefined ? Number(adjustments.performanceLevel) : patient.performanceLevel,
        postVIS: adjustments.postVIS !== undefined ? Number(adjustments.postVIS) : (patient.postVIS !== undefined ? patient.postVIS : patient.visScore),
        postLactate: adjustments.postLactate !== undefined ? Number(adjustments.postLactate) : patient.postLactate,
        postRA: adjustments.postRA !== undefined ? Number(adjustments.postRA) : patient.postRA,
        postPAPI: adjustments.postPAPI !== undefined ? Number(adjustments.postPAPI) : patient.postPAPI,
        postCPO: adjustments.postCPO !== undefined ? Number(adjustments.postCPO) : patient.postCPO,
      };

      // Recalculate derived clinical values
      simulatedPatient.deltaCPO = simulatedPatient.postCPO - simulatedPatient.preCPO;
      const rawScore = (simulatedPatient.deltaCPO + 0.5) * 100;
      simulatedPatient.recoveryScore = Math.max(0, Math.min(100, Math.round(rawScore)));

      // Re-evaluate escalation alerts (Ees/Ea strict match)
      const simulatedChecked = checkEscalationAlerts([simulatedPatient]);

      // Re-run scikit-learn Python predictions on this patient
      let mlResult;
      try {
        mlResult = await runPythonPredictions(simulatedChecked);
      } catch (e) {
        console.log("[ML] Python unavailable, using fallback predictions");
        mlResult = {
          patients: simulatedChecked.map(p => ({ ...p, riskScores: { survival: 0.5, escalation: 0.5, rvDysfunction: 0.5 } })),
          clusterResults: {},
        };
      }
      const simulatedML = mlResult.patients[0];

      // Re-run weaning/escalation checks and risk driver mapping
      const finalSimulated = calculateChecklistAndDrivers(simulatedML);

      res.json({
        patient: finalSimulated,
        predictions: finalSimulated.riskScores
      });
    } catch (err) {
      console.error("Simulation error:", err);
      res.status(500).json({ error: "Failed to simulate adjustments" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (process.env.VERCEL !== "1") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Impella Analytics Server running on http://localhost:${PORT}`);
    });
  }
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});

export default app;
