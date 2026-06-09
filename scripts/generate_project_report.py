#!/usr/bin/env python3
"""
generate_project_report.py
==========================
Generates a comprehensive, self-contained HTML report and PDF documenting
the ImpellaAnalytics project — architecture, clinical concepts, ML pipeline,
data flow, and key findings.

Usage:
    python scripts/generate_project_report.py

Outputs:
    docs/project_report.html
    docs/project_report.pdf
"""

import datetime
from pathlib import Path

OUTPUT_DIR = Path("docs")
OUTPUT_DIR.mkdir(exist_ok=True)

NOW = datetime.datetime.now().strftime("%B %d, %Y")

# ──────────────────────────────────────────────────────────────────────
# CSS
# ──────────────────────────────────────────────────────────────────────

CSS = """
:root {
    --bg: #0A0C10;
    --panel: #14171D;
    --accent: #1A1D24;
    --border: #2D3748;
    --text: #E2E8F0;
    --text-secondary: #A0AEC0;
    --text-muted: #718096;
    --blue: #3B82F6;
    --blue-dim: #1E40AF;
    --green: #22C55E;
    --amber: #F59E0B;
    --red: #EF4444;
    --purple: #A855F7;
    --teal: #14B8A6;
    --orange: #F97316;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: var(--bg); color: var(--text);
    line-height: 1.7; font-size: 15px;
    -webkit-font-smoothing: antialiased;
}
.container { max-width: 1000px; margin: 0 auto; padding: 40px 32px; }

/* Cover */
.cover {
    text-align: center; padding: 80px 32px 60px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 48px;
}
.cover .badge {
    display: inline-block;
    background: var(--blue-dim); color: var(--blue);
    font-size: 11px; font-weight: 700; letter-spacing: 0.15em;
    text-transform: uppercase; padding: 6px 16px; border-radius: 4px;
    margin-bottom: 24px; border: 1px solid rgba(59,130,246,0.3);
}
.cover h1 {
    font-size: 42px; font-weight: 200; letter-spacing: -0.02em;
    margin-bottom: 12px; line-height: 1.2;
}
.cover h1 strong { font-weight: 700; color: var(--blue); }
.cover p.subtitle {
    font-size: 18px; color: var(--text-secondary);
    max-width: 600px; margin: 0 auto 20px;
}
.cover .meta {
    font-size: 13px; color: var(--text-muted);
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    letter-spacing: 0.05em;
}
.cover .divider {
    width: 60px; height: 2px;
    background: linear-gradient(90deg, var(--blue), var(--teal));
    margin: 20px auto; border-radius: 2px;
}

/* TOC */
.toc { margin-bottom: 48px; }
.toc h2 {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.2em; color: var(--text-muted); margin-bottom: 16px;
}
.toc ol { list-style: none; counter-reset: toc; }
.toc li {
    counter-increment: toc; padding: 8px 0;
    border-bottom: 1px solid rgba(45,55,72,0.5);
}
.toc li::before {
    content: counter(toc, decimal-leading-zero);
    color: var(--blue); font-family: 'SF Mono', monospace;
    font-size: 13px; margin-right: 12px; font-weight: 600;
}
.toc a {
    color: var(--text-secondary); text-decoration: none;
    font-size: 14px; transition: color 0.2s;
}
.toc a:hover { color: var(--blue); }

/* Section headers */
.section {
    margin-bottom: 48px; page-break-before: always;
    scroll-margin-top: 32px;
}
.section:first-of-type { page-break-before: auto; }
.section-header {
    display: flex; align-items: center; gap: 16px;
    margin-bottom: 24px; padding-bottom: 12px;
    border-bottom: 2px solid var(--border);
}
.section-number {
    font-family: 'SF Mono', monospace; font-size: 14px; font-weight: 700;
    color: var(--blue); background: rgba(59,130,246,0.1);
    padding: 4px 12px; border-radius: 4px;
    border: 1px solid rgba(59,130,246,0.2); white-space: nowrap;
}
.section-header h2 {
    font-size: 20px; font-weight: 600; letter-spacing: -0.01em;
    color: var(--text);
}
.section-header .bar {
    flex: 1; height: 1px; background: linear-gradient(90deg, var(--border), transparent);
}

/* Content elements */
p { margin-bottom: 16px; color: var(--text-secondary); }
p strong { color: var(--text); font-weight: 600; }
a { color: var(--blue); }

h3 {
    font-size: 16px; font-weight: 600; margin: 28px 0 12px;
    color: var(--text);
}
h4 {
    font-size: 14px; font-weight: 600; margin: 20px 0 8px;
    color: var(--text-secondary);
}

ul, ol { margin: 0 0 16px 24px; color: var(--text-secondary); }
li { margin-bottom: 6px; }
li strong { color: var(--text); }

/* Cards */
.card {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 8px; padding: 24px; margin-bottom: 20px;
}
.card h4 {
    margin-top: 0; font-size: 14px; font-weight: 700; color: var(--blue);
    text-transform: uppercase; letter-spacing: 0.05em;
    margin-bottom: 12px;
}
.card p:last-child { margin-bottom: 0; }
.card-row {
    display: flex; gap: 16px; flex-wrap: wrap;
    margin-bottom: 20px;
}
.card-row .card { flex: 1; min-width: 200px; }

/* Info boxes */
.info-box {
    background: rgba(59,130,246,0.08);
    border-left: 3px solid var(--blue);
    border-radius: 0 6px 6px 0; padding: 16px 20px;
    margin-bottom: 20px;
}
.info-box.warning {
    background: rgba(245,158,11,0.08);
    border-left-color: var(--amber);
}
.info-box.danger {
    background: rgba(239,68,68,0.08);
    border-left-color: var(--red);
}
.info-box.success {
    background: rgba(34,197,94,0.08);
    border-left-color: var(--green);
}
.info-box p:last-child { margin-bottom: 0; }

/* Tables */
.table-wrap {
    overflow-x: auto; margin-bottom: 20px;
    border: 1px solid var(--border); border-radius: 8px;
}
table {
    width: 100%; border-collapse: collapse;
    font-size: 13px;
}
thead th {
    background: var(--accent); color: var(--text);
    font-weight: 600; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.08em; padding: 10px 12px;
    text-align: left; border-bottom: 1px solid var(--border);
}
tbody td {
    padding: 8px 12px; border-bottom: 1px solid var(--border);
    color: var(--text-secondary);
}
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover { background: rgba(59,130,246,0.05); }

/* Code */
code {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Fira Code', monospace;
    font-size: 12px; background: rgba(45,55,72,0.5);
    padding: 2px 6px; border-radius: 3px; color: var(--teal);
}
pre {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Fira Code', monospace;
    font-size: 12px; line-height: 1.6;
    background: var(--accent); border: 1px solid var(--border);
    border-radius: 6px; padding: 16px; overflow-x: auto;
    margin-bottom: 20px; color: var(--text-secondary);
}
pre .kw { color: var(--purple); }
pre .fn { color: var(--blue); }
pre .str { color: var(--green); }
pre .cm { color: var(--text-muted); font-style: italic; }

/* Metrics strip */
.metrics {
    display: flex; gap: 12px; flex-wrap: wrap;
    margin-bottom: 24px;
}
.metric {
    flex: 1; min-width: 130px;
    background: var(--accent); border: 1px solid var(--border);
    border-radius: 8px; padding: 16px; text-align: center;
}
.metric .value {
    font-size: 28px; font-weight: 200; color: var(--blue);
    line-height: 1.2; font-variant-numeric: tabular-nums;
}
.metric .label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--text-muted); font-weight: 600; margin-top: 4px;
}

/* Flow diagram (text-based) */
.flow {
    font-family: 'SF Mono', monospace; font-size: 12px;
    background: var(--accent); border: 1px solid var(--border);
    border-radius: 8px; padding: 20px; margin-bottom: 20px;
    color: var(--text-secondary); line-height: 2;
    text-align: center;
}
.flow .arrow { color: var(--blue); margin: 0 8px; }
.flow .step {
    display: inline-block; background: var(--panel);
    border: 1px solid var(--border); border-radius: 4px;
    padding: 4px 10px; margin: 2px;
}
.flow .step.highlight { border-color: var(--blue); color: var(--blue); }

/* Glossary */
.glossary-term {
    margin-bottom: 16px; padding: 16px;
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 8px;
}
.glossary-term .term {
    font-weight: 600; color: var(--teal);
    font-size: 14px; margin-bottom: 4px;
}
.glossary-term .def { font-size: 13px; color: var(--text-secondary); }

/* Footer */
.footer {
    text-align: center; padding: 40px 0;
    border-top: 1px solid var(--border);
    margin-top: 48px;
}
.footer p { font-size: 12px; color: var(--text-muted); margin-bottom: 0; }

/* Print */
@media print {
    body { background: white; color: black; }
    .container { max-width: none; padding: 20px; }
    .cover h1 { color: black; }
    .cover h1 strong { color: #1a56db; }
    .card { background: #f8f9fa; border-color: #ddd; break-inside: avoid; }
    .section { page-break-before: always; }
    .section:first-of-type { page-break-before: auto; }
    .metric .value { color: #1a56db; }
    code { background: #eee; }
    .info-box { background: #f0f4ff; }
    .glossary-term { background: #f8f9fa; border-color: #ddd; }
    .table-wrap { border-color: #ddd; }
    thead th { background: #e9ecef; color: black; }
    tbody td { border-color: #dee2e6; color: #333; }
    pre { background: #f5f5f5; border-color: #ddd; color: #333; }
    .flow { background: #f5f5f5; color: #333; }
    .flow .step { background: #e9ecef; }
    .cover { border-bottom-color: #ddd; }
    .section-header { border-bottom-color: #ddd; }
    .section-number { background: #e9ecef; border-color: #1a56db; }
    .footer { border-top-color: #ddd; }
    .toc a { color: #1a56db; }
    a { color: #1a56db; }
    p { color: #333; }
    p strong { color: black; }
    h3 { color: black; }
    .section-header h2 { color: black; }
    .card h4 { color: #1a56db; }
    .info-box.warning { background: #fffbf0; }
    .info-box.danger { background: #fff0f0; }
    .info-box.success { background: #f0fff4; }
    .glossary-term .term { color: #0d9488; }
    .glossary-term .def { color: #333; }
    pre code { color: #333; }
    pre .kw { color: #9333ea; }
    pre .fn { color: #2563eb; }
    pre .str { color: #16a34a; }
    tbody tr:hover { background: transparent; }
    .metric { background: #f8f9fa; }
    .metrics { break-inside: avoid; }
    .card-row { break-inside: avoid; }
}
"""

