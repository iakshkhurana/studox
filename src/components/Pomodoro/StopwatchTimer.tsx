import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Square } from "lucide-react";

const STOPWATCH_HISTORY_KEY = "studox_stopwatch_history";

interface StopwatchHistoryEntry {
  id: string;
  durationSeconds: number;
  startedAt: string;
  endedAt: string;
}

/**
 * Simple client-side stopwatch for ad-hoc timing.
 *
 * This component keeps state in memory only; completed sessions are also
 * written to localStorage so that the History page can show how long you
 * studied using the stopwatch.
 */
export const StopwatchTimer = () => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);

  /**
   * Core ticking loop: when active, increment the elapsed seconds every second.
   */
  useEffect(() => {
    if (!isActive) return;

    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isActive]);

  const toggle = () => {
    if (!isActive) {
      setIsActive(true);
    } else {
      // Pausing simply stops the ticking; elapsedSeconds already reflects progress.
      setIsActive(false);
    }
  };

  const reset = () => {
    setIsActive(false);
    setElapsedSeconds(0);
  };

  /**
   * Ends the current stopwatch session and records it in localStorage.
   * The History page later reads this data to display stopwatch-based
   * study time alongside Pomodoro sessions.
   */
  const endSession = () => {
    if (elapsedSeconds <= 0) {
      reset();
      return;
    }

    const now = new Date();
    const endedAt = now.toISOString();
    const startedAt = new Date(now.getTime() - elapsedSeconds * 1000).toISOString();

    const entry: StopwatchHistoryEntry = {
      id: `${now.getTime()}`,
      durationSeconds: elapsedSeconds,
      startedAt,
      endedAt,
    };

    try {
      const raw = localStorage.getItem(STOPWATCH_HISTORY_KEY);
      const existing: StopwatchHistoryEntry[] = raw ? JSON.parse(raw) : [];
      existing.push(entry);
      localStorage.setItem(STOPWATCH_HISTORY_KEY, JSON.stringify(existing));
    } catch (error) {
      console.error("Failed to persist stopwatch history:", error);
    }

    reset();
  };

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  return (
    <Card className="p-8 text-center card-elevated">
      <div className="mb-6">
        <div className="inline-block px-4 py-2 bg-primary/10 rounded-full mb-4">
          <span className="text-sm font-medium text-primary">Stopwatch</span>
        </div>
      </div>

      <div className="mb-8 text-5xl md:text-6xl font-display font-bold">
        {String(hours).padStart(2, "0")}:
        {String(minutes).padStart(2, "0")}:
        {String(seconds).padStart(2, "0")}
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button size="lg" onClick={toggle} className="w-32">
          {isActive ? (
            <>
              <Pause className="w-5 h-5 mr-2" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2" />
              Start
            </>
          )}
        </Button>
        <Button size="lg" variant="outline" onClick={reset}>
          <RotateCcw className="w-5 h-5 mr-2" />
          Reset
        </Button>
        <Button size="lg" variant="outline" onClick={endSession}>
          <Square className="w-5 h-5 mr-2" />
          End session
        </Button>
      </div>
    </Card>
  );
};


