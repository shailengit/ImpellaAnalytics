import express from "express";
import path from "path";
import multer from "multer";
import * as XLSX from "xlsx";
import { GoogleGenAI } from "@google/genai";
import { RandomForestRegression } from "ml-random-forest";
import * as ss from "simple-statistics";
import * as fs from "fs";

// Initialize Gemini
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

interface PatientData {
  id: string;
  name: string;
  preRA: number;
  prePCWP: number;
  preCPO: number;
  prePAPI: number;
  preVIS: number;
  postRA: number;
  postPCWP: number;
  postCPO: number;
  postPAPI: number;
  postVIS: number;
  impellaFlow: number;
  performanceLevel: number;
  daysBetweenRhcAndImpella: number;
  renalFailure: boolean;
  intubation: boolean;
  survived: boolean;
  notes: string;
  isEscalated: boolean;
  deltaCPO: number;
  recoveryScore: number;
  eesEa?: number;
  escalationAlert?: boolean;
}

/**
 * Clinical Logic: Process raw Excel data with robustness
 */
function processExcelData(buffer: Buffer): PatientData[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (rawData.length === 0) return [];

  // Stricter metric detection: must be a whole word or common abbreviation
  const metrics = ["cpo", "ra", "papi", "pcwp", "vis", "flow", "power", "ees", "ea", "map", "paop", "pap", "wedge", "atrial", "output", "ci", "co"];
  const isMetricMatch = (str: string) => {
    const clean = str.toLowerCase().trim();
    return metrics.some(m => {
      // Look for exact word or word surrounded by non-alphanumeric chars
      const regex = new RegExp(`(^|[^a-zA-Z])${m}([^a-zA-Z]|$)`, 'i');
      return regex.test(clean);
    });
  };

  // Find orientation by scanning the first few rows and columns for metrics
  let rowMetricFound = 0;
  let colMetricFound = 0;

  // Scan top 5 rows for metric names
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    const row = rawData[i] || [];
    rowMetricFound += row.filter(c => isMetricMatch(String(c || ""))).length;
  }

  // Scan first 3 columns for metric names
  for (let j = 0; j < Math.min(3, (rawData[0] || []).length); j++) {
    const col = rawData.map(r => r[j]);
    colMetricFound += col.filter(c => isMetricMatch(String(c || ""))).length;
  }

  let metricNames: string[] = [];
  let transposed: any[][] = [];
  
  // If more metrics are found in the vertical (column-wise), then metrics are in rows, patients in columns.
  const isPatientsInColumns = colMetricFound > rowMetricFound;

  if (!isPatientsInColumns) {
    // Patients in rows (Standard Table)
    let headerIdx = 0;
    for (let i = 0; i < Math.min(5, rawData.length); i++) {
      if ((rawData[i] || []).filter(c => isMetricMatch(String(c || ""))).length > 1) {
        headerIdx = i;
        break;
      }
    }
    metricNames = (rawData[headerIdx] || []).map(c => String(c || "").trim());
    transposed = rawData.slice(headerIdx + 1).filter(r => r.some(c => c !== null && c !== undefined && c !== ""));
  } else {
    let metricColIdx = 0;
    for (let j = 0; j < Math.min(3, (rawData[0] || []).length); j++) {
      const colSample = rawData.map(r => String(r[j] || ""));
      if (colSample.filter(c => isMetricMatch(c)).length > 2) {
        metricColIdx = j;
        break;
      }
    }
    metricNames = rawData.map(r => String(r[metricColIdx] || "").trim());
    const maxCols = Math.max(...rawData.map(r => r.length));
    
    for (let j = metricColIdx + 1; j < maxCols; j++) {
      const pRow: any[] = [];
      for (let i = 0; i < rawData.length; i++) {
        pRow.push(rawData[i][j]);
      }
      // Check if pRow contains at least some actual data besides just an MRN or ID
      const nonNullData = pRow.filter(val => val !== null && val !== undefined && val !== "");
      if (nonNullData.length > 3) {
        transposed.push(pRow);
      }
    }
  }

  /**
   * Stricter Fuzzy Matcher for Clinical Metrics
   */
  const findValue = (row: any[], targetKeywords: string[], contextKeywords: string[], defaultValue: number | null = null) => {
    let bestIdx = -1;
    let bestScore = -1;

    for (let i = 0; i < metricNames.length; i++) {
      const mName = metricNames[i].toLowerCase();
      
      const hasTarget = targetKeywords.some(tk => {
        const regex = new RegExp(`(^|[^a-z])${tk.toLowerCase()}([^a-z]|$)`, 'i');
        return regex.test(mName);
      });

      if (hasTarget) {
        let score = 100;
        if (contextKeywords.some(ck => mName.includes(ck.toLowerCase()))) score += 200;
        
        const antiContext = contextKeywords.some(k => ["pre", "base", "rhc"].includes(k.toLowerCase()))
          ? ["post", "48h", "now", "current", "last", "discharge"] 
          : ["pre", "base", "rhc", "before", "init", "admission"];
        
        if (antiContext.some(ak => mName.includes(ak))) score -= 500;
        score -= mName.length; // Favor shorter/more direct matches

        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
    }

    if (bestIdx === -1 || bestScore < 0) return defaultValue;
    const val = row[bestIdx];
    if (val === null || val === undefined || val === "") return defaultValue;
    
    const cleanStr = String(val).toLowerCase().replace(/[<>]/g, "").replace(/mmhg|watts|l\/min|%|beats\/min/g, "").trim();
    const parsed = parseFloat(cleanStr);
    if (isNaN(parsed)) return defaultValue;

    // Clinical realism filter for heart metrics
    const isPressure = targetKeywords.some(tk => ["ra", "pcwp", "papi", "cvp", "atrial", "wedge", "pap", "paop"].includes(tk.toLowerCase()));
    if (isPressure && (parsed > 200 || parsed < -20)) return defaultValue; 
    if (targetKeywords.includes("cpo") && parsed > 10) return defaultValue;

    return parsed;
  };

  const patients: PatientData[] = transposed.map((pRow, idx) => {
    const getString = (keywords: string[]) => {
      const i = metricNames.findIndex(m => keywords.some(k => {
        const regex = new RegExp(`(^|\\P{L})${k}(\\P{L}|$)`, 'u');
        return regex.test(m);
      }));
      return i !== -1 ? String(pRow[i] || "").trim() : "";
    };

    const notes = getString(["notes", "general", "history", "dx", "diagnosis"]);
    const isEscalated = /ECMO|LVAD|Arrest|Transplant|Impella RP|Escalat|Assis|V-A|CRRT/i.test(notes);

    const outcomeStr = getString(["outcome", "status", "death", "disposition", "survive"]).toLowerCase();
    const isDead = outcomeStr.match(/expired|death|dead|deceased|died|mortality|exit/) !== null;
    const isAlive = outcomeStr.match(/alive|survive|home|discharge|rehab|stable/) !== null;
    const survived = isDead ? false : true;

    return {
      id: `P-${idx + 1}`,
      name: getString(["name", "id", "patient", "mrn", "subject"]).slice(0, 30) || `Patient ${idx + 1}`,
      age: findValue(pRow, ["age", "yrs", "years"], []),
      scai: findValue(pRow, ["scai", "shock", "stage"], []),
      preRA: findValue(pRow, ["ra", "cvp", "atrial"], ["pre", "base", "rhc"]),
      postRA: findValue(pRow, ["ra", "cvp", "atrial"], ["post", "48h", "now"]),
      prePCWP: findValue(pRow, ["pcwp", "wedge", "paop"], ["pre", "base", "rhc"]),
      postPCWP: findValue(pRow, ["pcwp", "wedge", "paop"], ["post", "48h", "now"]),
      preCPO: findValue(pRow, ["cpo", "power"], ["pre", "base", "rhc"]),
      postCPO: findValue(pRow, ["cpo", "power"], ["post", "48h", "now"]),
      prePAPI: findValue(pRow, ["papi"], ["pre", "base", "rhc"]),
      postPAPI: findValue(pRow, ["papi"], ["post", "48h", "now"]),
      preVIS: findValue(pRow, ["vis", "inotrope"], ["pre", "base", "rhc"]),
      postVIS: findValue(pRow, ["vis", "inotrope"], ["post", "48h", "now"]),
      eesEa: findValue(pRow, ["ees", "ea", "loop"], []),
      impellaFlow: findValue(pRow, ["flow", "p-flow"], []),
      performanceLevel: findValue(pRow, ["performance", "p-level"], []),
      daysBetweenRhcAndImpella: findValue(pRow, ["days", "timing", "interval"], []),
      renalFailure: getString(["renal", "kidney", "creatinine", "crrt"]).toLowerCase().match(/yes|true|y|fail|crrt/) !== null,
      intubation: getString(["intub", "vent", "ett"]).toLowerCase().match(/yes|true|y|on/) !== null,
      survived,
      notes,
      isEscalated,
      deltaCPO: 0,
      recoveryScore: 0
    };
  });

  const numericKeys: (keyof PatientData)[] = [
    "age", "scai", "preRA", "prePCWP", "preCPO", "prePAPI", "preVIS",
    "postRA", "postPCWP", "postCPO", "postPAPI", "postVIS",
    "impellaFlow", "performanceLevel", "daysBetweenRhcAndImpella", "eesEa"
  ];

  numericKeys.forEach(key => {
    const validValues = patients.map(p => p[key] as number).filter(v => v !== null && v !== undefined && !isNaN(v));
    const meanValue = validValues.length > 0 ? ss.mean(validValues) : 0;
    patients.forEach(p => {
      if (p[key] === null || p[key] === undefined || isNaN(p[key] as number)) {
        (p[key] as any) = meanValue;
      }
    });
  });

  patients.forEach(p => {
    p.deltaCPO = p.postCPO - p.preCPO;
  });

  if (patients.length > 0) {
    const deltas = patients.map(p => p.deltaCPO);
    const minD = Math.min(...deltas);
    const maxD = Math.max(...deltas);
    const range = (maxD - minD) || 1;
    patients.forEach(p => p.recoveryScore = Math.round(((p.deltaCPO - minD) / range) * 100));
  }

  return patients;
}