# ──────────────────────────────────────────────────────────────────────
# HTML Section Builders
# ──────────────────────────────────────────────────────────────────────

def build_cover() -> str:
    return f"""
<div class="cover">
    <div class="badge">Project Documentation</div>
    <h1>Impella <strong>Analytics</strong></h1>
    <p class="subtitle">A Clinical Decision Support Platform for Hemodynamic Recovery<br>in Impella-Supported Cardiogenic Shock Patients</p>
    <div class="divider"></div>
    <p class="meta">Generated {NOW} · Full-Stack TypeScript + Python ML</p>
</div>"""


def build_toc() -> str:
    return f"""
<div class="toc">
    <h2>Table of Contents</h2>
    <ol>
        <li><a href="#s1">Executive Summary &amp; Project Overview</a></li>
        <li><a href="#s2">Clinical Concepts — A Reference Glossary</a></li>
        <li><a href="#s3">System Architecture</a></li>
        <li><a href="#s4">Data Flow — End to End</a></li>
        <li><a href="#s5">Pages &amp; Components</a></li>
        <li><a href="#s6">API Endpoints</a></li>
        <li><a href="#s7">ML Training Scripts</a></li>
        <li><a href="#s8">ML Prediction at Runtime</a></li>
        <li><a href="#s9">Machine Learning Methods — Explained</a></li>
        <li><a href="#s10">Clinical Decision Support</a></li>
        <li><a href="#s11">Key Findings &amp; Clinical Insights</a></li>
        <li><a href="#s12">Limitations &amp; Future Directions</a></li>
    </ol>
</div>"""


def build_section(sid: str, title: str, content: str, first: bool = False) -> str:
    cls = "section"
    if not first:
        cls += " page-break"
    return f"""
<div class="{cls}" id="{sid}">
    <div class="section-header">
        <span class="section-number">{sid.upper().replace('S','S ')}</span>
        <h2>{title}</h2>
        <div class="bar"></div>
    </div>
    {content}
</div>"""


# ──────────────────────────────────────────────────────────────────────
# Section 1 — Executive Summary
# ──────────────────────────────────────────────────────────────────────

def section_1() -> str:
    return """
<div class="metrics">
    <div class="metric"><div class="value">128</div><div class="label">Patients</div></div>
    <div class="metric"><div class="value">185+</div><div class="label">ML Features</div></div>
    <div class="metric"><div class="value">3</div><div class="label">Risk Models</div></div>
    <div class="metric"><div class="value">3</div><div class="label">Patient Phenotypes</div></div>
    <div class="metric"><div class="value">7</div><div class="label">Dashboard Pages</div></div>
    <div class="metric"><div class="value">10</div><div class="label">API Endpoints</div></div>
</div>

<p><strong>Impella Analytics</strong> is a clinical decision support platform designed for cardiologists, shock-team intensivists, and clinical researchers who manage patients on <strong>Impella</strong> mechanical circulatory support. Built as a full-stack web application, it combines a modern React frontend with a Python machine learning backend to transform raw hemodynamic data into actionable risk assessments and treatment guidance.</p>

<p>The platform ingests <strong>right heart catheterization (RHC)</strong> data — the invasive pressure and flow measurements that define a patient's hemodynamic state — from Excel spreadsheets, then runs a sophisticated ML pipeline to predict three critical outcomes:</p>

<ol>
    <li><strong>Survival</strong> — Whether the patient will survive to hospital discharge</li>
    <li><strong>MCS Escalation</strong> — Whether the patient will require advanced mechanical support (ECMO, surgical LVAD, or heart transplant)</li>
    <li><strong>RV Dysfunction</strong> — Whether the right ventricle will fail during Impella support</li>
</ol>

<p>Beyond prediction, the platform provides <strong>clinical decision support</strong> features: a weaning readiness checklist, escalation danger warnings, explainable risk drivers (which specific clinical measurements are driving each patient's risk score), a "What-If" treatment simulator, and an optional AI-generated clinical handoff summary powered by Google Gemini.</p>

<p>The project also includes <strong>unsupervised patient phenotyping</strong> (consensus clustering that identifies three distinct clinical subgroups) and <strong>comprehensive feature importance analysis</strong> (five complementary methods cross-referenced to identify the most robust mortality predictors).</p>

<h3>Tech Stack</h3>
<table>
    <thead><tr><th>Tier</th><th>Technology</th><th>Purpose</th></tr></thead>
    <tbody>
        <tr><td>Frontend</td><td>React 19 · TypeScript 5.8 · Vite 6 · Tailwind CSS v4 · Recharts · Framer Motion</td><td>Dark-themed SPA with cohort dashboards, risk meters, scatter plots, bar charts, and interactive patient detail views</td></tr>
        <tr><td>Backend</td><td>Express 4 · Multer · xlsx · simple-statistics · ml-random-forest</td><td>HTTP server, Excel parsing, LOOCV RandomForest, Python subprocess orchestration</td></tr>
        <tr><td>ML Pipeline</td><td>Python 3 · scikit-learn · pandas · joblib · SHAP · matplotlib · seaborn</td><td>Model training, feature engineering, cross-validation, explainability, and runtime inference</td></tr>
        <tr><td>AI</td><td>Google Gemini 1.5 Flash · GoogleGenAI SDK</td><td>Optional clinical handoff note generation from patient data</td></tr>
    </tbody>
</table>

<h3>Key Numbers</h3>
<ul>
    <li><strong>Training cohort:</strong> 112 patients (merged from Patient Data and Cohort sheets of <code>Impella_MK.xlsx</code>)</li>
    <li><strong>Engineered features:</strong> 185+ (raw hemodynamics + delta changes + ratios + composite scores)</li>
    <li><strong>MCS Escalation model AUC:</strong> 0.95 (clinically useful)</li>
    <li><strong>RV Dysfunction model AUC:</strong> 0.94 (clinically useful)</li>
    <li><strong>Survival model AUC:</strong> 0.89 (clinically useful)</li>
    <li><strong>Patient phenotypes:</strong> 3 consensus clusters (Non-congested, Cardiorenal, Cardiometabolic) with silhouette score 0.237</li>
</ul>

<div class="info-box">
    <p><strong>Important:</strong> This platform is intended for <strong>clinical research and decision support</strong>, not as a standalone diagnostic tool. All ML predictions should be calibrated against real-time clinical assessment. The survival model in particular has limited predictive power and should not be used for triage decisions.</p>
</div>"""


# ──────────────────────────────────────────────────────────────────────
# Section 2 — Clinical Glossary
# ──────────────────────────────────────────────────────────────────────

