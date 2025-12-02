## Feature: Exam datesheet, PPT upload, and exam tagging

### Context and current state
- The app is a React + Supabase study tracker with core entities: `subjects`, `topics`, `study_sessions`, `notes`, and `papers`.
- There is currently **no dedicated exam entity**; only generic notes and previous year `papers`.
- Supabase is already configured with **private storage buckets** `notes` and `papers`, and RLS policies scoped by `auth.uid()`.
- `SubjectPage` is the logical place to attach exam-related information because it already drives topic-level organization for a subject.

### Problem / requirement
- Add **exam functionality** with a **datesheet** per subject.
- Support **uploading a PPT file** for each exam into Supabase Storage.
- Allow tagging each exam with:
  - A primary **exam type** (e.g., EST, MST, or any string).
  - Additional **free-form tags** (e.g., "midterm", "viva", "lab").

### Design decisions
- Introduce a dedicated `exams` table in the Supabase `public` schema:
  - `id`, `user_id`, `subject_id`, `title`, `exam_date`, `exam_type`, `tags[]`, `ppt_url`, `ppt_name`, `ppt_size`, `created_at`, `updated_at`.
  - Enforce ownership with RLS and a `"Users can manage their own exams"` policy, consistent with existing tables.
  - Reuse the existing `update_updated_at_column` trigger function for automatic timestamp updates.
- Add a new **private storage bucket** `exams` for exam PPTs:
  - Access controlled by `auth.uid()` in the object path, mirroring `notes` and `papers` policies.
  - Store files under a hierarchical path: `userId/subjectId/examId/<original-file-name>`.
- Extend the generated Supabase `Database` types locally to include the new `exams` table so TypeScript can type-check new queries.

### Implementation plan
1. **Database migration**
   - Create a new SQL migration that:
     - Defines the `public.exams` table with the fields listed above.
     - Enables RLS and adds a `"Users can manage their own exams"` policy using `auth.uid() = user_id`.
     - Adds a trigger to keep `updated_at` in sync via `update_updated_at_column`.
     - Creates an `exams` storage bucket and associated INSERT/SELECT/DELETE policies bound to `auth.uid()` and bucket `exams`.

2. **Supabase TypeScript types**
   - Update `src/integrations/supabase/types.ts` to add the `exams` table to `public.Tables`:
     - Define `Row`, `Insert`, and `Update` shapes that match the new migration.
     - Ensure `tags` is represented as `string[] | null`.

3. **Frontend state and data loading (SubjectPage)**
   - Add a local `Exam` interface matching the `exams` table.
   - Extend `SubjectPage` to:
     - Load exams for the current `subject_id` and current `user_id`.
     - Maintain loading/error state alongside existing topic loading.
   - Render a new **"Exams / Datesheet"** section on `SubjectPage`:
     - If no exams exist, show an empty-state card with a call-to-action.
     - Otherwise, list exams with core info (title, date, type, tags) and a link/button to view/download PPT if available.

4. **Create exam dialog + PPT upload**
   - Add a dialog on `SubjectPage` to create a new exam with fields:
     - Title
     - Exam date and time (using a date-time input)
     - Exam type selection with quick presets (EST, MST, Other) and free-text support.
     - Optional free-form tags (comma-separated, normalized into a string array).
     - Optional PPT file upload (`.ppt`, `.pptx`).
   - On submit:
     - Insert a provisional exam row (without `ppt_*` fields) to obtain an `exam.id`.
     - If a PPT is provided, upload it to the `exams` bucket with a scoped path and update the exam row with `ppt_url`, `ppt_name`, and `ppt_size`.
     - Reload the exams list and display a toast on success or error.

5. **Exam management operations**
   - Add ability to **delete an exam** from the UI:
     - Delete the exam row from `public.exams`.
     - Optionally attempt to delete the associated PPT from storage if a file exists (best-effort; ignore not-found errors).

6. **Comments and logging**
   - Add JSDoc-style comments to the new React logic, focusing on:
     - Why exams are keyed by subject and user.
     - Why the upload flow inserts the exam first, then uploads the file.
   - Since this is a purely frontend+Supabase app with no Node backend, Winston logging is not integrated; rely on existing toast notifications and `console.error` where strictly necessary.

### Risks and considerations
- The Supabase types file is marked as auto-generated; editing it by hand is necessary here to keep TypeScript happy but should be regenerated in a real pipeline after the migration is applied.
- Storage policies assume filenames are prefixed with `auth.uid()` as the top-level folder; the upload code must follow this convention exactly.
- Timezones for `exam_date` are stored as `TIMESTAMPTZ`; ensure the UI consistently uses local time for display and `toISOString()` for persistence.