function trainAndPredict(patients: PatientData[]) {
  if (patients.length < 5) return null;

  const X = patients.map(p => [
    p.preRA, p.prePCWP, p.preCPO, p.prePAPI, p.preVIS, p.isEscalated ? 1 : 0
  ]);
  
  const y = patients.map(p => p.survived ? 1 : 0);
  const predictions: { patientId: string; recoveryProbability: number }[] = [];

  for (let i = 0; i < patients.length; i++) {
    const trainingX = X.filter((_, idx) => idx !== i);
    const trainingY = y.filter((_, idx) => idx !== i);
    const testX = [X[i]];

    const rf = new RandomForestRegression({
      nEstimators: 50,
      seed: 42
    });

    try {
      rf.train(trainingX, trainingY);
      const prob = rf.predict(testX)[0];
      predictions.push({
        patientId: patients[i].id,
        recoveryProbability: Math.min(Math.max(prob, 0), 1)
      });
    } catch (e) {
      console.error("RF Training failed", e);
    }
  }
  return predictions;
}

function checkEscalationAlerts(patients: PatientData[]) {
  try {
    const kbPath = path.join(process.cwd(), 'impella_knowledge_base.json');
    if (!fs.existsSync(kbPath)) return patients;
    
    const kb = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
    
    return patients.map(p => {
      if (p.eesEa === undefined) return p;
      
      // Find historical matches on Ees/Ea
      // "Strict" match within 10% or just closest
      const matches = kb.filter((h: any) => {
        const historicalEesEa = h.support_and_outcomes.ees_ea;
        if (typeof historicalEesEa !== 'number') return false;
        const diff = Math.abs(historicalEesEa - (p.eesEa || 0));
        return diff < (p.eesEa || 0.1) * 0.15; // 15% tolerance
      });
      
      const hasEscalatedHistoricalMatch = matches.some((m: any) => m.support_and_outcomes.escalated === 1);
      
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

async function startServer() {
  const app = express();
  const PORT = 3000;
  const upload = multer({ storage: multer.memoryStorage() });

  app.use(express.json());

  app.get("/api/download-example", (req, res) => {
    const exampleData = [
      ["Metric", "Patient A", "Patient B", "Patient C", "Patient D", "Patient E"],
      ["Name", "John Doe", "Jane Smith", "Robert Brown", "Victoria Lane", "James Bond"],
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
      ["Notes", "Good recovery", "Escalated to ECMO", "Minimal support", "Transplant candidate", "Arrested in ED"],
      ["Outcome", "Survived", "Deceased", "Survived", "Survived", "Survived"]
    ];

    const ws = XLSX.utils.aoa_to_sheet(exampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SampleData");
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="impella_clinical_sample.xlsx"');
    res.send(buf);
  });

  app.get("/api/sample", async (req, res) => {
    const samplePatients: PatientData[] = [
      {
        id: "P-1", name: "Bryan Jones",
        preRA: 16, prePCWP: 33, preCPO: 0.60, prePAPI: 1.5, preVIS: 3,
        postRA: 18, postPCWP: 30, postCPO: 0.65, postPAPI: 1.4, postVIS: 3,
        impellaFlow: 3.7, performanceLevel: 6, daysBetweenRhcAndImpella: 2,
        renalFailure: false, intubation: false, survived: true,
        notes: "Stable support, no issues.", isEscalated: false,
        deltaCPO: 0.05, recoveryScore: 45, eesEa: 0.82
      },
      {
        id: "P-2", name: "Sarah Miller",
        preRA: 22, prePCWP: 35, preCPO: 0.45, prePAPI: 0.8, preVIS: 12,
        postRA: 24, postPCWP: 32, postCPO: 0.42, postPAPI: 0.7, postVIS: 15,
        impellaFlow: 3.2, performanceLevel: 5, daysBetweenRhcAndImpella: 4,
        renalFailure: true, intubation: true, survived: false,
        notes: "Arrested pre-implant, ECMO required.", isEscalated: true,
        deltaCPO: -0.03, recoveryScore: 10, eesEa: 0.33
      },
      {
        id: "P-3", name: "Mark Thompson",
        preRA: 12, prePCWP: 28, preCPO: 0.70, prePAPI: 2.1, preVIS: 2,
        postRA: 10, postPCWP: 18, postCPO: 0.95, postPAPI: 2.5, postVIS: 0,
        impellaFlow: 4.1, performanceLevel: 8, daysBetweenRhcAndImpella: 1,
        renalFailure: false, intubation: false, survived: true,
        notes: "Rapid recovery post-Impella CP.", isEscalated: false,
        deltaCPO: 0.25, recoveryScore: 90, eesEa: 1.1
      }
    ];

    const enhancedPatients = checkEscalationAlerts(samplePatients);
    const predictions = trainAndPredict(enhancedPatients);
    const summary = {
      averageDeltaCPO: enhancedPatients.length > 0 ? ss.mean(enhancedPatients.map(p => p.deltaCPO)) : 0,
      riskPatientCount: enhancedPatients.filter(p => p.postRA > 20 || p.postPAPI < 1.0).length,
      recoveryScoreAverage: enhancedPatients.length > 0 ? ss.mean(enhancedPatients.map(p => p.recoveryScore)) : 0
    };
    res.json({ patients: enhancedPatients, summary, predictions });
  });

  app.post("/api/analyze", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      let patients = processExcelData(req.file.buffer);
      if (patients.length === 0) {
        return res.status(400).json({ error: "No valid patient data found in the Excel file. please ensure metrics are in rows and patients in columns." });
      }
      patients = checkEscalationAlerts(patients);
      const predictions = trainAndPredict(patients);
      const summary = {
        averageDeltaCPO: patients.length > 0 ? ss.mean(patients.map(p => p.deltaCPO)) : 0,
        riskPatientCount: patients.filter(p => p.postRA > 20 || p.postPAPI < 1.0).length,
        recoveryScoreAverage: patients.length > 0 ? ss.mean(patients.map(p => p.recoveryScore)) : 0
      };
      res.json({ patients, summary, predictions });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to process data" });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Impella Analytics Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
