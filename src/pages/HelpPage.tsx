import { AppSidebarLayout } from "@/components/AppSidebarLayout";

/**
 * Basic help page explaining the core areas of the application.
 *
 * This is wired to the `/help` route and the `Help` sidebar entry. The content
 * is intentionally minimal so it can be iterated as new features are added.
 */
const HelpPage = () => {
  return (
    <AppSidebarLayout>
      <main className="mx-auto max-w-4xl px-6 py-8 space-y-4">
        <header>
          <h1 className="text-2xl font-display font-semibold">Help &amp; Support</h1>
          <p className="text-sm text-muted-foreground">
            Learn how to use studox to manage subjects, notes, exams, and more.
          </p>
        </header>
        <section className="rounded-lg border bg-card p-6 space-y-3 text-sm text-muted-foreground">
          <p>
            Use the sidebar to navigate between your dashboard, calendar, datesheet,
            timer, history, and AI tutor. Each section focuses on a single workflow
            so it is easy to stay organized.
          </p>
          <p>
            If something does not work as expected, first try refreshing the page
            and confirming that you are still signed in. For persistent issues,
            you can add more detailed troubleshooting guidance here later.
          </p>
        </section>
      </main>
    </AppSidebarLayout>
  );
};

export default HelpPage;