def section_2() -> str:
    terms = [
        ("Impella Device",
         "A <strong>percutaneous microaxial left ventricular assist device (LVAD)</strong> — a tiny propeller pump small enough to be threaded through the femoral artery in the leg, up the aorta, and across the aortic valve into the left ventricle. Once positioned, it spins at up to 51,000 RPM, pulling blood from the left ventricle and ejecting it into the ascending aorta. This <strong>unloads</strong> the failing left ventricle — reducing the work the heart has to do — while maintaining blood flow to the rest of the body. Performance levels P-1 through P-9 correspond to increasing flow rates from ~1.0 L/min to ~5.0+ L/min. The Impella is unique among temporary MCS devices because it provides active left ventricular unloading rather than just circulatory support."),

        ("Cardiogenic Shock",
         "A life-threatening state in which the heart cannot pump enough blood to meet the body's metabolic demands. Manifests as <strong>hypotension</strong> (low blood pressure), <strong>end-organ hypoperfusion</strong> (kidneys stop filtering → rising creatinine, liver becomes congested → elevated liver enzymes, muscles switch to anaerobic metabolism → lactic acidosis), and <strong>elevated filling pressures</strong> (blood dams up behind the failing heart, causing pulmonary congestion and systemic edema). The SCAI (Society for Cardiovascular Angiography and Interventions) classification defines five stages of shock severity from B (pre-shock / at risk) through E (extremis — refractory shock with multi-organ failure). Approximately 40–60% of cardiogenic shock patients die within 30 days despite modern therapy."),

        ("Right Heart Catheterization (RHC)",
         "Also called <strong>pulmonary artery catheterization</strong> or Swan-Ganz catheterization. A thin, flexible tube is inserted through a central vein and floated through the right side of the heart into the pulmonary artery. This allows direct measurement of <strong>intracardiac pressures and blood flow</strong>: right atrial pressure (RA, reflecting right ventricular filling), pulmonary artery pressures (systolic PASP, diastolic PADP), pulmonary capillary wedge pressure (PCWP, reflecting left atrial pressure and left ventricular filling), and thermodilution cardiac output (TDCO, total blood flow in L/min). RHC is the gold standard for hemodynamic assessment in cardiogenic shock."),

        ("Cardiac Power Output (CPO)",
         "A composite measure of the heart's pumping capability, calculated as <code>CPO = (MAP × CO) / 451</code>, where MAP is mean arterial pressure and CO is cardiac output. CPO is measured in <strong>Watts</strong> (a unit of power). Normal resting CPO is approximately 1.0 W. Values below <strong>0.6 W</strong> indicate severe myocardial depression and are associated with poor outcomes. The <strong>delta CPO</strong> (change from pre-implant to 48 hours post-implant) is the single most important prognostic hemodynamic trend: a positive delta means the patient is improving on Impella support; a negative or flat delta signals inadequate recovery."),

        ("Pulmonary Artery Pulsatility Index (PAPI)",
         "A derived measure of <strong>right ventricular function</strong>, calculated as <code>PAPI = (PASP − PADP) / RA</code>. The numerator (PASP − PADP) is the pulmonary artery pulse pressure — the difference between systolic and diastolic pressure in the pulmonary artery, which reflects the right ventricle's ability to generate force during contraction. Dividing by RA pressure normalizes for filling pressure. Normal PAPI is <strong>> 1.5</strong>. Values below <strong>1.0</strong> indicate severe RV dysfunction and strongly predict adverse outcomes. PAPI is particularly important in Impella patients because the Impella only supports the left ventricle — the right ventricle must still function on its own."),

        ("Hemodynamics",
         "The study of blood flow and pressure within the cardiovascular system. Key hemodynamic measurements in this platform include <strong>RA pressure</strong> (normal 2–8 mmHg, reflects right heart filling), <strong>PCWP</strong> (normal 6–12 mmHg, reflects left heart filling), <strong>MAP</strong> (normal 70–100 mmHg, reflects organ perfusion pressure), <strong>PVR</strong> (pulmonary vascular resistance, normal < 2 Wood Units, reflects afterload on the right ventricle), <strong>SBP/DBP</strong> (systolic/diastolic blood pressure), and <strong>HR</strong> (heart rate). The trends of these values — how they change from pre-implant to post-implant — tell clinicians whether the patient is recovering or deteriorating."),

        ("Right Ventricular (RV) Dysfunction",
         "Failure of the right ventricle to pump blood through the pulmonary circulation. In Impella patients, the RV is the <strong>weak link</strong> because Impella supports only the left ventricle — the RV must still generate enough pressure to push blood through the lungs. RV dysfunction is diagnosed through a composite of criteria: <strong>PAPI < 1.0</strong> (reduced pulsatility), <strong>RA > 20 mmHg</strong>(elevated filling pressure), <strong>TAPSE < 1.6 cm</strong> (reduced tricuspid annular motion on echo), <strong>RV S' < 9.5 cm/s</strong> (reduced tissue Doppler velocity), or an explicit diagnosis of RV failure in clinical notes. The platform's ML model predicts RV dysfunction risk with AUC ~0.94, making it the most clinically useful of the three models."),

        ("MCS Escalation",
         "When Impella support alone is insufficient to maintain adequate circulation, patients may need <strong>escalation to more advanced mechanical circulatory support</strong>. This includes <strong>VA-ECMO</strong> (veno-arterial extracorporeal membrane oxygenation — a heart-lung bypass machine that supports both ventricles and provides oxygenation), <strong>surgical LVAD</strong> (a surgically implanted long-term mechanical pump like the HeartMate 3 or HeartWare), or <strong>urgent heart transplant evaluation</strong>. Escalation is a high-morbidity event and accurately predicting which patients will need it is clinically valuable — the platform's escalation model has AUC ~0.95."),

        ("Left Ventricular Assist Device (LVAD)",
         "A surgically implanted mechanical pump that takes over the pumping function of the left ventricle. Unlike the Impella, which is temporary (days to weeks), an LVAD is designed for <strong>long-term support</strong> — months to years. LVADs are used as a <strong>bridge to transplant</strong> (keeping the patient alive while they wait for a donor heart) or as <strong>destination therapy</strong> (permanent support for patients who are not transplant candidates). The Impella can serve as a <strong>bridge to a bridge</strong> — stabilizing the patient until they can receive a surgical LVAD."),

        ("Extracorporeal Membrane Oxygenation (ECMO)",
         "A temporary form of life support that <strong>oxygenates the blood and pumps it through the body</strong>, bypassing both the heart and lungs. In VA-ECMO (veno-arterial), blood is drained from the venous system, pumped through an artificial lung (oxygenator) that removes CO₂ and adds O₂, then returned to the arterial system. Unlike Impella, ECMO supports <strong>both ventricles</strong> and provides gas exchange, making it suitable for patients with respiratory failure or biventricular failure. However, ECMO increases afterload on the left ventricle (the heart has to pump against the ECMO circuit's back-pressure), which can paradoxically worsen left ventricular distention — this is why some patients on ECMO also receive an Impella to vent the left ventricle."),

        ("Weaning",
         "The process of <strong>gradually reducing Impella support</strong> to test whether the native heart has recovered enough to sustain circulation independently. The platform evaluates five weaning criteria: (1) <strong>CPO >= 0.6 W</strong> (the heart can generate adequate power on its own), (2) <strong>lactate < 2.0 mmol/L</strong> (tissue perfusion is adequate — no anaerobic metabolism), (3) <strong>VIS < 10</strong> (low vasopressor/inotrope requirement), (4) <strong>PAPI >= 1.5</strong> (good right ventricular function), and (5) <strong>extubated</strong> (spontaneous breathing). A patient passes weaning readiness if they meet at least 4 of 5 criteria."),

        ("SCAI Staging",
         "The Society for Cardiovascular Angiography and Interventions shock classification system, which defines five stages of cardiogenic shock severity: <strong>Stage A</strong> (at risk — patient has risk factors but no signs of shock), <strong>Stage B</strong> (beginning — hypotension or tachycardia without hypoperfusion), <strong>Stage C</strong> (classic — hypotension and hypoperfusion requiring inotropes or pressors), <strong>Stage D</strong> (deteriorating — failure to stabilize with initial therapy), and <strong>Stage E</strong> (extremis — refractory shock with multi-organ failure, often requiring ECMO or CPR). Higher SCAI stage correlates strongly with mortality."),

        ("PV Loops &amp; Ventricular-Arterial Coupling",
         "A <strong>pressure-volume (PV) loop</strong> is a graphical representation of a single cardiac cycle — pressure on the y-axis, volume on the x-axis. The loop's shape reveals the heart's contractile properties. <strong>Ees</strong> (end-systolic elastance) measures the ventricle's intrinsic contractility — the slope of the end-systolic pressure-volume relationship. <strong>Ea</strong> (arterial elastance) measures the afterload — the resistance the arterial system presents to ejection. The <strong>Ees/Ea ratio</strong> describes ventricular-arterial (V-A) coupling. A ratio near <strong>1.0</strong> indicates optimal energy transfer from heart to arteries. A ratio < <strong>0.6</strong> indicates V-A uncoupling — the heart cannot overcome the arterial load — and strongly predicts need for MCS escalation. The platform's PV loop analysis module explores this relationship in detail."),

        ("Vasoactive-Inotropic Score (VIS)",
         "A weighted composite score that quantifies the total pharmacologic cardiovascular support a patient is receiving. Each vasopressor or inotrope is assigned a weight based on its potency: dopamine (×1), dobutamine (×1), epinephrine (×100), norepinephrine (×100), milrinone (×10–15), vasopressin (×10,000 U). Higher VIS indicates greater pharmacologic burden. VIS > 15 is considered high and suggests inadequate hemodynamic response to Impella alone. VIS < 10 is one of the five weaning readiness criteria."),
    ]

    html = '<p>A reference glossary of clinical concepts used throughout this project. Each entry explains what the concept is, how it is measured or calculated, and why it matters in the context of Impella-supported cardiogenic shock.</p>'
    for term, defn in terms:
        html += f'<div class="glossary-term"><div class="term">{term}</div><div class="def">{defn}</div></div>'
    return html


# ──────────────────────────────────────────────────────────────────────
# Section 3 — System Architecture
# ──────────────────────────────────────────────────────────────────────

def section_3() -> str:
    return """
<p>The application follows a <strong>full-stack monolith</strong> pattern: a single Express server (written in TypeScript and run with <code>tsx</code> during development, compiled with <code>esbuild</code> for production) serves both the API backend and the React frontend. There is no separate API server — one process does everything.</p>

<div class="flow">
    <span class="step highlight">React SPA</span>
    <span class="arrow">→ HTTP →</span>
    <span class="step highlight">Express Server</span>
    <span class="arrow">→ execFile →</span>
    <span class="step highlight">Python ML</span>
    <span class="arrow">← JSON ←</span>
    <span class="step highlight">Express Server</span>
    <span class="arrow">← JSON ←</span>
    <span class="step highlight">React SPA</span>
</div>

<h3>Development Mode</h3>
<p>When running locally with <code>npm run dev</code>, Vite's dev server middleware is mounted inside Express via <code>middlewareMode: true</code>. This gives you hot module replacement (HMR) — any change to a React component instantly appears in the browser — while still hitting the real Express API endpoints on the same port (2956).</p>

<h3>Production Mode</h3>
<p>Built with <code>npm run build</code>, which runs Vite to compile the React frontend into static assets in <code>dist/</code>, and esbuild to bundle <code>server.ts</code> into <code>dist/server.cjs</code>. In production, Express serves the static dist files directly and falls back to <code>dist/index.html</code> for client-side routing.</p>

<h3>Page Routing</h3>
<p>The application does <strong>not</strong> use React Router. Instead, a simple state variable <code>activePage</code> in <code>App.tsx</code> switches between page components:</p>

<table>
    <thead><tr><th>Page</th><th>State Value</th><th>Component</th></tr></thead>
    <tbody>
        <tr><td>Dashboard</td><td><code>"dashboard"</code></td><td><code>DashboardPage</code></td></tr>
        <tr><td>Active Patient Monitor</td><td><em>(selectedPatient set)</em></td><td><code>ActivePatientMonitor</code></td></tr>
        <tr><td>Patient Phenotypes</td><td><code>"clusters"</code></td><td><code>ClusteringPage</code></td></tr>
        <tr><td>PV Loop Analysis</td><td><code>"pvloop"</code></td><td><code>PVLoopPage</code></td></tr>
        <tr><td>Mortality Features</td><td><code>"mortality"</code></td><td><code>MortalityFeaturesPage</code></td></tr>
        <tr><td>Effectiveness</td><td><code>"effectiveness"</code></td><td><code>EffectivenessDashboard</code></td></tr>
    </tbody>
</table>

<h3>Python ML Integration</h3>
<p>The ML models are not embedded in the Node.js process. Instead, the server spawns a Python child process via <code>execFile</code>, passes patient data as JSON on <strong>stdin</strong>, and reads predictions back from <strong>stdout</strong>. This architecture keeps the ML stack entirely in Python (where scikit-learn, pandas, SHAP, and joblib live) while the application server remains in the Node.js ecosystem. The Python path is configurable via the <code>PYTHON_PATH</code> environment variable, with a hardcoded fallback search list.</p>

<h3>Data Flow</h3>
<div class="flow">
    <span class="step">Excel Upload</span>
    <span class="arrow">→</span>
    <span class="step highlight">processExcelData()</span>
    <span class="arrow">→</span>
    <span class="step">checkEscalationAlerts()</span>
    <span class="arrow">→</span>
    <span class="step highlight">predict_all.py</span>
    <span class="arrow">→</span>
    <span class="step">calculateChecklistAndDrivers()</span>
    <span class="arrow">→</span>
    <span class="step">generateClinicalSummary()</span>
    <span class="arrow">→</span>
    <span class="step highlight">React Dashboard</span>
</div>"""


# ──────────────────────────────────────────────────────────────────────
# Section 4 — Data Flow
# ──────────────────────────────────────────────────────────────────────

