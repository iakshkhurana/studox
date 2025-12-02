import { useEffect, useState } from "react";
import { AppSidebarLayout } from "@/components/AppSidebarLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

interface Session {
  id: string;
  duration_minutes: number;
  session_type: string | null;
  started_at: string | null;
}

interface StopwatchHistoryEntry {
  id: string;
  durationSeconds: number;
  startedAt: string;
  endedAt: string;
}

const STOPWATCH_HISTORY_KEY = "studox_stopwatch_history";

/**
 * Study history view backed by both the `study_sessions` table (Pomodoro)
 * and client-side stopwatch entries stored in localStorage.
 *
 * This shows a simple list of past sessions grouped by date along with total
 * study time so the user can review how much they have studied.
 */
const HistoryPage = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stopwatchEntries, setStopwatchEntries] = useState<StopwatchHistoryEntry[]>([]);

  useEffect(() => {
    if (user) {
      loadSessions();
      loadStopwatchEntries();
    }
  }, [user]);

  const loadSessions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("study_sessions")
        .select("id, duration_minutes, session_type, started_at")
        .eq("user_id", user.id)
        .eq("completed", true)
        .order("started_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  /**
   * Loads stopwatch entries from localStorage so that manually-ended
   * stopwatch sessions appear alongside Pomodoro history.
   */
  const loadStopwatchEntries = () => {
    try {
      const raw = localStorage.getItem(STOPWATCH_HISTORY_KEY);
      if (!raw) {
        setStopwatchEntries([]);
        return;
      }
      const parsed: StopwatchHistoryEntry[] = JSON.parse(raw);
      setStopwatchEntries(parsed || []);
    } catch (error) {
      console.error("Error loading stopwatch history:", error);
      setStopwatchEntries([]);
    }
  };

  const stopwatchMinutes =
    stopwatchEntries.reduce((sum, e) => sum + Math.round(e.durationSeconds / 60), 0) || 0;

  const pomodoroMinutes =
    sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0;

  const totalMinutes = pomodoroMinutes + stopwatchMinutes;

  const groupedPomodoro = sessions.reduce<Record<string, Session[]>>((acc, s) => {
    const key = s.started_at ? s.started_at.slice(0, 10) : "unknown";
    acc[key] = acc[key] || [];
    acc[key].push(s);
    return acc;
  }, {});

  const groupedStopwatch = stopwatchEntries.reduce<Record<string, StopwatchHistoryEntry[]>>(
    (acc, e) => {
      const key = e.startedAt ? e.startedAt.slice(0, 10) : "unknown";
      acc[key] = acc[key] || [];
      acc[key].push(e);
      return acc;
    },
    {},
  );

  const allDates = Array.from(
    new Set([...Object.keys(groupedPomodoro), ...Object.keys(groupedStopwatch)]),
  ).filter(Boolean);

  const sortedDates = allDates.sort((a, b) => (a < b ? 1 : -1));

  return (
    <AppSidebarLayout>
      <main className="mx-auto max-w-4xl px-6 py-8 space-y-4">
        <header>
          <h1 className="text-2xl font-display font-semibold">History</h1>
          <p className="text-sm text-muted-foreground">
            Review your completed Pomodoro and stopwatch sessions and total study time.
          </p>
        </header>

        <Card className="p-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total recorded study time</span>
          <span className="font-medium">
            {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
          </span>
        </Card>

        {sortedDates.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            No completed study sessions recorded yet.
          </Card>
        ) : (
          <div className="space-y-4">
            {sortedDates.map((dateKey) => (
              <Card key={dateKey} className="p-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {new Date(dateKey).toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <ul className="space-y-1 text-sm">
                  {(groupedPomodoro[dateKey] || []).map((s) => (
                    <li key={s.id} className="flex items-center justify-between">
                      <span>
                        {s.session_type === "break" ? "Break" : "Focus"} session
                      </span>
                      <span className="text-muted-foreground">
                        {s.duration_minutes} min
                      </span>
                    </li>
                  ))}
                  {(groupedStopwatch[dateKey] || []).map((e) => (
                    <li key={e.id} className="flex items-center justify-between">
                      <span>Stopwatch session</span>
                      <span className="text-muted-foreground">
                        {Math.round(e.durationSeconds / 60)} min
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </main>
    </AppSidebarLayout>
  );
};

export default HistoryPage;

 