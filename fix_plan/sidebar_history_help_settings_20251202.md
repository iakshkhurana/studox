## Issue: History, Settings, Help not working in sidebar (2025-12-02)

### Context
- The sidebar (`AppSidebarLayout.tsx`) shows buttons for `History`, `Help`, and `Settings`.
- Router config in `App.tsx` only defines routes for `/`, `/auth`, `/pomodoro`, `/ai-tutor`, `/calendar`, `/datesheet`, `/subject/:id`, and a `*` catch-all.
- `History` sidebar item navigates to `/history`, which currently resolves to the `NotFound` page.
- `Help` and `Settings` sidebar items have no `onClick` handlers, so they do nothing.

### Root Cause
- Missing React Router routes and page components for `History`, `Help`, and `Settings`.
- Sidebar buttons for `Help` and `Settings` are not wired to navigation, so clicks have no effect even if routes were present.

### Plan
1. **Create basic page components** for:
   - `HistoryPage` to show a placeholder history view (later can surface past sessions, subjects, etc.).
   - `HelpPage` to show basic usage/help content.
   - `SettingsPage` for user/account/app settings placeholder.
2. **Register routes** in `App.tsx`:
   - Add `<Route path="/history" element={<HistoryPage />} />`
   - Add `<Route path="/help" element={<HelpPage />} />`
   - Add `<Route path="/settings" element={<SettingsPage />} />`
   - Ensure these are defined **above** the catch-all `*` route.
3. **Wire sidebar navigation**:
   - Update `Help` button to navigate to `/help` and use `isActive("/help")` for active state.
   - Update `Settings` button to navigate to `/settings` and use `isActive("/settings")` for active state.
4. **Keep UX consistent**:
   - Wrap new pages in `AppSidebarLayout` so they share the same layout as other main app pages.
5. **Verification**:
   - Click `History`, `Help`, and `Settings` in the sidebar and confirm:
     - URL updates to `/history`, `/help`, `/settings` respectively.
     - Corresponding page content renders instead of 404.
   - Confirm no console errors and navigation back to other routes works.