def section_4() -> str:
    return """
<p>The end-to-end data flow transforms a raw Excel spreadsheet of patient hemodynamics into an interactive clinical dashboard with ML risk scores, weaning guidance, and explainable AI. Here is the journey, step by step.</p>

<div class="card">
    <h4>Step 1: Data Ingestion</h4>
    <p>The user uploads an <code>.xlsx</code> file through the React UI, or clicks "Load Sample Clinical Cohort" to use three hardcoded sample patients. The sample data endpoint (<code>GET /api/sample</code>) returns data identical in structure to what the upload endpoint produces, allowing clinicians to explore the platform without preparing an Excel file.</p>
    <p>The Excel file's expected layout is <strong>one patient per column</strong>, with metric labels in column 0 and patient identifiers in row 0. The parser recognizes sections by keyword matching on row labels — it scans for phrases like "index RHC data" for pre-implant, "48h post" for post-implant, "echo (pre-impella)" for echo data, and so on. This keyword-driven section detection means the parser is flexible about exact row positions but specific about label text.</p>
</div>

<div class="card">
    <h4>Step 2: Excel Parsing (<code>processExcelData()</code>)</h4>
    <p>The <code>xlsx</code> library reads the workbook. For each patient column, the parser walks through every row label and assigns values to the correct field based on the current section. It handles 10 sections: General (demographics, MRN, SCAI stage), Pre-implant RHC (19 hemodynamic variables), Post-implant RHC (19 variables), Echo pre/post, Labs pre/post (12 analytes each), Inotropes (6 drugs + VIS score), Diuretics, Impella settings (flow, performance level), Outcomes (renal failure, intubation, MCS escalation, survival), and PV loop data (Ees, Ea, Ees/Ea, ESP, EDP, Pmax, and more).</p>
    <p>After parsing, the function computes two derived metrics: <code>deltaCPO = postCPO - preCPO</code> (the change in cardiac power output — the most important hemodynamic trend), and <code>recoveryScore = clamp((deltaCPO + 0.5) × 100, 0, 100)</code> (a 0–100 index of hemodynamic improvement).</p>
</div>

<div class="card">
    <h4>Step 3: Knowledge Base Escalation Alerts</h4>
    <p><code>checkEscalationAlerts()</code> loads <code>impella_knowledge_base.json</code> — a static file containing historical patient records with known Ees/Ea values and escalation outcomes. For each current patient with an Ees/Ea value, it searches for historical matches within a 15% tolerance. If any matched historical patient required MCS escalation, the current patient receives an <code>escalationAlert: true</code> flag. This is a simple, transparent pattern-matching approach to risk flagging — no model required.</p>
</div>

<div class="card">
    <h4>Step 4: Python ML Prediction</h4>
    <p>All patient data is serialized to JSON and piped via stdin to <code>scripts/predict_all.py</code>. The Python script loads three trained scikit-learn models from <code>ml_output/</code> (cached at module level so repeated predictions reuse the same model objects). For each patient, it engineers the same 185+ features that were created during training: delta features (post − pre for all RHC, echo, and lab variables), ratio features (post / pre for key hemodynamics), composite scores (BMI, VIS-high indicator, inotrope count), and numeric encodings (SCAI stage, gender, race). Missing values are imputed with the median (learned from the training cohort) and all features are standardized (z-score, using the training cohort's mean and standard deviation). Each model then produces a probability (0 to 1) for its target outcome.</p>
</div>

<div class="card">
    <h4>Step 5: Clinical Checklist and Risk Drivers</h4>
    <p><code>calculateChecklistAndDrivers()</code> computes the weaning readiness score (percentage of 5 criteria met), escalation danger warnings (4 danger signals plus the knowledge base alert), and explainable risk drivers. The risk drivers are the platform's most important interpretability feature: for each of the three outcomes (survival, escalation, RV dysfunction), up to 3 specific clinical measurements are identified with their impact direction and magnitude. For example, a survival driver might be <code>{feature: "postLactate", impact: 0.25, label: "Sustained tissue perfusion deficit", value: "3.2 mmol/L"}</code>. These are computed using simple threshold rules, not the opaque ML model — making them transparent and clinically verifiable.</p>
</div>

<div class="card">
    <h4>Step 6: AI Clinical Summary (Optional)</h4>
    <p>If <code>GEMINI_API_KEY</code> is set in the environment, the platform can generate a structured clinical handoff note using Google Gemini 1.5 Flash. The prompt includes all relevant patient data and asks Gemini to produce a professional memo covering: (1) clinical recommendation — can the patient be weaned or needs escalation, (2) right ventricular state, (3) end-organ and metabolic clearance, and (4) step-by-step daily management pathway. If Gemini is unavailable (no API key, network error, or parsing failure), the platform falls back to a detailed template-based summary with the same information structure. The fallback ensures reliability in clinical environments where API availability cannot be guaranteed.</p>
</div>

<div class="card">
    <h4>Step 7: Visualization</h4>
    <p>The enhanced patient data — now enriched with ML risk scores, cluster assignments, weaning checklists, escalation warnings, risk drivers, and optionally the AI summary — is returned as a single JSON response to the React frontend. The data flows into the DashboardPage for cohort-level visualization (summary cards, bar charts, scatter plots, patient tables) and into the ActivePatientMonitor for individual patient analysis (risk meters, checklists, simulator, clinical summary). The entire round trip — from file upload to fully enriched dashboard — typically takes 2–5 seconds for a cohort of 5–20 patients.</p>
</div>"""


# ──────────────────────────────────────────────────────────────────────
# Section 5 — Pages & Components
# ──────────────────────────────────────────────────────────────────────

def section_5() -> str:
    return """
<p>The frontend is organized into six main page components and one reusable component. Each page presents a specific analytical view of the patient data.</p>

<h3>DashboardPage</h3>
<p>The landing page and primary interface. Shows a cohort-level overview with four summary cards: <strong>Average Delta CPO</strong> (the cohort's mean change in cardiac power output — positive values indicate overall improvement), <strong>Risk Counter</strong> (number of patients meeting traditional danger thresholds of RA > 20 or PAPI < 1.0), <strong>Recovery Score</strong> (mean cohort recovery index, 0–100), and <strong>Escalation Flags</strong> (count of patients who required ECMO, LVAD, or experienced arrest). Below the cards, three <strong>Risk Meter</strong> components show cohort-average ML risk scores for mortality, escalation, and RV dysfunction. The main visual area has a bar chart of delta CPO per patient (green bars for improvement, red for deterioration) and an RA vs. PAPI scatter plot (a standard clinical visualization where the lower-right quadrant is the "danger zone"). A sidebar lists all patients with their PAPI/CPO values and escalation alerts, and links to individual patient views. Each info button opens a tooltip explaining exactly what the metric means, how it's calculated, and its clinical significance — this is the app's built-in educational layer.</p>

<div class="info-box">
    <p>The Dashboard serves as the <strong>clinical command center</strong>. A clinician should be able to glance at this screen and, within seconds, understand: How sick is this cohort overall? Which patients need immediate attention? Are we seeing improvement or deterioration on Impella support?</p>
</div>

<h3>ActivePatientMonitor</h3>
<p>The detailed individual patient view — the most clinically dense page in the application. Activated by clicking any patient in the Dashboard's patient list. Displays:</p>
<ul>
    <li><strong>Three Risk Meters</strong> — Survival (red, showing mortality risk), Escalation (orange), and RV Dysfunction (amber). Each meter fills from 0% to the patient's risk probability with an animated transition.</li>
    <li><strong>Weaning Checklist</strong> — All 5 weaning criteria with pass/fail status, the composite weaning score (0–100), and a clear PASS/FAIL result. Clinicians can immediately see why a patient is not ready for weaning.</li>
    <li><strong>Escalation Warnings</strong> — The 4 danger signals (RA, PAPI, AST, lactate) plus the knowledge-base escalation alert, each with current value and threshold.</li>
    <li><strong>Risk Drivers</strong> — Three cards (survival, escalation, RV dysfunction), each listing up to 3 specific clinical measurements driving the patient's risk, with impact magnitude and human-readable explanation.</li>
    <li><strong>"What-If" Simulator</strong> — Allows adjusting Impella flow, performance level, VIS, lactate, RA, PAPI, and CPO, then recalculating risk scores, weaning status, and escalation warnings in real time. This is a powerful teaching and treatment planning tool.</li>
    <li><strong>Clinical Handoff Note</strong> — The Gemini-generated or fallback clinical summary in a formatted memo view, suitable for copy-pasting into the patient's electronic health record.</li>
    <li><strong>Cluster Assignment</strong> — The patient's phenotype cluster label and clinical recommendation, if the clustering pipeline has been run.</li>
</ul>

<h3>ClusteringPage (Patient Phenotypes)</h3>
<p>Displays the results of the unsupervised clustering pipeline. Shows a table of cluster profiles (3 phenotypes: Non-congested Low-risk, Cardiorenal Moderate-risk, Cardiometabolic High-risk) with patient counts, survival/escalation/renal failure rates per cluster, and mean feature values. Includes diagnostic visualizations: silhouette plot (validates cluster quality), PCA scatter plot (shows patient distribution in 2D space), consensus matrix heatmap (shows how consistently patients co-clustered across bootstrap iterations), and outcome rates bar chart. Quality metrics (silhouette score, cluster counts) are displayed prominently along with clinical caution text.</p>

<h3>PVLoopPage</h3>
<p>Explores ventricular-arterial coupling mechanics. Shows a scatter plot of Ees/Ea vs. MCS escalation (with logistic regression fit curve and thresholds at 0.40 and 0.60), a bar chart of logistic regression coefficients for the PV-loop-only escalation model, SHAP summary and dependence plots (showing how Ees/Ea and other PV loop features affect model predictions), and a model comparison table. The page uses data from <code>ml_output/pv_loop_escalation_model.json</code> and SHAP values from <code>ml_output/pv_loop_shap.json</code>.</p>

<h3>MortalityFeaturesPage</h3>
<p>Displays the results of the five-method consensus feature importance analysis. Shows the consensus ranking table (all features ranked by consensus score across all 5 methods) with the ability to sort by individual method rankings. Includes a missing data heatmap to help clinicians understand data quality issues. Connected to <code>GET /api/mortality-features</code> which reads <code>mortality_feature_consensus.csv</code>.</p>

<h3>EffectivenessDashboard</h3>
<p>A multi-dimensional analysis of Impella effectiveness in the cohort. Shows survival rates by indication and demographics, pre/post hemodynamic comparisons with statistical significance (Mann-Whitney U tests), lab recovery trajectories, responder profiling (patients who improved CPO, cleared lactate, and survived), ventricular mechanics sub-analysis, and cross-reference with ML model findings. Uses data from <code>public/effectiveness-data.json</code> generated by <code>analyze_effectiveness.py</code>.</p>

<h3>RiskMeter (Reusable Component)</h3>
<p>A single animated risk gauge component used throughout the app. Accepts a label, a value (0–1), a color class, and info content. Renders a percentage display and an animated horizontal progress bar. The info button opens a popover with detailed explanation — making it an educational component as well as a visual indicator.</p>"""


# ──────────────────────────────────────────────────────────────────────
# Section 6 — API Endpoints
# ──────────────────────────────────────────────────────────────────────

