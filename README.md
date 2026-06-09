<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Impella Analytics

Clinical analytics dashboard for Impella hemodynamic recovery data, with integrated machine-learning risk stratification.

View your app in AI Studio: https://ai.studio/apps/f8b3babe-4347-4bbb-b2c1-1a99e3b1bd31

## Run Locally

**Prerequisites:** Node.js, Python 3

1. Install Node dependencies:
   `npm install`
2. Install Python dependencies:
   `pip install pandas scikit-learn joblib openpyxl matplotlib seaborn`
3. Train ML models (one-time):
   `python ml_pipeline.py`
4. Install Ollama and pull deepseek-v4-flash for AI clinical summaries:
   `ollama pull deepseek-v4-flash:cloud`
5. Set `PYTHON_PATH` to your Python executable (the one with the installed packages):
   `export PYTHON_PATH=/usr/bin/python3`
6. Run the app:
   `npm run dev`

The server runs on port 3001 by default.

## ML Pipeline

- **Survival Prediction** — RandomForest (AUC 0.89, clinically useful)
- **MCS Escalation Prediction** — RandomForest (AUC 0.95)
- **RV Dysfunction Prediction** — Logistic Regression (AUC 0.94)

- **Patient Phenotypes (Clustering)** — Consensus K-Means (k=3, 10 features, PCA-5, silhouette 0.237). See the *Phenotypes* page in the dashboard.

See [MODEL.md](MODEL.md) for detailed model documentation and clinical interpretation guidance.

## Commands

- `npm run dev` — Start the dev server (Express + Vite)
- `npm run build` — Build for production
- `npm start` — Run production server
- `npm run lint` — Type-check with tsc
- `python ml_pipeline.py` — Re-train ML models on the Excel data
- `python clustering_pipeline.py` — Re-run patient phenotype clustering
