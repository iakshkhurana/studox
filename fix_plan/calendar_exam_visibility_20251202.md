## Bug: Exams not visible on selected calendar day (2025-12-02)

### Context
- Exams are created on the `DatesheetPage` and stored in Supabase with an `exam_date` column (`TIMESTAMPTZ`).
- The `CalendarPage` groups exams by day using `exam.exam_date.slice(0, 10)` and looks them up via a `selectedKey` derived from `selectedDate.toISOString().slice(0, 10)`.
- The UI shows the correct selected date (e.g., "Saturday, Dec 20, 2025") but the "Exams on this day" panel reports "No exams scheduled on this day" even after adding an exam for that date.

### Root Cause
- The calendar uses `toISOString()` for the selected date and relies on string-slicing the raw `exam_date` from Supabase.
- Because `toISOString()` always uses UTC, users in non-UTC time zones can end up with off‑by‑one day differences between the **local date** they select and the **UTC-normalized string**.
- This can cause the `selectedKey` (derived from `selectedDate.toISOString()`) to differ from the key computed from `exam.exam_date.slice(0,10)`, so exams are grouped under a different day key than the one used for lookup.

### Plan
1. Introduce a small utility in `CalendarPage` to normalize any `Date` or ISO string into a **local date key** of the form `YYYY-MM-DD` using `getFullYear()`, `getMonth() + 1`, and `getDate()` instead of `toISOString()` or `slice(0, 10)`.
2. Use this helper when:
   - Building `studyMap` from `study_sessions.started_at`.
   - Building `examsMap` from `exams.exam_date`.
   - Computing `selectedKey` from the `selectedDate` chosen in the calendar UI.
3. Keep all other behavior the same so the UI only changes by correctly showing exams on the intended local day.
4. Verify:
   - Adding an exam on a given date via the datesheet makes it appear under "Exams on this day" when selecting that same date in `CalendarPage`.
   - No regressions for existing study session aggregation.