def section_6() -> str:
    return """
<p>The server exposes ten REST API endpoints. Every endpoint that handles patient data uses the same processing pipeline internally — this ensures consistency between sample data, uploaded data, and individual patient operations.</p>

<table>
    <thead><tr><th>Endpoint</th><th>Method</th><th>Input</th><th>Output</th><th>Purpose</th></tr></thead>
    <tbody>
        <tr><td><code>/api/sample</code></td><td>GET</td><td>—</td><td>3 sample patients with full ML enrichment</td><td>Quick-start demo without preparing an Excel file</td></tr>
        <tr><td><code>/api/analyze</code></td><td>POST</td><td><code>multipart/form-data</code> with <code>.xlsx</code> file</td><td>All parsed patients with risk scores, clusters, weaning checklists, risk drivers</td><td>Primary data ingestion endpoint</td></tr>
        <tr><td><code>/api/download-example</code></td><td>GET</td><td>—</td><td>5-patient Excel template (<code>.xlsx</code>)</td><td>Provides the expected file format for users</td></tr>
        <tr><td><code>/api/mortality-features</code></td><td>GET</td><td>—</td><td>Top 50 consensus features with per-method rankings</td><td>Feature importance for dashboard display</td></tr>
        <tr><td><code>/api/effectiveness</code></td><td>GET</td><td>—</td><td>Full effectiveness analysis with 6 sections</td><td>Multi-dimensional Impella effectiveness data</td></tr>
        <tr><td><code>/api/pv-loop-data</code></td><td>GET</td><td>—</td><td>PV loop model coefficients, SHAP values, image paths</td><td>Ventricular mechanics analysis data</td></tr>
        <tr><td><code>/api/cluster-profiles</code></td><td>GET</td><td>—</td><td>Cluster profiles (3 phenotypes) + quality metrics</td><td>Patient phenotyping data for dashboard</td></tr>
        <tr><td><code>/api/cluster</code></td><td>POST</td><td>Single patient data JSON</td><td>Cluster assignment (label, name, recommendation, distances, similarities)</td><td>Real-time phenotype classification of individual patients</td></tr>
        <tr><td><code>/api/generate-summary</code></td><td>POST</td><td>Single patient data JSON</td><td>AI-generated or fallback clinical handoff note</td><td>On-demand clinical summary generation</td></tr>
        <tr><td><code>/api/simulate</code></td><td>POST</td><td>Patient data + adjustments JSON</td><td>Simulated patient with recalculated risk scores and weaning status</td><td>"What-If" treatment scenario testing</td></tr>
    </tbody>
</table>"""


# ──────────────────────────────────────────────────────────────────────
# Section 7 — ML Training Scripts
# ──────────────────────────────────────────────────────────────────────

def section_7() -> str:
    return """
<p>Four Python scripts make up the training and analysis pipeline. Each is designed to be run independently, and each produces artifacts consumed by the dashboard or by the prediction scripts.</p>

<div class="card">
    <h4>ml_pipeline.py — Primary ML Training</h4>
    <p><strong>Purpose:</strong> Trains three binary classification models (survival, MCS escalation, RV dysfunction) using scikit-learn. This is the core of the ML system.</p>
    <p><strong>Data loading:</strong> Reads two sheets from <code>Impella_MK.xlsx</code>: "Patient Data" (67 patients, 135+ variables per patient, loaded cell-by-cell using <code>openpyxl</code> with a hardcoded row-number mapping) and "Cohort" (112 patients with outcome data). These are merged on MRN using an outer join, yielding up to 128 combined rows (some patients appear in only one sheet).</p>
    <p><strong>Feature engineering:</strong> Creates 172+ numeric features from 80+ raw columns. Key transformations: delta features (post − pre for all RHC, echo, and lab variables — captures the <em>trend</em> on support), ratio features (post / pre for key hemodynamics — captures relative change), BMI calculation, inotrope count (total number of vasoactive drugs), VIS-high indicator (boolean for VIS > 15), SCAI stage numeric encoding (B=1 through E=4), and numeric conversions for gender, race, and cause of shock.</p>
    <p><strong>Target engineering:</strong> Survival is coded from Cohort outcome strings ("Expired" = 1). Escalation is coded from the MCS escalation column OR keyword matching in clinical notes ("ecmo", "lvad", "transplant", "arrest", "rv failure"). RV dysfunction uses composite clinical criteria: post-PAPI < 1.0, post-RA > 20, post-TAPSE < 1.6, post-RV S' < 9.5, RV-CPO drop > 30%, or RV failure mentioned in notes.</p>
    <p><strong>Preprocessing:</strong> Columns with 100% missing values are dropped. Remaining missing values are imputed with the median of the training cohort (SimpleImputer with <code>strategy="median"</code>). All features are standardized to z-scores (StandardScaler).</p>
    <p><strong>Model training:</strong> Two classifiers per target — LogisticRegression (<code>max_iter=1000, class_weight="balanced"</code>) and RandomForest (<code>n_estimators=200, max_depth=6, class_weight="balanced"</code>). Evaluated with 5-fold stratified cross-validation (stratification ensures each fold preserves the same class ratio as the full dataset). The best model per target (highest AUC) is selected.</p>
    <p><strong>Exports:</strong> Joblib artifacts (<code>model_*.joblib</code>) containing the trained model, imputer, scaler, and feature names — used by <code>predict_all.py</code> at runtime. JSON coefficients (<code>model_*_lr.json</code>) for Logistic Regression models, suitable for direct implementation in JavaScript/TypeScript. ROC curves (<code>roc_*.png</code>), confusion matrices (<code>cm_*.png</code>), and SHAP summary plots (<code>shap_*.png</code>). A markdown report (<code>model_report.md</code>) with full cross-validation results.</p>
</div>

<div class="card">
    <h4>clustering_pipeline.py — Patient Phenotyping</h4>
    <p><strong>Purpose:</strong> Discovers patient subgroups (phenotypes) using unsupervised learning. Unlike the supervised models, clustering has no "correct answer" — it finds natural groupings in the data.</p>
    <p><strong>Methodology:</strong> Consensus K-Means — runs K-means 200 times on bootstrap subsamples (80% of patients each), then builds a consensus matrix where each cell represents how often two patients clustered together. This stabilizes cluster assignments against sampling variability. K is locked at 3 to match the Zweck et al. (2021) published phenotypes (the three SCAI shock classification groups).</p>
    <p><strong>Features (10):</strong> After extensive experimentation (testing 20→37→10→13→10 features), the final set uses Zweck-style features: 6 core pre-implant labs (eGFR, HCO₃, lactate, ALT, WBC, hemoglobin) + right atrial pressure + age + BMI + SCAI stage. PV loop features (Ees, Ea, Ees/Ea) were removed after sandbox testing showed silhouette improved from 0.223 to 0.263 without them. Echo and post-implant variables were too sparse (>50% missing) to include.</p>
    <p><strong>Outputs:</strong> Three clusters with profiles: Non-congested Low-risk (70.4% survival, young, preserved renal function, elevated lactate — a "perfusion-stress" signature), Cardiorenal Moderate-risk (67.6% survival, older, low eGFR, congested), and Cardiometabolic High-risk (50.0% survival, extreme ALT, very high lactate, SCAI D). Silhouette score: 0.237 (moderate separation). Clinical caution text is included with every quality metric output because 0.237 silhouette means cluster boundaries are not sharp.</p>
</div>

<div class="card">
    <h4>mortality_feature_analysis.py — Feature Importance</h4>
    <p><strong>Purpose:</strong> Identifies the most robust predictors of mortality by comparing five complementary statistical and ML methods. This is the project's most methodologically rigorous analysis.</p>
    <p><strong>Five methods:</strong> (1) Random Forest Gini importance — measures how much each feature reduces impurity in 500 decision trees. (2) Permutation importance — measures the drop in AUC when feature values are randomly shuffled (model-agnostic). (3) SHAP values — game-theoretic Shapley values explaining each feature's contribution. (4) LASSO (L1-regularized logistic regression) — drives unimportant coefficients to zero with cross-validated regularization strength. (5) Univariate AUC — each feature's standalone predictive power as a one-variable classifier.</p>
    <p><strong>Key finding:</strong> Post-implant AST (a liver enzyme) is the single strongest mortality predictor, ranked #1 by 3 of 5 methods. This makes clinical sense — rising AST reflects hepatocyte injury from low cardiac output (hypoxic hepatitis) combined with hepatic congestion from right heart failure. Other top features: post-lactate (tissue perfusion), age, post-HCO₃ (acid-base status), post-eGFR (kidney function), post-ALT (liver), post-MAP (blood pressure), and VIS score (vasopressor burden).</p>
    <p><strong>Critical insight:</strong> Delta features (change scores like delta lactate, delta PCWP) outperform single timepoint measurements. This confirms that <em>the trend on support</em> is more informative than any single measurement — a patient whose hemodynamics fail to improve within 48 hours carries disproportionate risk. Also: traditional hemodynamic thresholds (RA > 20, PAPI < 1.0) are clinically relevant but are outperformed by lab values (AST, lactate, HCO₃, eGFR) as mortality predictors.</p>
</div>

<div class="card">
    <h4>analyze_effectiveness.py — Effectiveness Analysis</h4>
    <p><strong>Purpose:</strong> A multi-dimensional audit of Impella hemodynamic support effectiveness in the study cohort. Combines clinical statistics with ML cross-reference.</p>
    <p><strong>Analysis dimensions:</strong> (1) Survival and outcomes by indication, demographics, and SCAI stage. (2) Hemodynamic response — pre/post delta comparisons for all RHC variables with Mann-Whitney U statistical significance testing. (3) Organ function and lab recovery — lactate clearance, renal function trajectories, hemolysis markers. (4) Responder profiling — combines CPO improvement, lactate clearance, and survival into a multi-dimensional responder definition. (5) Ventricular mechanics — Ees/Ea coupling analysis. (6) ML model cross-reference — maps the consensus mortality features back to clinical findings from the effectiveness analysis.</p>
    <p><strong>Outputs:</strong> <code>public/effectiveness-data.json</code> (structured data consumed by the EffectivenessDashboard React component) and <code>public/effectiveness-report.html</code> (a standalone self-contained HTML report with embedded charts and statistical tables).</p>
</div>"""


# ──────────────────────────────────────────────────────────────────────
# Section 8 — ML Prediction
# ──────────────────────────────────────────────────────────────────────

