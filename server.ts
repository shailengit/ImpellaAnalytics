import express from "express";
import path from "path";
import multer from "multer";
import * as XLSX from "xlsx";
import { GoogleGenAI } from "@google/genai";
import * as ss from "simple-statistics";
import * as fs from "fs";
import { execFile } from "child_process";
import { PatientData, processExcelData, trainAndPredict, checkEscalationAlerts, runPythonPredictions } from "./src/excel-parser";

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 2956;
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
    const mlResult = await runPythonPredictions(enhancedPatients);
    enhancedPatients = mlResult.patients;
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
      const mlResult = await runPythonPredictions(patients);
      patients = mlResult.patients;
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Impella Analytics Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
