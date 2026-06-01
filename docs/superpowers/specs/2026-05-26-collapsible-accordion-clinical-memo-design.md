# Collapsible Accordion for Clinical Huddle Memo — LLM-Powered Template Cards

## Context

The Clinical Huddle Memo renders 4 colored cards (Clinical Impression, Hemodynamic Spotlight, Risk Assessment, Management Plan) with full LLM-generated text in each section. When LLM mode is ON, each section contains several sentences of detailed clinical judgment, making the total panel height very long and requiring excessive scrolling.

The goal is to collapse the 4 sections into an accordion: headings are always visible, body text is revealed on click. Only one section open at a time. First section expanded by default.

## Design

### Interaction Model
- Accordion (single open): clicking a heading expands that section and auto-collapses any other open section
- Clicking the already-open heading collapses it (all sections closed state allowed)
- Chevron indicator: `▶` when collapsed (right-pointing), `▼` when expanded (down-pointing)
- Entire heading row is the click target
- Smooth CSS transition on expand/collapse

### Default State
- Index 0 (Clinical Impression) expanded on first render
- All other sections collapsed
- No "Expand All" / "Collapse All" control (unnecessary for 4 sections)

### Visual Treatment
- Existing colors, gradients, accent bars preserved unchanged
- Heading row always fully visible with section color treatment
- Body text: `text-[11px] font-mono text-slate-100` (unchanged)
- Chevron color matches section accent color
- Dividers between sections retained

### Template Mode (LLM OFF)
- Same accordion behavior for UX consistency
- First section expanded by default

## Implementation

### State
```typescript
const [openSection, setOpenSection] = useState<number>(0); // 0-3, or -1 for none
```

### Click Handler
```typescript
const toggleSection = (idx: number) => {
  setOpenSection(prev => prev === idx ? -1 : idx);
};
```

### Rendering Pattern (per section)
```
heading row (always visible, onClick={toggleSection})
  └─ section title + chevron (▶/▼)
body (conditionally rendered when openSection === idx)
  └─ gradient bg, accent bar, body text
```

### Animation
Use `grid-rows-[0fr]` / `grid-rows-[1fr]` on a grid wrapper with `overflow-hidden` and `transition-all duration-300` for smooth auto-height animation. This avoids fixed max-h values.

Alternatively, simpler approach: wrap body in a div with `overflow-hidden transition-all duration-300` and toggle between `max-h-0` (with a generous max like `max-h-96`) and `max-h-0 opacity-0` vs the content height.

## File Modified

- `src/components/ActivePatientMonitor.tsx` — Add accordion state, click handler, conditional body rendering
