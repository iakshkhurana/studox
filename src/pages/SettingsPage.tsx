import { AppSidebarLayout } from "@/components/AppSidebarLayout";

/**
 * Placeholder settings page for user and application preferences.
 *
 * This is wired to the `/settings` route and the `Settings` sidebar entry.
 * As settings features are added (theme, notifications, profile tweaks, etc.),
 * they can be surfaced here behind a consistent layout.
 */
const SettingsPage = () => {
  return (
    <AppSidebarLayout>
      <main className="mx-auto max-w-4xl px-6 py-8 space-y-4">
        <header>
          <h1 className="text-2xl font-display font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your studox experience. Additional options will appear here as
            new features are introduced.
          </p>
        </header>
        <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          {/* Placeholder content while real settings are designed */}
          There are no configurable settings yet. When preferences such as theme,
          notification frequency, or account options are implemented, they will be
          managed from this page.
        </section>
      </main>
    </AppSidebarLayout>
  );
};

export default SettingsPage;