def section_8() -> str:
    return """
<p>Two Python scripts handle ML <strong>inference</strong> — the actual prediction at runtime, as opposed to training. These are called by the Node.js server via subprocess.</p>

<div class="card">
    <h4>predict_all.py — Primary Runtime Prediction</h4>
    <p><strong>Called by:</strong> <code>runPythonPredictions()</code> and <code>runClusterAssignment()</code> in the server.</p>
    <p><strong>Model caching:</strong> Once loaded, models are cached at the Python module level, so the next call within the same process reuses the already-loaded artifacts. This is critical for the "What-If" simulator, which may call <code>predict_all.py</code> multiple times in succession with different parameter adjustments.</p>
    <p><strong>Prediction flow:</strong> (1) Load three risk artifacts (<code>model_survival.joblib</code>, <code>model_escalation.joblib</code>, <code>model_rv_dysfunction.joblib</code>) and the cluster model (<code>cluster_model.joblib</code>). (2) For each patient, engineer 185+ features matching the training pipeline — the <code>engineer_risk_features()</code> function exactly mirrors <code>ml_pipeline.py</code>'s <code>engineer_features()</code>. (3) For each target, impute missing values with the training cohort's median, standardize with the training cohort's z-score, and compute risk probability via <code>predict_proba()</code>. (4) For clustering, engineer 10 Zweck-style features via <code>engineer_cluster_features()</code>, impute, scale, optionally apply PCA (if PCA was the best clustering configuration), and compute Euclidean distance to each cluster centroid — the nearest centroid is the patient's assigned cluster, and inverse-distance-weighted similarities provide a confidence measure.</p>
    <p><strong>Output:</strong> A JSON object with <code>predictions[]</code> (patientId + survival/escalation/rv_dysfunction scores) and <code>clusters[]</code> (patientId + cluster_label, cluster_name, recommendation, distances, similarities).</p>
</div>

<div class="card">
    <h4>predict.py — Legacy Single-Batch Script</h4>
    <p>An earlier version of the prediction script, functionally superseded by <code>predict_all.py</code>. Still present in the codebase for backward compatibility. Loads models, engineers features, and returns risk scores for a single batch of patients. The newer script adds cluster assignment and model caching.</p>
</div>

<h3>Runtime Integration</h3>
<p>The server calls Python via <code>execFile</code>, which spawns a new Python process for each request. The communication protocol is simple: the server writes a JSON payload to the Python process's <strong>stdin</strong> and the Python process writes its JSON response to <strong>stdout</strong>. The server uses a list of candidate Python paths (starting with <code>PYTHON_PATH</code> env var, then several hardcoded system paths) and uses the first one that exists on disk. This handles the common problem of multiple Python installations on clinical workstations.</p>
<p>The Node.js <code>ml-random-forest</code> package runs an additional LOOCV (Leave-One-Out Cross-Validation) RandomForest on the server side for comparison — this is a legacy feature that provides a baseline survival probability using only 6 features (pre-RA, pre-PCWP, pre-CPO, pre-PAPI, pre-VIS, escalation status) rather than the full 185+ features the Python pipeline uses.</p>"""


# ──────────────────────────────────────────────────────────────────────
# Section 9 — ML Methods Explained
# ──────────────────────────────────────────────────────────────────────

def section_9() -> str:
    return """
<p>This section explains the machine learning methods used in this project in plain language — technical enough to be accurate, but accessible to a reader without formal ML training.</p>

<div class="glossary-term">
    <div class="term">Random Forest</div>
    <div class="def"><strong>What it is:</strong> An ensemble of decision trees — typically hundreds of them. Each tree is trained on a random subset of the data (both rows and columns). The forest "votes" by averaging predictions across all trees.<br><br><strong>Why it works:</strong> Individual decision trees overfit (they memorize noise in the training data), but averaging across many decorrelated trees cancels out the noise while preserving the signal. This makes Random Forests robust, resistant to overfitting, and capable of capturing non-linear relationships that linear models miss.<br><br><strong>In this project:</strong> Used for survival and escalation prediction with 200 trees, max depth of 6 (limits how complex each tree can be — prevents overfitting on small data), and <code>class_weight="balanced"</code> (automatically gives more weight to the minority class). The Random Forest is the best model for escalation (AUC 0.95) and performs well for survival (AUC 0.89) after label correction.</div>
</div>

<div class="glossary-term">
    <div class="term">Logistic Regression</div>
    <div class="def"><strong>What it is:</strong> A linear model that estimates the probability of a binary outcome (yes/no) using a weighted sum of input features, passed through a sigmoid function that squashes the output to a 0–1 range. Each feature gets a coefficient (positive = increases probability, negative = decreases).<br><br><strong>Why it works:</strong> Simple, interpretable, and well-understood. The coefficients tell you exactly <em>how</em> each feature affects the outcome — an LVAD surgeon can understand what the model is doing. Logistic Regression also naturally produces well-calibrated probabilities (unlike Random Forests, which can be overconfident).<br><br><strong>In this project:</strong> Best model for RV dysfunction (AUC 0.94). JSON coefficient files are exported so the model could theoretically be reimplemented in pure JavaScript without Python. The <code>class_weight="balanced"</code> parameter is critical — without it, a model trained on 75% survivors would learn to always predict "survive" and achieve 75% accuracy with zero clinical utility.</div>
</div>

<div class="glossary-term">
    <div class="term">Consensus K-Means Clustering</div>
    <div class="def"><strong>What it is:</strong> An unsupervised learning method that groups similar patients together without being told what the "correct" groups are. K-Means works by placing K "centroids" in the data space and assigning each patient to the nearest centroid, then iteratively moving centroids to minimize the total distance.<br><br><strong>Consensus extension:</strong> Standard K-Means is unstable — run it twice and you might get different clusters. Consensus K-Means runs K-Means 200 times on random 80% subsamples of the data, then measures <em>how consistently</em> each pair of patients co-clustered. This produces a consensus matrix (a heatmap where dark cells = patients who almost always cluster together) that is more stable than any single K-Means run.<br><br><strong>Silhouette score:</strong> Measures how well-separated the clusters are, on a scale from −1 (terrible) to +1 (perfect). 0.237 means moderate separation — clusters are distinguishable but overlap somewhat. The clinical caution is important: cluster assignments should be treated as exploratory, not definitive diagnoses.</div>
</div>

<div class="glossary-term">
    <div class="term">SHAP (SHapley Additive exPlanations)</div>
    <div class="def"><strong>What it is:</strong> A game-theoretic method for explaining model predictions. Imagine the model's features are "players" in a cooperative game, and the prediction is the "payout." SHAP computes each feature's fair contribution by averaging its marginal contribution across all possible feature subsets.<br><br><strong>TreeSHAP:</strong> An efficient variant for tree-based models (Random Forest, XGBoost). Instead of retraining the model on all possible feature subsets, TreeSHAP exploits the tree structure to compute exact Shapley values in polynomial time.<br><br><strong>Why it matters:</strong> SHAP values are consistent (a feature with higher true importance always gets a higher SHAP score), locally accurate (explanations match individual predictions), and the only method with a foundation in cooperative game theory. SHAP summary plots show which features matter most and whether high or low values increase risk — for example, SHAP might reveal that high lactate consistently increases mortality risk (red dots to the right of zero).</div>
</div>

<div class="glossary-term">
    <div class="term">LASSO (L1-Regularized Logistic Regression)</div>
    <div class="def"><strong>What it is:</strong> Logistic Regression with an added penalty that is proportional to the sum of the absolute values of the coefficients. This penalty drives unimportant feature coefficients <em>exactly to zero</em> — performing automatic feature selection.<br><br><strong>Why it matters:</strong> In a dataset with 185+ features but only ~100 patients, most features are noise. LASSO automatically identifies the subset of features that actually matter, producing a simpler, more generalizable model. The regularization strength (controlled by the parameter C) was tuned via grid search across 30 values with 5-fold cross-validation to find the optimal sparsity level.</div>
</div>

<div class="glossary-term">
    <div class="term">Cross-Validation (5-Fold Stratified)</div>
    <div class="def"><strong>What it is:</strong> A technique for evaluating model performance without a separate test set. The data is split into 5 equal "folds." The model is trained on 4 folds and tested on the remaining 1 fold, rotating 5 times so every patient is in the test set exactly once. "Stratified" means each fold preserves the same proportion of positive/negative outcomes as the full dataset.<br><br><strong>Why it matters:</strong> Without cross-validation, you can easily overfit — a model might memorize the training data and achieve 99% accuracy on it but fail completely on new patients. 5-fold CV gives a realistic estimate of how the model will perform on unseen data.</div>
</div>

<div class="glossary-term">
    <div class="term">ROC Curves and AUC</div>
    <div class="def"><strong>ROC Curve:</strong> Receiver Operating Characteristic curve — plots the True Positive Rate (sensitivity) against the False Positive Rate (1 − specificity) at every possible decision threshold. A perfect model goes straight up and then right (100% sensitivity at 0% false positives). A random model follows the diagonal.<br><br><strong>AUC:</strong> The Area Under the ROC Curve — a single number summarizing model discrimination. 0.5 = random guessing, 0.7–0.8 = acceptable, 0.8–0.9 = excellent, > 0.9 = outstanding. AUC is <em>threshold-independent</em> — it measures how well the model separates positive from negative cases, regardless of where you set the cutoff.<br><br><strong>In context:</strong> Escalation AUC = 0.95 means the model is outstanding — if you randomly pick one escalated patient and one non-escalated patient, the model will rank the escalated patient higher 95% of the time. Survival AUC = 0.89 means the model is clinically useful after label correction.</div>
</div>

<div class="glossary-term">
    <div class="term">Feature Engineering</div>
    <div class="def"><strong>What it is:</strong> Transforming raw variables into features that better represent the underlying problem to the ML models. Raw data is rarely ML-ready — a single number like "lactate = 3.2" tells you less than "lactate went from 1.5 to 3.2 (rising trend)."<br><br><strong>In this project:</strong> The most important engineered features are <strong>delta features</strong> (post − pre — captures the trajectory on Impella support) and <strong>ratio features</strong> (post / pre — captures the relative change). The mortality feature analysis confirmed that these trend features consistently outperform raw single-timepoint measurements. Other engineered features: BMI (from weight and height), inotrope count (total vasoactive drugs — a proxy for shock severity), VIS-high indicator (boolean for vasopressor burden > 15), and SCAI numeric encoding (categorical staging → numeric values).</div>
</div>

<div class="glossary-term">
    <div class="term">Class Imbalance and Missing Data</div>
    <div class="def"><strong>Class imbalance:</strong> When one outcome is much rarer than the other — in this cohort, ~25% mortality rate. Without correction, a model can achieve 75% accuracy by predicting "survive" for everyone, which is clinically useless. The project handles this with <code>class_weight="balanced"</code>, which automatically adjusts weights to give the minority class equal influence during training.<br><br><strong>Missing data:</strong> Real clinical data is messy — echo and PV loop variables have 30–50% missingness. The pipeline drops columns that are 100% empty and imputes remaining missing values with the <strong>median</strong> of the training cohort. Median imputation is robust to outliers (unlike mean imputation) but may attenuate true clinical signals — this limitation is documented in every model report.</div>
</div>"""


