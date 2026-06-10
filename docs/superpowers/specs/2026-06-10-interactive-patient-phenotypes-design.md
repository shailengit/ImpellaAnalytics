# Interactive Patient Phenotypes — Design Spec

**Date:** 2026-06-10
**Goal:** Replace static PNG chart images on the Patient Phenotypes page with
interactive Recharts components, improving user experience with hover tooltips,
clickable legends, and drill-down behavior — matching the interaction patterns
already established on the Dashboard and Effectiveness pages.

---

## Charts to Replace

### 1. Outcome Rates → Grouped Bar Chart

**Current:** Static PNG image `outcome_rates.png`.
**Replacement:** Recharts `BarChart` with grouped bars per cluster.

**Data source:** `cluster_profiles.json` — each profile has `survival_rate`,
`escalation_rate`, `renal_rate`.

**Interaction:**
- Hover tooltip showing cluster name, outcome type, and rate value.
- Clickable legend to toggle visibility of each outcome metric.
- Bars colored by outcome type (green = survival, orange = escalation, red = renal
  failure), not by cluster.
- X-axis: cluster names.

### 2. Cluster Feature Profiles → Horizontal Bar Chart

**Current:** Static PNG heatmap `cluster_profiles_heatmap.png`.
**Replacement:** Recharts `BarChart` in horizontal layout showing the top mean
features for the **currently selected cluster**.

**Data source:** `mean_features` from `cluster_profiles.json` for the selected
cluster (already tracked via `selectedCluster` state).

**Interaction:**
- Hover tooltip showing feature name and mean value.
- Automatically updates when a different cluster is selected via the summary
  cards above.
- Bars colored by the selected cluster's theme color.
- Shows top N features (N=10) sorted by value descending.
- Includes horizontal scrollbar if many features.

### 3. SCAI Stage Distribution → Stacked or Grouped Bar Chart

**Current:** Simple stat cards showing raw counts per stage.
**Replacement:** Recharts `BarChart` integrated into the selected-cluster detail
panel — showing SCAI stage distribution as bars.

**Data source:** `scai_distribution` per profile.

**Interaction:**
- Hover tooltip showing SCAI stage label (B, C, D, E) and patient count.
- Bars colored by SCAI stage severity (light → dark gradient).

### 4. PCA Scatter → Interactive ScatterChart

**Current:** Static PNG image `pca_scatter.png`.
**Replacement:** Recharts `ScatterChart` with one dot per patient, colored by
cluster assignment.

**Data source:** PCA coordinates (PC1, PC2) exported from the clustering pipeline
and served via a new server endpoint or appended to the cluster-profiles response.

**Server change needed:** The Python `clustering_pipeline.py` calls
`PCA.fit_transform()` to generate coordinates but does not save them. A new JSON
export function will be added to save `pca_coordinates.json` with structure:
```json
[
  { "mrn": "JH...", "pc1": -2.34, "pc2": 1.21, "cluster": 0 }
]
```
The server endpoint `/api/cluster-profiles` will serve this data alongside
profiles and quality metrics.

**Interaction:**
- Hover tooltip showing MRN, cluster name, PC1 and PC2 values.
- Dots colored by cluster (green/amber/red theme).
- Dot size uniform (no ZAxis needed — this is about separation, not magnitude).
- Users can hover to identify individual patients.

---

## Charts to Keep as Static Images

These are kept as-is because they require specialized visualizations (hierarchical
clustering, pairwise matrices, per-patient silhouette values) that would require
significant algorithmic porting to Recharts with limited interaction benefit:

- **Hierarchical Dendrogram** (`dendrogram.png`)
- **Consensus Matrix** (`consensus_matrix.png`)
- **Silhouette Analysis** (`silhouette.png`)

---

## Tooltip Design

All new tooltips will follow the same pattern established in the Dashboard and
Effectiveness fixes:

- Background: dark card (`bg-dark-card`, ~`#14171D`)
- Border: subtle dark (`border-dark-border`, ~`#2D3748`)
- Labels: muted gray (`text-dark-text-muted`, ~`#718096`)
- Values: light text (`text-dark-text-primary`, ~`#E2E8F0`)
- Positive/good metrics: emerald green (`text-emerald-400`)
- Negative/bad metrics: red/orange
- Badge-style indicators where appropriate (e.g., cluster name, outcome label)

---

## File Changes

| File | Type | Change |
|------|------|--------|
| `scripts/clustering_pipeline.py` | Modify | Add `export_pca_coordinates()` and call it from the main pipeline after PCA transform. Save `pca_coordinates.json` to `ml_output/clusters/`. |
| `server.ts` | Modify | Add PCA coordinates JSON loading to `/api/cluster-profiles` response. |
| `src/components/ClusteringPage.tsx` | Modify | Replace 3 static `<img>` tags with Recharts components: Outcome Rates (grouped bar), Feature Profiles (horizontal bar, selected-cluster aware), PCA Scatter (ScatterChart). |
| `src/types.ts` | Modify | Add TypeScript interfaces for PCA coordinate data and enriched cluster response types. |

---

## Data Flow

```
clustering_pipeline.py
  └─ PCA.fit_transform(X) → X_2d
  └─ export_pca_coordinates(mrns, X_2d, labels) → pca_coordinates.json
  └─ export_profiles(profiles) → cluster_profiles.json (unchanged)

server.ts /api/cluster-profiles
  ├─ loads cluster_profiles.json (unchanged)
  ├─ loads quality_metrics.json (unchanged)
  └─ loads pca_coordinates.json (NEW)
  └─ returns { profiles, quality, pcaCoordinates }

ClusteringPage.tsx
  ├─ Profiles → outcome rates bar chart, feature profiles bar chart
  ├─ pcaCoordinates → PCA scatter chart
  └─ selectedCluster state → drives feature profile bars + SCAI chart
```

---

## Success Criteria

1. All 4 replaced charts are fully interactive — hover tooltips show relevant data
   with proper light-on-dark text colors.
2. PCA scatter shows 68+ patient dots colored by cluster, matching the
   Python-generated PNG layout.
3. Outcome rates grouped bar has clickable legend to toggle metrics.
4. Feature profile bars update when user clicks a different cluster card.
5. SCAI stage distribution is shown as bars instead of plain stat cards.
6. TypeScript compiles cleanly (`tsc --noEmit`).
7. Existing static images remain in place for the 3 unreplaced charts.

---

## Non-Goals

- Do NOT port dendrogram, consensus matrix, or silhouette analysis to Recharts.
- Do NOT change the clustering algorithm or retrain models.
- Do NOT change the cluster selection mechanism (cards at top of page).
- Do NOT modify the data analysis Python pipeline beyond adding PCA coordinate
  export.