## Feature: Add scrollable subjects list to prevent overflow (2025-12-02)

### Context
- On the Dashboard, the "Projects & subjects" column renders a vertical list of subject cards inside a single `Card`.
- When there are many subjects, the cards can grow tall and visually overflow the intended box area, pushing other content down.
- The user wants the list to stay inside the box and become scrollable instead of stretching the layout.

### Reasoning
- Constraining the subject list height and enabling vertical scrolling keeps the dashboard layout stable.
- This matches the mental model of a "panel" with its own scroll, while the rest of the page remains visible.

### Plan
1. Wrap the mapped `SubjectCard` list in a `div` with:
   - A reasonable `max-height` (e.g., `max-h-80`) tuned for desktop breakpoints.
   - `overflow-y-auto` to allow vertical scrolling when the number of subjects exceeds the visible space.
2. Keep the empty-state text and header outside the scrollable region so they remain fixed.
3. Verify that:
   - With few subjects, there is no visible scrollbar and the layout looks unchanged.
   - With many subjects, the panel shows a scrollbar but the overall card and dashboard remain compact.


