# Structured Clinical Huddle Memo — LLM-Powered Template Cards

## Context

The Clinical Huddle Memo currently renders the LLM's free-form text output as raw pre-wrapped text in a scrollable box. Users report the output is verbose and hard to scan for a busy cardiologist. The LLM also lacks a consistent persona, producing variable-quality output.

The goal is to replace the raw-text display with a structured 4-section card layout where the LLM writes concise clinical *judgment* (not number regurgitation) into fixed, color-coded sections.

## Design

### Card Layout (4 fixed sections)

Each section is a colored card with a left accent bar, rendered in the existing 4-column right panel of `ActivePatientMonitor.tsx`:

| Section | Color | LLM's Job |
|---------|-------|-----------|
| Clinical Impression | Purple (#a78bfa) | Synthesize the patient's overall picture — what's happening hemodynamically |
| Hemodynamic Spotlight | Green (#34d399) | Call out the trends that matter most right now, not all numbers |
| Risk Assessment | Amber (#fbbf24) | Interpret ML risk scores in clinical context — what's actually worth worrying about |
| Management Plan | Blue (#60a5fa) | Specific, actionable next steps |

### Contrast & Readability (Dark Theme)

- Body text: `#f1f5f9` at 13px, 1.6 line-height
- Section headers: saturated color at 10px semibold, uppercase, 0.15em letter-spacing
- Accent bars: 4px wide left border
- Background gradients: `linear-gradient(135deg, rgba(color, 0.1), rgba(0,0,0,0.2))`
- Section dividers: subtle `#334155` borders

### LLM Prompt (System Prompt)

The LLM is instructed to:

1. Act as an experienced cardiologist on the Shock Team
2. Output exactly 4 labeled sections: `CLINICAL IMPRESSION:`, `HEMODYNAMIC SPOTLIGHT:`, `RISK ASSESSMENT:`, `MANAGEMENT PLAN:`
3. Write clinical *judgment* — what the numbers *mean* and what *to do* — not list the numbers (they're already in the charts)
4. Be concise: 1-3 sentences per section
5. If data is insufficient for a section, state "Insufficient data" rather than invent

### API Contract

`POST /api/generate-summary` returns a structured object instead of a plain string:

```json
{
  "patientId": "abc",
  "summary": {
    "impression": "Weaning candidate...",
    "hemodynamics": "All four pillar metrics improving...",
    "risk": "Survival: Low Risk...",
    "management": "1. Reduce Impella 0.5L q2h..."
  },
  "usedLLM": true
}
```

### Server Changes (`server.ts`)

- `generateClinicalSummary()` returns `{ impression, hemodynamics, risk, management }` instead of a plain string
- The LLM prompt includes explicit output format instructions
- Server parses the LLM response with a regex: `/CLINICAL IMPRESSION:\s*(.*?)\s*HEMODYNAMIC SPOTLIGHT:\s*(.*?)\s*RISK ASSESSMENT:\s*(.*?)\s*MANAGEMENT PLAN:\s*(.*?)$/is` — the LLM prompt enforces this exact label format, so the regex is reliable within normal LLM output variability
- If parsing fails, the server wraps the raw LLM text into `{ impression: raw, hemodynamics: "", risk: "", management: "" }` so the raw output is still visible in the first card
- `getFallbackSummary()` also returns the same structured object with deterministic content per section
- Ollama fallback returns the same structured format

### Frontend Changes (`ActivePatientMonitor.tsx`)

- `aiMemo` state changes from `string` to `{ impression: string; hemodynamics: string; risk: string; management: string } | null`
- Loading/error states unchanged
- The render block replaces the single `whitespace-pre-wrap div` with 4 colored cards
- Template mode header reads "Clinical Huddle Memo (Template)" with muted styling
- LLM mode header reads "Clinical Huddle Memo (LLM)" with purple styling

### Template Content (No LLM)

The deterministic template fills each section using existing patient data:

- **Clinical Impression**: Based on weaning status + escalation alerts + recovery score
- **Hemodynamic Spotlight**: Key delta values (ΔCPO, ΔPAPI, ΔRA, ΔLactate) with pass/fail indicators
- **Risk Assessment**: ML risk score interpretation with clinical context from checklist results
- **Management Plan**: Conditionally generated from weaning readiness and escalation warnings

### Template Fallback (Both LLMs Down)

Same structure as template mode, with a section-level note: "LLM unavailable — template fallback"

## Files Modified

- `server.ts` — Rewrite `generateClinicalSummary()` and `getFallbackSummary()` to return structured objects; update LLM system prompt; add output parsing
- `src/components/ActivePatientMonitor.tsx` — Replace raw-text rendering with 4 colored cards; change `aiMemo` state from `string` to structured object type; add card CSS classes

## Verification

1. Start dev server, load sample data, open a patient
2. AI OFF: verify 4 template cards render with deterministic content
3. AI ON (Ollama/deepseek-v4-flash): verify 4 LLM-filled cards render with clinical judgment text
4. Verify card colors match: purple, green, amber, blue
5. Verify text is readable at 13px on dark background
6. Toggle AI ON/OFF — verify seamless transition between LLM and template
7. Kill both API keys — verify template fallback renders same 4-card structure
