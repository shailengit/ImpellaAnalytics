/**
 * Test JS inference engine on Excel data.
 * Run: node scripts/test_js_inference.mjs
 */
import XLSX from "xlsx";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Load the parser and predictor
const parser = require("../src/excel-parser.ts");
const { predictFromJsModels } = require("../src/ml-models/predict.ts");
const weights = require("../src/ml-models/model-weights.json");

// Parse Excel
const wb = XLSX.readFile("Impella_MK.xlsx");
const patients = parser.processExcelData(wb);

console.log(`Parsed ${patients.length} patients\n`);

// Run inference
const result = predictFromJsModels(patients);

// Print results sorted by survival
result.patients
  .sort((a, b) => (b.riskScores?.survival ?? 0) - (a.riskScores?.survival ?? 0))
  .forEach((p) => {
    const s = p.riskScores?.survival;
    const e = p.riskScores?.escalation;
    const r = p.riskScores?.rvDysfunction;
    const isNaN = s === undefined || s === null || isNaN(s);
    const marker = isNaN ? " *** NaN ***" : "";
    console.log(
      `${p.name?.padEnd(20) || "?"} | surv: ${(s !== undefined && !isNaN(s) ? (s * 100).toFixed(1) : "NaN").padStart(6)}% | esc: ${(e !== undefined ? (e * 100).toFixed(1) : "?").padStart(6)}% | rv: ${(r !== undefined ? (r * 100).toFixed(1) : "?").padStart(6)}%${marker}`
    );
  });

// Summary
const nanCount = result.patients.filter(
  (p) => p.riskScores?.survival === null || p.riskScores?.survival === undefined || isNaN(p.riskScores?.survival)
).length;
const validPatients = result.patients.filter(
  (p) => p.riskScores?.survival !== null && p.riskScores?.survival !== undefined && !isNaN(p.riskScores?.survival)
);
const avgSurvival = validPatients.reduce((s, p) => s + p.riskScores.survival, 0) / validPatients.length;
const avgEsc = validPatients.reduce((s, p) => s + p.riskScores.escalation, 0) / validPatients.length;
const avgRv = validPatients.reduce((s, p) => s + p.riskScores.rvDysfunction, 0) / validPatients.length;

console.log(`\n--- Summary ---`);
console.log(`NaN survival count: ${nanCount} / ${result.patients.length}`);
console.log(`Avg survival: ${(avgSurvival * 100).toFixed(1)}%`);
console.log(`Avg escalation: ${(avgEsc * 100).toFixed(1)}%`);
console.log(`Avg RV dysfunction: ${(avgRv * 100).toFixed(1)}%`);
console.log(`Patients >50% survival: ${validPatients.filter((p) => p.riskScores.survival > 0.5).length}`);
console.log(`Patients >20% survival: ${validPatients.filter((p) => p.riskScores.survival > 0.2).length}`);