# ──────────────────────────────────────────────────────────────────────
# Section 10 — Clinical Decision Support
# ──────────────────────────────────────────────────────────────────────

def section_10() -> str:
    return """
<p>Beyond ML predictions, the platform provides five clinical decision support features designed to be immediately actionable at the bedside.</p>

<div class="card">
    <h4>1. Weaning Readiness Checklist</h4>
    <p>The weaning checklist evaluates 5 criteria that define whether a patient is ready to begin the Impella weaning process (gradually reducing pump flow to test native heart recovery):</p>
    <table>
        <thead><tr><th>Criterion</th><th>Threshold</th><th>Why It Matters</th></tr></thead>
        <tbody>
            <tr><td>Cardiac Power Output (CPO)</td><td>≥ 0.60 W</td><td>The heart must generate adequate hydraulic power on its own. Below 0.6 W indicates severe myocardial depression.</td></tr>
            <tr><td>Serum Lactate</td><td>< 2.0 mmol/L</td><td>Normal lactate means tissue oxygen delivery is adequate — no ongoing anaerobic metabolism from hypoperfusion.</td></tr>
            <tr><td>Vasoactive-Inotropic Score (VIS)</td><td>< 10</td><td>Low vasopressor/inotrope requirement means the native heart is not dependent on pharmacologic support.</td></tr>
            <tr><td>Pulmonary Artery Pulsatility Index (PAPI)</td><td>≥ 1.50</td><td>Good RV function is essential — Impella only supports the left ventricle, so the RV must function independently for weaning to succeed.</td></tr>
            <tr><td>Extubation Status</td><td>Extubated (spontaneous breathing)</td><td>Spontaneous breathing reduces intrathoracic pressure swings, lowers RV afterload, and is a prerequisite for device explant.</td></tr>
        </tbody>
    </table>
    <p>The composite score is the percentage of criteria met (0–100%). A patient passes (<code>weaningPassed = true</code>) if they meet at least 4 of 5 criteria. The dashboard shows each criterion individually with its current value and pass/fail status, so the clinical team can see exactly <em>why</em> a patient is not yet a weaning candidate.</p>
</div>

<div class="card">
    <h4>2. Escalation Danger Warnings</h4>
    <p>Four clinical danger signals are monitored, plus the knowledge-base historical matching alert:</p>
    <table>
        <thead><tr><th>Signal</th><th>Threshold</th><th>Clinical Meaning</th></tr></thead>
        <tbody>
            <tr><td>Right Atrial Pressure</td><td>> 20 mmHg</td><td>Severe RV congestion — the right heart cannot effectively pump blood forward, causing back-pressure into the venous system.</td></tr>
            <tr><td>PAPI</td><td>< 1.00</td><td>Refractory RV shock — extremely low pulsatility indicates the RV is failing as a pump.</td></tr>
            <tr><td>AST (Liver enzyme)</td><td>> 200 U/L</td><td>Hepatocellular damage from hepatic congestion (back-pressure from the failing RV) and/or hypoxic hepatitis (low cardiac output).</td></tr>
            <tr><td>Lactate</td><td>> 3.0 mmol/L</td><td>Severe tissue perfusion deficit — sustained anaerobic metabolism despite Impella support.</td></tr>
            <tr><td>Historical Ees/Ea Match</td><td>Within 15% tolerance</td><td>If the current Ees/Ea matches a historical patient who required escalation, the current patient gets flagged — pattern-based risk assessment without a model.</td></tr>
        </tbody>
    </table>
    <p>Any triggered signal raises a global <code>escalationWarning</code> flag. The dashboard shows a red alert badge, and individual danger signals are listed with their current values in the patient detail view.</p>
</div>

<div class="card">
    <h4>3. Explainable Risk Drivers</h4>
    <p>The risk drivers are the platform's most important interpretability feature. For each of the three outcomes (survival, escalation, RV dysfunction), the platform identifies up to 3 specific clinical measurements that are contributing to the patient's risk. Each driver includes:</p>
    <ul>
        <li><strong>Feature</strong> — the variable name (e.g., <code>postLactate</code>)</li>
        <li><strong>Impact</strong> — a magnitude (positive = increases risk, negative = decreases risk)</li>
        <li><strong>Label</strong> — a human-readable explanation (e.g., "Sustained tissue perfusion deficit (Lactate)")</li>
        <li><strong>Value</strong> — the patient's current value for that metric</li>
    </ul>
    <p>These drivers use <strong>simple threshold rules</strong>, not the opaque ML model — meaning they are transparent, clinically verifiable, and understandable. The thresholds are derived from published clinical guidelines and validated in the mortality feature importance analysis. This is intentional: a clinician should never have to trust a "black box." The ML model provides the overall risk probability; the rule-based drivers explain <em>why</em> the patient might be at risk using familiar clinical thresholds.</p>
</div>

<div class="card">
    <h4>4. AI Clinical Summary (Gemini)</h4>
    <p>When configured with a <code>GEMINI_API_KEY</code>, the platform can generate a structured clinical handoff note using Google Gemini 1.5 Flash. The prompt includes all relevant patient data — demographics, pre/post hemodynamics, labs, device settings, risk scores, and weaning status — and instructs Gemini to produce a professional, highly-dense clinical memo. The model is explicitly instructed to use specific numbers, avoid speculative variables, and stay under 300 words with bullet-point formatting.</p>
    <p>The fallback template-based summary is equally structured and provides the same information — it is written as a professional clinical memo with sections for clinical recommendation, RV state, perfusion and end-organ status, and actionable management pathway. The fallback runs when no API key is set or when Gemini's API call fails, ensuring the feature is always available.</p>
</div>

<div class="card">
    <h4>5. "What-If" Treatment Simulator</h4>
    <p>The simulator allows clinicians to test "what happens if we adjust the flow by 0.5 L/min or lower the lactate with aggressive diuresis?" It accepts adjustments to Impella flow, performance level, VIS, lactate, RA, PAPI, and CPO — then recalculates risk scores, weaning status, escalation warnings, and risk drivers dynamically. The simulator re-runs the full ML prediction pipeline on the modified patient data, so the new risk scores reflect the full 185+ feature model, not a simple heuristic. This is a powerful tool for treatment planning — a clinician can test multiple weaning scenarios before actually reducing pump support at the bedside.</p>
</div>"""


# ──────────────────────────────────────────────────────────────────────
# Section 11 — Key Findings
# ──────────────────────────────────────────────────────────────────────

def section_11() -> str:
    return """
<p>This section summarizes the most important findings from the ML training, feature importance analysis, clustering, and effectiveness analysis.</p>

<h3>Model Performance Summary</h3>

<table>
    <thead><tr><th>Model</th><th>Target</th><th>Best Algorithm</th><th>CV AUC</th><th>Clinical Utility</th></tr></thead>
    <tbody>
        <tr><td>Survival</td><td>Hospital mortality</td><td>RandomForest</td><td>0.89</td><td>Clinically useful</td></tr>
        <tr><td>MCS Escalation</td><td>ECMO / LVAD / transplant / arrest</td><td>RandomForest</td><td>0.95</td><td>Clinically useful</td></tr>
        <tr><td>RV Dysfunction</td><td>Composite RV failure criteria</td><td>LogisticRegression</td><td>0.94</td><td>Clinically useful</td></tr>
        <tr><td>PV Loop Escalation</td><td>Escalation from PV loop features only</td><td>LogisticRegression</td><td>~0.85</td><td>Clinically useful (specialized)</td></tr>
    </tbody>
</table>

<h3>Top Mortality Predictors (Consensus Across 5 Methods)</h3>

<table>
    <thead><tr><th>Rank</th><th>Feature</th><th>Category</th><th>Consensus Score</th><th>Clinical Significance</th></tr></thead>
    <tbody>
        <tr><td>1</td><td>post_ast</td><td>Liver function</td><td>66.0%</td><td>Post-implant AST — hepatocyte injury from low cardiac output. Ranked #1 by 3/5 methods.</td></tr>
        <tr><td>2</td><td>post_lactate</td><td>Tissue perfusion</td><td>43.2%</td><td>Direct marker of tissue hypoperfusion and anaerobic metabolism.</td></tr>
        <tr><td>3</td><td>age</td><td>Demographics</td><td>43.0%</td><td>Chronological age — robust univariate predictor across all methods.</td></tr>
        <tr><td>4</td><td>post_hco3</td><td>Acid-base</td><td>42.0%</td><td>Bicarbonate reflects metabolic compensation in shock state.</td></tr>
        <tr><td>5</td><td>post_egfr</td><td>Renal function</td><td>39.5%</td><td>Post-implant eGFR — AKI in cardiogenic shock portends poor outcomes.</td></tr>
        <tr><td>6</td><td>post_alt</td><td>Liver function</td><td>39.4%</td><td>Parallels AST as hepatocyte injury marker.</td></tr>
        <tr><td>7</td><td>post_map</td><td>Hemodynamics</td><td>39.0%</td><td>Mean arterial pressure — adequacy of end-organ perfusion.</td></tr>
        <tr><td>8</td><td>vis_score</td><td>Vasopressor burden</td><td>38.9%</td><td>Vasoactive-Inotropic Score quantifies total vasopressor support.</td></tr>
        <tr><td>9</td><td>pre_hco3</td><td>Acid-base (baseline)</td><td>37.6%</td><td>Pre-implant bicarbonate — baseline metabolic reserve.</td></tr>
        <tr><td>10</td><td>ratio_ra</td><td>RV function trend</td><td>34.3%</td><td>Ratio of post/pre right atrial pressure — RV failure trajectory.</td></tr>
    </tbody>
</table>

<div class="info-box">
    <p><strong>Key insight:</strong> Hepatocyte injury (AST/ALT) dominates the mortality signal. Rising AST/ALT on Impella support may be the <strong>earliest warning signal</strong> of impending mortality — before traditional hemodynamic thresholds (RA, PAPI, CPO) cross their danger zones. This is clinically plausible: the liver is highly sensitive to both low forward flow (hypoxic hepatitis) and backward congestion (hepatic congestion from RV failure), making it an early indicator of both problems.</p>
</div>

<h3>Feature Reduction Analysis</h3>
<table>
    <thead><tr><th>Target</th><th>Full Model AUC</th><th>Best Subset AUC</th><th>Delta</th><th>Interpretation</th></tr></thead>
    <tbody>
        <tr><td>Survival</td><td>0.59</td><td>0.62 (top-10 features)</td><td>+0.03</td><td>Top-10 consensus features match full set — remaining features add noise</td></tr>
        <tr><td>Escalation</td><td>0.94</td><td>0.84 (top-50 features)</td><td>−0.10</td><td>Full feature set needed — escalation is a multi-system phenomenon</td></tr>
        <tr><td>RV Dysfunction</td><td>0.93</td><td>0.80 (top-50 features)</td><td>−0.13</td><td>Full feature set needed — RV dysfunction involves complex interactions</td></tr>
    </tbody>
</table>
<p><strong>Recommendation:</strong> Use a simplified 10-feature model for mortality screening, but maintain the full model for escalation and RV dysfunction prediction.</p>

<h3>Cluster Phenotype Summary</h3>
<table>
    <thead><tr><th>Cluster</th><th>N</th><th>Survival</th><th>Escalation</th><th>Renal Failure</th><th>Key Signature</th></tr></thead>
    <tbody>
        <tr><td>Non-congested (Low-risk)</td><td>27</td><td>70.4%</td><td>14.8%</td><td>7.4%</td><td>Younger (51), higher BMI (31.5), preserved eGFR (79.7), lactate 2.12, SCAI ~C</td></tr>
        <tr><td>Cardiorenal (Moderate-risk)</td><td>37</td><td>67.6%</td><td>20.0%</td><td>22.9%</td><td>Older (65), lower BMI (25.7), low eGFR (41.0), lactate 1.70, SCAI ~C</td></tr>
        <tr><td>Cardiometabolic (High-risk)</td><td>4</td><td>50.0%</td><td>0.0%</td><td>25.0%</td><td>Extreme ALT (1331), leukocytosis (WBC 18.0), very high lactate (3.38), SCAI ~D</td></tr>
    </tbody>
</table>

<div class="info-box warning">
    <p><strong>Important caveat:</strong> Survival differences between clusters are small (70.4% vs 67.6% — only 2.8 percentage points between Non-congested and Cardiorenal). The "Non-congested" cluster paradoxically has elevated lactate compared to "Cardiorenal" — a <strong>perfusion-stress signature</strong> that clustering identifies as a natural grouping but which does not correspond to better outcomes in the expected direction. This underscores that clustering discovers empirical groups, not guaranteed clinical truths.</p>
</div>

<h3>Clinical Recommendations</h3>
<ol>
    <li><strong>Bedside mortality screening:</strong> Monitor AST, lactate, HCO₃, eGFR, and age. A composite of these 5 features provides equivalent information to the full 185-feature model for survival prediction.</li>
    <li><strong>Escalation planning:</strong> Maintain the full feature model for escalation risk. The rich feature set captures the multi-organ dysfunction pattern that precedes clinical decompensation.</li>
    <li><strong>RV dysfunction monitoring:</strong> Prioritize post-implant PAPI, RA, and TAPSE alongside the delta features of PVR and PCWP. RV-PA uncoupling (rising PVR with falling PAPI) is the dominant RV failure pathway.</li>
    <li><strong>Data completeness:</strong> Post-implant labs (AST, lactate, HCO₃, eGFR) provide more signal than pre-implant values. Prioritize collecting 48-hour post-implant labs over expanding the pre-implant panel.</li>
    <li><strong>Use both models:</strong> The escalation and RV dysfunction models are strong enough to support clinical decision-making. The survival model is not — treat mortality risk scores as research-grade information only.</li>
</ol>"""


