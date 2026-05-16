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
  age?: number;
  scai?: any;
  eesEa?: number;
  deltaCPO: number;
  recoveryScore: number;
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

  const patients: PatientData[] = [];

  // Since your data is formatted with one patient per column, 
  // we loop through the columns starting from column index 1 (skipping the labels in col 0)
  const numColumns = rawData[0] ? rawData[0].length : 0;

  for (let colIndex = 1; colIndex < numColumns; colIndex++) {
    // Check if the column has a valid identifier or data before treating it as a patient
    const firstRowValue = rawData[0][colIndex];
    if (!firstRowValue) continue;

    let patientData: any = {
      id: String(firstRowValue).trim(),
      name: 'Patient ' + colIndex, // Fallback placeholder name
      notes: '',
      isEscalated: false,
      survived: true, // Default baseline
      renalFailure: false,
      intubation: false
    };
    
    let currentSection = 'general';

    // Loop vertically down this single patient's column
    for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      if (!row || row.length === 0) continue;
      
      const label = String(row[0] || '').toLowerCase().trim();
      const value = row[colIndex];
      
      if (!label) continue;

      // Track general clinical notes if encountered near the top or outcomes
      if (label.includes('general') || label.includes('outcomes')) {
        if (value && isNaN(Number(value))) {
          patientData.notes += String(value) + ' ';
        }
      }

      // Context switching based on your exact section headers
      if (label.includes('index rhc data')) {
        currentSection = 'pre';
        continue;
      } else if (label.includes('48h post') || label.includes('supported rhc')) {
        currentSection = 'post';
        continue;
      } else if (label.includes('echo  (pre-impella)')) {
        currentSection = 'echo_pre';
        continue;
      } else if (label.includes('echo  (post-impella)')) {
        currentSection = 'echo_post';
        continue;
      } else if (label.includes('labs at rhc')) {
        currentSection = 'labs_pre';
        continue;
      } else if (label.includes('labs 48h after')) {
        currentSection = 'labs_post';
        continue;
      } else if (label.includes('outcomes')) {
        currentSection = 'outcomes';
        continue;
      } else if (label.includes('single beat pv loop')) {
        currentSection = 'pv';
        continue;
      }

      // Helper to parse numeric values safely (handling N/A)
      const parseNum = (val: any) => {
        if (val === undefined || val === null || String(val).toLowerCase().trim() === 'n/a') return undefined;
        const n = parseFloat(val);
        return isNaN(n) ? undefined : n;
      };

      // Strict mapping based on the active layout block
      if (currentSection === 'general') {
        if (label.includes('first name')) patientData.name = String(value).trim();
        if (label.includes('last name') && value) patientData.name += ' ' + String(value).trim();
        if (label.includes('mrn')) patientData.id = String(value).trim();
        if (label.includes('age')) patientData.age = parseNum(value);
        if (label.includes('scai stage')) patientData.scai = String(value).trim();
        if (label.includes('days between rhc')) patientData.daysBetweenRhcAndImpella = parseNum(value) || 0;
      } 
      else if (currentSection === 'pre') {
        if (label.startsWith('ra pressure')) patientData.preRA = parseNum(value) || 0;
        if (label.startsWith('pcwp')) patientData.prePCWP = parseNum(value) || 0;
        if (label.startsWith('papi')) patientData.prePAPI = parseNum(value) || 1.0;
        if (label.startsWith('cpo')) patientData.preCPO = parseNum(value) || 0;
        if (label.startsWith('hr (bpm)')) patientData.preVIS = parseNum(value) || 0; // fallback usage if needed
      } 
      else if (currentSection === 'post') {
        if (label.startsWith('ra pressure')) patientData.postRA = parseNum(value) || 0;
        if (label.startsWith('pcwp')) patientData.postPCWP = parseNum(value) || 0;
        if (label.startsWith('papi')) patientData.postPAPI = parseNum(value) || 1.0;
        if (label.startsWith('cpo')) patientData.postCPO = parseNum(value) || 0;
      }
      else if (currentSection === 'pv') {
        if (label.includes('ees/ea')) patientData.eesEa = parseNum(value);
      }
      else if (currentSection === 'outcomes') {
        if (label.includes('renal failure')) patientData.renalFailure = parseNum(value) === 1;
        if (label.includes('intubation')) patientData.intubation = parseNum(value) === 1;
        if (label.includes('outcome')) {
          // If outcome status indicates expiration/death dynamically
          const outVal = parseNum(value);
          if (outVal === 3 || String(value).toLowerCase().includes('die') || String(value).toLowerCase().includes('exp')) {
            patientData.survived = false;
          }
        }
      }
    }

    // Direct mathematical calculations isolated per column profile
    patientData.preCPO = patientData.preCPO || 0;
    patientData.postCPO = patientData.postCPO || 0;
    patientData.deltaCPO = patientData.postCPO - patientData.preCPO;

    // Derived Recovery Score logic based on CPO normalization metrics
    const rawScore = (patientData.deltaCPO + 0.5) * 100; 
    patientData.recoveryScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    // Fallbacks for missing required UI elements
    patientData.preVIS = patientData.preVIS || 0;
    patientData.postVIS = patientData.postVIS || 0;
    patientData.impellaFlow = patientData.impellaFlow || 4.0;
    patientData.performanceLevel = patientData.performanceLevel || 8;

    patients.push(patientData);
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
