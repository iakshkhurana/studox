## Feature: Replace Study stats on home with an inline calendar (2025-12-02)

### Context
- The Dashboard page currently shows a "Study stats" section with four statistic cards
  (total subjects, topics, revisions, and study time) plus a textual daily summary.
- The user wants the home/dashboard view to surface a calendar instead of these stats,
  while the dedicated `CalendarPage` already provides a richer calendar experience.

### Reasoning
- Replacing the stats column with a calendar will make the home page visually consistent
  with the rest of the app and give an at-a-glance view of dates from the entry screen.
- We can reuse the shared `Calendar` UI component for a lightweight, read-only calendar
  on the dashboard without duplicating the full logic of `CalendarPage`.

### Plan
1. Import the shared `Calendar` component into `Dashboard.tsx`.
2. In the three-column layout section:
   - Keep the "Projects & subjects" column as-is.
   - Replace the entire "Study stats" column with a new "Calendar" column that renders
     the `Calendar` component in a simple `Card`.
   - Keep the "Daily summary" column for now so it can still use the existing `stats`.
3. Configure the dashboard calendar to:
   - Show the current month only (no extra data binding yet).
   - Remain non-interactive beyond date selection, serving mainly as a quick visual overview.
4. Verify that:
   - The layout remains responsive on mobile and desktop breakpoints.
   - No TypeScript or runtime errors occur after adding the `Calendar` import and JSX.


