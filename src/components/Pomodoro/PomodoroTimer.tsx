import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Pause, RotateCcw, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const FOCUS_TIME = 25 * 60; // 25 minutes
const BREAK_TIME = 5 * 60; // 5 minutes

/**
 * Key used in localStorage to persist timer state so it survives navigation
 * to other pages and even full reloads while keeping accurate timing.
 */
const STORAGE_KEY = "studox_pomodoro_state";

interface PersistedTimerState {
  isActive: boolean;
  isFocus: boolean;
  /** Epoch milliseconds when the current interval should end if active. */
  endTime: number | null;
  /** Remaining seconds when paused or just switched mode. */
  secondsRemaining: number;
  sessionId: string | null;
}

export const PomodoroTimer = ({ topicId }: { topicId?: string }) => {
  const [seconds, setSeconds] = useState(FOCUS_TIME);
  const [isActive, setIsActive] = useState(false);
  const [isFocus, setIsFocus] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * On first mount, attempt to restore any persisted timer state so that the
   * timer appears in the correct position even after route changes or reloads.
   */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as PersistedTimerState;

      const baseDuration = data.isFocus ? FOCUS_TIME : BREAK_TIME;

      if (data.isActive && data.endTime) {
        const remaining = Math.max(0, Math.round((data.endTime - Date.now()) / 1000));
        setIsActive(remaining > 0);
        setIsFocus(data.isFocus);
        setSessionId(data.sessionId);
        setEndTime(remaining > 0 ? data.endTime : null);
        setSeconds(remaining > 0 ? remaining : baseDuration);
      } else {
        setIsActive(false);
        setIsFocus(data.isFocus);
        setSessionId(data.sessionId);
        setEndTime(null);
        setSeconds(data.secondsRemaining || baseDuration);
      }
    } catch (error) {
      console.error("Failed to restore pomodoro state:", error);
    }
  }, []);

  /**
   * Core ticking loop: rather than decrementing a mutable counter, we derive
   * remaining seconds from the stored endTime so navigation or tab switching
   * does not halt effective progress.
   */
  useEffect(() => {
    let interval: number | undefined;

    if (isActive && endTime) {
      interval = window.setInterval(() => {
        const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        setSeconds(remaining);
        if (remaining === 0) {
          handleTimerComplete();
        }
      }, 1000);
    }

    return () => {
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
    };
    // We intentionally exclude handleTimerComplete from deps to avoid
    // re-registering the interval on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, endTime]);

  /**
   * Persist the current timer state whenever the key properties change so it
   * can be restored after route changes or refreshes.
   */
  useEffect(() => {
    const payload: PersistedTimerState = {
      isActive,
      isFocus,
      endTime,
      secondsRemaining: seconds,
      sessionId,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to persist pomodoro state:", error);
    }
  }, [isActive, isFocus, endTime, seconds, sessionId]);

  /**
   * Marks the current session as completed at its natural end.
   * The originally planned duration (25 or 5 minutes) is kept as-is
   * because we already stored that when inserting the session row.
   */
  const handleTimerComplete = async () => {
    setIsActive(false);
    setEndTime(null);

    if (sessionId) {
      try {
        await supabase
          .from("study_sessions")
          .update({
            completed: true,
            completed_at: new Date().toISOString(),
          })
          .eq("id", sessionId);
      } catch (error) {
        console.error("Error completing session:", error);
      }
    }

    toast({
      title: isFocus ? "Focus session complete!" : "Break time over!",
      description: isFocus
        ? "Great work! Time for a break."
        : "Ready to focus again?",
    });

    // Switch mode
    setIsFocus(!isFocus);
    setSeconds(isFocus ? BREAK_TIME : FOCUS_TIME);
  };

  /**
   * Manually ends the current session early and records the actual duration
   * based on how many seconds have elapsed so far. This allows the history
   * view to reflect "how much you actually studied" even if you stop before
   * the timer reaches zero.
   */
  const handleEndSession = async () => {
    if (!sessionId) {
      // Nothing persisted yet; simply reset the local timer state.
      setIsActive(false);
      setEndTime(null);
      setSeconds(isFocus ? FOCUS_TIME : BREAK_TIME);
      return;
    }

    try {
      const baseDurationSeconds = (isFocus ? FOCUS_TIME : BREAK_TIME);
      const elapsedSeconds = baseDurationSeconds - seconds;
      const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

      await supabase
        .from("study_sessions")
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          duration_minutes: elapsedMinutes,
        })
        .eq("id", sessionId);
    } catch (error) {
      console.error("Error ending session:", error);
    } finally {
      setIsActive(false);
      setEndTime(null);
      setSessionId(null);
      setSeconds(isFocus ? FOCUS_TIME : BREAK_TIME);

      toast({
        title: "Session ended",
        description: "Study time has been saved to your history.",
      });
    }
  };

  const toggleTimer = async () => {
    if (!isActive && !sessionId && user) {
      // Start new session
      try {
        const { data, error } = await supabase
          .from("study_sessions")
          .insert({
            user_id: user.id,
            topic_id: topicId || null,
            duration_minutes: isFocus ? 25 : 5,
            session_type: isFocus ? "focus" : "break",
          })
          .select()
          .single();

        if (error) throw error;
        setSessionId(data.id);
      } catch (error) {
        console.error("Error creating session:", error);
      }
    }
    /**
     * When starting we derive an absolute endTime so that the timer can keep
     * accurate progress while the user navigates around the app or switches tabs.
     */
    if (!isActive) {
      const baseDuration = isFocus ? FOCUS_TIME : BREAK_TIME;
      const newEnd = Date.now() + seconds * 1000 || baseDuration * 1000;
      setEndTime(newEnd);
      setIsActive(true);
    } else {
      // Pausing: capture the current seconds and clear endTime.
      setIsActive(false);
      setEndTime(null);
    }
  };

  const resetTimer = () => {
    setIsActive(false);
    setEndTime(null);
    setSeconds(isFocus ? FOCUS_TIME : BREAK_TIME);
    setSessionId(null);
  };

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const progress = ((isFocus ? FOCUS_TIME : BREAK_TIME) - seconds) / (isFocus ? FOCUS_TIME : BREAK_TIME) * 100;

  return (
    <Card className="p-8 text-center card-elevated">
      <div className="mb-6">
        <div className="inline-block px-4 py-2 bg-primary/10 rounded-full mb-4">
          <span className="text-sm font-medium text-primary">
            {isFocus ? "Focus Time" : "Break Time"}
          </span>
        </div>
      </div>

      <div className="relative w-64 h-64 mx-auto mb-8">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="128"
            cy="128"
            r="120"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-muted"
          />
          <circle
            cx="128"
            cy="128"
            r="120"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 120}`}
            strokeDashoffset={`${2 * Math.PI * 120 * (1 - progress / 100)}`}
            className="text-primary transition-all duration-1000"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-6xl font-display font-bold">
            {String(minutes).padStart(2, "0")}:{String(remainingSeconds).padStart(2, "0")}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button size="lg" onClick={toggleTimer} className="w-32">
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
        <Button size="lg" variant="outline" onClick={resetTimer}>
          <RotateCcw className="w-5 h-5 mr-2" />
          Reset
        </Button>
        <Button size="lg" variant="outline" onClick={handleEndSession}>
          <Square className="w-5 h-5 mr-2" />
          End session
        </Button>
      </div>
    </Card>
  );
};