# ──────────────────────────────────────────────────────────────────────
# Section 12 — Limitations & Future Directions
# ──────────────────────────────────────────────────────────────────────

def section_12() -> str:
    return """
<p>Every analytical tool has limitations. This section documents what we know the platform cannot do, where the data is weak, and what directions would strengthen future versions.</p>

<div class="card">
    <h4>Data Limitations</h4>
    <ul>
        <li><strong>Sample size:</strong> 112–128 patients from a single institution. This is a small dataset for ML — feature importance rankings, cluster boundaries, and AUC estimates may all shift with larger cohorts. Models trained on 100 patients typically lose 5–15% AUC when applied to a new hospital's population.</li>
        <li><strong>Missing data:</strong> Echo and PV loop variables have 30–50% missingness. Median imputation may attenuate true clinical signals. The RV dysfunction target relies on echo data missing for ~40% of patients, potentially introducing bias.</li>
        <li><strong>Class imbalance:</strong> ~25% mortality rate. While handled via class_weight balancing, rare-but-important signals may still be missed.</li>
        <li><strong>Associational, not causal:</strong> All findings are statistical associations. Confounding by indication (sicker patients get more aggressive treatment) and unmeasured variables cannot be excluded.</li>
        <li><strong>Single-center:</strong> All data comes from one institution's Impella program. Practice patterns, patient demographics, and referral patterns may differ significantly at other centers.</li>
    </ul>
</div>

<div class="card">
    <h4>Model Limitations</h4>
    <ul>
        <li><strong>Survival model is clinically useful:</strong> AUC 0.89 after label correction, with 56% sensitivity and 88% specificity. However, use alongside clinical judgment as the model is not a substitute for clinical assessment.</li>
        <li><strong>No external validation:</strong> All models have only been internally cross-validated. External validation on an independent cohort from a different institution is the single most important next step before any clinical deployment.</li>
        <li><strong>Cluster stability:</strong> Silhouette score of 0.237 indicates moderate separation at best. Clusters overlap, and assignments can shift with new data. The cardiometabolic cluster has only 4 patients — too few for reliable profiling.</li>
        <li><strong>Ees/Ea matching:</strong> The knowledge base pattern-matching alert uses a 15% tolerance on Ees/Ea. This is a heuristic, not a statistically validated threshold.</li>
    </ul>
</div>

<div class="card">
    <h4>Future Directions</h4>
    <ol>
        <li><strong>Multi-center validation:</strong> The highest priority. Models should be tested on data from at least 2–3 other institutions before any clinical deployment.</li>
        <li><strong>Real-time inference:</strong> Currently batch-based (upload file → process → visualize). Real-time streaming from electronic health records (EHR) would allow continuous risk score updates as new labs and vitals become available.</li>
        <li><strong>Expanded feature space:</strong> Continuous hemodynamic waveforms (arterial line, pulmonary artery catheter) could provide richer features than discrete timepoints. PV loop features from real-time pressure-volume catheters would strengthen the V-A coupling analysis.</li>
        <li><strong>Longitudinal tracking:</strong> Current analysis is pre/post (two timepoints). A time-series model tracking daily hemodynamics over the full support period would capture dynamic trajectories more accurately.</li>
        <li><strong>Survival model improvement:</strong> Integrating non-hemodynamic variables (comorbidity indices, frailty scores, code status, laboratory trajectory velocities) may improve survival prediction beyond the current near-random AUC.</li>
        <li><strong>Threshold optimization:</strong> The current 0.5 decision threshold is arbitrary. Cost-sensitive threshold tuning — where false negatives (missing a high-risk patient) are weighted 5–10× more than false positives — would better match clinical reality.</li>
        <li><strong>Explainable AI dashboard:</strong> SHAP waterfall plots per patient (showing exactly which features drive the individual prediction) would enhance the risk driver feature. Currently, the risk drivers use rule-based thresholds rather than the actual ML model's SHAP values.</li>
        <li><strong>Patient-reported outcomes:</strong> Quality of life, functional capacity (6-minute walk test), and heart failure symptoms (NYHA class) after discharge would provide a more complete picture of recovery beyond survival.</li>
    </ol>
</div>

<div class="info-box danger">
    <p><strong>Bottom line:</strong> This platform is a <strong>research-grade decision support tool</strong>. The escalation and RV dysfunction models are strong enough to inform clinical thinking, but no model output should replace clinical judgment. The survival model should not be used for triage. External validation is essential before any clinical deployment. The platform's greatest value may be as an <strong>educational and exploratory tool</strong> — helping clinicians understand the multivariate drivers of outcomes in their Impella population, identify data quality gaps, and generate hypotheses for prospective studies.</p>
</div>"""


# ──────────────────────────────────────────────────────────────────────
# Assemble HTML
# ──────────────────────────────────────────────────────────────────────

def assemble_html() -> str:
    sections = [
        build_section("s1", "Executive Summary &amp; Project Overview", section_1(), first=True),
        build_section("s2", "Clinical Concepts — A Reference Glossary", section_2()),
        build_section("s3", "System Architecture", section_3()),
        build_section("s4", "Data Flow — End to End", section_4()),
        build_section("s5", "Pages &amp; Components", section_5()),
        build_section("s6", "API Endpoints", section_6()),
        build_section("s7", "ML Training Scripts", section_7()),
        build_section("s8", "ML Prediction at Runtime", section_8()),
        build_section("s9", "Machine Learning Methods — Explained", section_9()),
        build_section("s10", "Clinical Decision Support", section_10()),
        build_section("s11", "Key Findings &amp; Clinical Insights", section_11()),
        build_section("s12", "Limitations &amp; Future Directions", section_12()),
    ]

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Impella Analytics — Project Report</title>
<style>
{CSS}
</style>
</head>
<body>
<div class="container">
    {build_cover()}
    {build_toc()}
    {''.join(sections)}
    <div class="footer">
        <p>Impella Analytics — Project Documentation</p>
        <p>Generated {NOW} · For clinical research use only</p>
        <p style="margin-top:8px;font-size:11px;">React 19 + Express 4 + Vite 6 + Python 3 · scikit-learn · SHAP · weasyprint</p>
    </div>
</div>
</body>
</html>"""


# ──────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Impella Analytics — Project Report Generator")
    print("=" * 60)

    html_content = assemble_html()

    # Write HTML
    html_path = OUTPUT_DIR / "project_report.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    size_kb = html_path.stat().st_size / 1024
    print(f"\n  HTML: {html_path.resolve()} ({size_kb:.0f} KB)")

    # Generate PDF via weasyprint
    try:
        from weasyprint import HTML
        pdf_path = OUTPUT_DIR / "project_report.pdf"
        print("  Generating PDF via weasyprint...")
        HTML(string=html_content).write_pdf(target=pdf_path)
        pdf_size_kb = pdf_path.stat().st_size / 1024
        print(f"  PDF:  {pdf_path.resolve()} ({pdf_size_kb:.0f} KB)")
    except ImportError:
        print("\n  [SKIP] weasyprint not available. Install: pip install weasyprint")
        print("  HTML was generated successfully.")
    except Exception as e:
        print(f"\n  [ERROR] PDF generation failed: {e}")
        print("  HTML was generated successfully.")

    print(f"\n{'=' * 60}")
    print("Done.")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
