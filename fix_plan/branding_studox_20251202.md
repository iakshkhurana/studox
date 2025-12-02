## Issue: Rename StudyFlow to studox and update logo usage (2025-12-02)

### Context
- Current branding text `StudyFlow` appears in:
  - Sidebar header in `AppSidebarLayout.tsx`.
  - Auth page hero title in `Auth.tsx`.
  - Document title and author meta in `index.html`.
- The sidebar currently uses an icon-only avatar using `BookOpen` instead of the provided `public/logo.jpg` asset.
- The favicon is the default `favicon.ico` and does not explicitly use `logo.jpg` as requested.

### Root Cause
- Initial project scaffolding hard-coded the name `StudyFlow` and generic icon/branding.
- No centralized branding configuration exists, so multiple components embed the old name and visual icon directly.

### Plan
1. **Update textual branding**:
   - Replace all visible `StudyFlow` strings with `studox` (respecting casing) in `AppSidebarLayout.tsx`, `Auth.tsx`, and `index.html`.
2. **Use `logo.jpg` in the sidebar**:
   - Swap the gradient `BookOpen` avatar in the sidebar header with an `<img src="/logo.jpg" />` element.
   - Ensure the image is sized and rounded to keep the layout visually balanced.
3. **Use `logo.jpg` on Auth (sign-in/sign-up)**:
   - Replace or augment the `GraduationCap` icon container with an `<img src="/logo.jpg" />` so the auth hero uses the same branding asset.
4. **Hook `logo.jpg` into favicon/document head**:
   - Add a `<link rel="icon" href="/logo.jpg" />` (and optionally `type="image/jpeg"`) in `index.html` so the browser uses `logo.jpg` as the favicon, leaving the existing `favicon.ico` in place as a fallback if desired.
   - Update `<title>` and `<meta name="author">` to use `studox`.
5. **Verification**:
   - Run the app and confirm that:
     - Sidebar shows the new `studox` wordmark next to the `logo.jpg` image.
     - Auth page hero shows `studox` and uses `logo.jpg` instead of the old icon.
     - Browser tab title and favicon reflect the new branding (may need a hard refresh to clear cached favicons).


