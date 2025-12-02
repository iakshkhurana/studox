## Feature: Stopwatch, study tracker, calendar planner, and DSA daily log

### Context and current state
- The app already has:
  - A **Pomodoro timer** that records `study_sessions` in Supabase for focus/break time.
  - A **Dashboard** summarizing study statistics using `study_sessions`.
  - A **sidebar layout** and **Subject pages** with exam datesheets (via `exams`).
- There is **no generic stopwatch**, **no calendar overview** of study activity or exams, and **no structured DSA-specific tracking**.

### Requirements (from user)
- Add a **stopwatch** alongside the existing Pomodoro timer.
- Provide a **tracker of how much you have studied** (time-based, not just sessions).
- Add a **calendar planner** that:
  - Shows what work was done on each day.
  - Shows on which day a given paper/exam is scheduled.
- Add a **DSA section** where each day the user can log “what DSA I did today” with a clean UI card/dialog.

### Design decisions
- **Stopwatch**
  - Implement as a sibling component to `PomodoroTimer` on `PomodoroPage`.
  - Stopwatch records arbitrary durations (start/pause/reset) and writes to a new Supabase table `time_entries` with fields:
    - `id`, `user_id`, `type` (`"stopwatch"`), `started_at`, `ended_at`, `duration_seconds`, `notes`, `created_at`.
  - This keeps Pomodoro logic focused while still allowing aggregation of both Pomodoro and stopwatch data in stats.

- **Study time tracker**
  - On **Dashboard**, compute “Total study time” using **both**:
    - `study_sessions.duration_minutes` (Pomodoro) and
    - `time_entries.duration_seconds` (stopwatch), filtered by `user_id`.
  - In later steps, we can add per-day breakdowns by grouping on `started_at::date`.

- **Calendar planner**
  - Add a new route/page `CalendarPage` that uses the existing `ui/calendar` and `AppSidebarLayout`.
  - Data sources:
    - `study_sessions` (Pomodoro) and `time_entries` (stopwatch) → highlight “studied on this day” and show total minutes.
    - `exams` (existing `exam_date`) → mark upcoming exams and show title/type on that date.
    - `dsa_logs` (see below) → show that DSA work was done and provide a short summary.
  - Clicking a date opens a side panel/card listing:
    - Study entries (Pomodoro + stopwatch) with durations.
    - Any exams on that date.
    - Any DSA logs for that date.

- **DSA daily log**
  - Introduce a `dsa_logs` table in Supabase:
    - `id`, `user_id`, `log_date` (date), `title`, `details`, `created_at`, `updated_at`.
  - On Dashboard, add a **“DSA Today”** card:
    - Button opens a dialog with fields: “What did you do today?”, optional details.
    - Saves or updates the log for **today** in `dsa_logs` and shows a small “Today’s DSA” preview.
  - On the calendar page, DSA logs appear per date.

### Implementation plan
1. **Database**
   - Add a new migration to create `public.time_entries` and `public.dsa_logs` with RLS policies `auth.uid() = user_id` and `update_updated_at_column` triggers.
   - Update `src/integrations/supabase/types.ts` to include both tables with `Row/Insert/Update` types.

2. **Stopwatch component**
   - Create `components/Pomodoro/StopwatchTimer.tsx`:
     - UI: big time display (HH:MM:SS), Start/Pause/Reset buttons, optional note input.
     - Logic:
       - Tracks `elapsedSeconds`, `isActive`, and a `currentEntryId`.
       - On start: insert a `time_entries` row (`type = "stopwatch"`, `started_at` now).
       - On pause/stop: update the row with `ended_at` and `duration_seconds`.
   - Update `PomodoroPage` to show **tabs** or a segmented control: “Pomodoro” and “Stopwatch”, using the existing card styling.

3. **Study tracker enhancements (Dashboard)**
   - Extend `loadStats` to:
     - Query `time_entries` for the current user and sum `duration_seconds` (convert to minutes).
     - Add that to `stats.studyTime` so it reflects both Pomodoro and stopwatch usage.
   - Optionally expose a new stat card “Stopwatch Time” later if differentiation is needed.

4. **Calendar planner page**
   - Create a new page `CalendarPage.tsx` with route `/calendar`:
     - Wrap with `AppSidebarLayout` so it appears in the main navigation.
     - Use the existing `ui/calendar` component in single-date mode.
     - On mount, load:
       - Study sessions (focus/break) with `started_at` and `duration_minutes`.
       - Stopwatch `time_entries` with `started_at` and `duration_seconds`.
       - Exams from `exams` with `exam_date`.
       - DSA logs from `dsa_logs` with `log_date`.
     - Compute per-day aggregates and pass them into the calendar to:
       - Highlight days with study activity and/or exams/DSA logs.
       - Show a side panel/card for the selected date with structured lists: “Study”, “Exams”, “DSA”.

5. **DSA Today section**
   - Add a `DSATodayCard` component on the Dashboard:
     - Shows today’s log if it exists; otherwise, a call-to-action button to “Log DSA for Today”.
     - Clicking opens a dialog with title + details; saving upserts into `dsa_logs` for `log_date = current_date`.
   - Hook into the calendar page by querying the same `dsa_logs` table.

6. **Routing and navigation**
   - Add a **Calendar** entry in the sidebar menu linking to `/calendar`.
   - Ensure all new components are commented with JSDoc-style comments; keep existing structure intact.

### Notes and constraints
- Winston logging is part of your backend logging standard; this project is a purely frontend + Supabase client app, so we rely on:
  - Supabase as the persistence/log of activity.
  - Toasts and, when necessary, `console.error` for debugging.
- All new UI pieces will follow the existing shadcn + Tailwind aesthetic to stay consistent with your current UX.


