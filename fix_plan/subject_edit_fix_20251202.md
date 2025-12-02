## Fix: Subject edit not working on dashboard

### Observed behavior
- On the `Dashboard` page, each subject card renders an `Edit` option in the dropdown.
- Clicking **Edit** does nothing; no dialog opens and the subject cannot be modified.

### Root cause analysis
- `SubjectCard` exposes an `onEdit` callback and correctly wires it to the dropdown item.
- In `Dashboard`, the `SubjectCard` is instantiated with `onEdit={() => {}}`, i.e. a no-op function, so the edit action is effectively disabled.
- The `CreateSubjectDialog` component already supports:
  - `initialData` for pre-filling fields.
  - An `isEdit` flag to change copy and behavior.
- However, `CreateSubjectDialog` initializes its local state (`name`, `description`, `color`) only once from `initialData` and never updates it when `initialData` or `open` changes, which would cause incorrect values when switching between different subjects in edit mode.

### Plan
1. **Wire up subject editing from the dashboard:**
   - Add `editingSubject` state and an `editDialogOpen` boolean in `Dashboard`.
   - Implement `handleEditSubject(subject)` to:
     - Set `editingSubject` to the clicked subject.
     - Open the edit dialog.
   - Implement `handleUpdateSubject(data)` to:
     - Update the corresponding row in `public.subjects` via Supabase with the new `name`, `description`, and `color`.
     - Reload subjects and stats, close the edit dialog, and show a success toast.
   - Pass `onEdit={() => handleEditSubject(subject)}` into `SubjectCard` and mount a second `CreateSubjectDialog` configured for edit mode (`isEdit`, `initialData`).

2. **Make `CreateSubjectDialog` reactive to incoming initial data:**
   - Add a `useEffect` hook to sync `name`, `description`, and `color` whenever `initialData` or `open` changes.
   - Preserve the existing behavior of clearing fields only when creating a new subject, not on edit.

3. **Documentation and comments:**
   - Add brief JSDoc-style comments to the new handlers in `Dashboard` to explain:
     - Why we reuse the same dialog for create vs edit.
     - Why we refresh stats after updating a subject.


