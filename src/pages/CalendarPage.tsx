import { useState, useEffect } from "react";
import { AppSidebarLayout } from "@/components/AppSidebarLayout";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";

interface StudyAggregate {
  date: string;
  totalMinutes: number;
}

interface ExamSummary {
  id: string;
  title: string;
  exam_date: string;
  /** Optional human-readable subject name for display alongside the exam title. */
  subject_name?: string;
}

/**
 * Normalizes a JS Date or ISO string into a local-date key (YYYY-MM-DD).
 * This avoids off-by-one issues that can occur when using toISOString()
 * directly, especially for users outside of UTC.
 */
const toLocalDateKey = (value: Date | string): string => {
  const d = value instanceof Date ? value : new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Calendar planner page that shows what you studied and which exams fall on each day.
 * The UI mirrors the clean calendar layout from the reference design while using
 * existing Supabase data.
 */
const CalendarPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [studyByDate, setStudyByDate] = useState<Record<string, StudyAggregate>>({});
  const [examsByDate, setExamsByDate] = useState<Record<string, ExamSummary[]>>({});

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  /**
   * Loads study time (Pomodoro sessions) and exams, then groups them by day.
   */
  const loadData = async () => {
    if (!user) return;

    try {
      const [sessionsRes, examsRes] = await Promise.all([
        supabase
          .from("study_sessions")
          .select("duration_minutes, started_at")
          .eq("user_id", user.id)
          .eq("completed", true),
        supabase
          .from("exams")
          /**
           * We also fetch the related subject's name so that the "Exams on this day"
           * panel can show which subject an exam belongs to.
           */
          .select("id, title, exam_date, subject_id, subjects(name)")
          .eq("user_id", user.id),
      ]);

      if (sessionsRes.error) throw sessionsRes.error;
      if (examsRes.error) throw examsRes.error;

      const studyMap: Record<string, StudyAggregate> = {};
      (sessionsRes.data || []).forEach((session) => {
        if (!session.started_at) return;
        const dateKey = toLocalDateKey(session.started_at);
        if (!studyMap[dateKey]) {
          studyMap[dateKey] = { date: dateKey, totalMinutes: 0 };
        }
        studyMap[dateKey].totalMinutes += session.duration_minutes || 0;
      });

      const examsMap: Record<string, ExamSummary[]> = {};
      (examsRes.data || []).forEach((exam: any) => {
        const dateKey = toLocalDateKey(exam.exam_date);
        if (!examsMap[dateKey]) {
          examsMap[dateKey] = [];
        }
        examsMap[dateKey].push({
          id: exam.id,
          title: exam.title,
          exam_date: exam.exam_date,
          subject_name: exam.subjects?.name,
        });
      });

      setStudyByDate(studyMap);
      setExamsByDate(examsMap);
    } catch (error: any) {
      toast({
        title: "Error loading calendar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const selectedKey = selectedDate ? toLocalDateKey(selectedDate) : "";
  const selectedStudy = studyByDate[selectedKey];
  const selectedExams = examsByDate[selectedKey] || [];

  return (
    <AppSidebarLayout>
      <main className="container mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[1.3fr,1.7fr] gap-8">
        <section>
          <header className="mb-4 flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-2xl font-display font-bold">Calendar</h1>
              <p className="text-muted-foreground text-sm">
                See your study activity and exams on a simple calendar.
              </p>
            </div>
          </header>
          <Card className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="w-full"
            />
          </Card>
        </section>

        <section className="space-y-4">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Selected day
              </p>
              <p className="text-lg font-medium">
                {selectedDate?.toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
              Today
            </Button>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold mb-2">Study overview</h2>
            {selectedStudy ? (
              <p className="text-sm text-muted-foreground">
                You studied for <span className="font-semibold">{selectedStudy.totalMinutes} minutes</span> on this day
                using focused Pomodoro sessions.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No recorded study sessions for this day.</p>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold mb-2">Exams on this day</h2>
            {selectedExams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No exams scheduled on this day.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {selectedExams.map((exam) => (
                  <li key={exam.id} className="flex items-center justify-between">
                    <span>
                      {exam.title}
                      {exam.subject_name ? ` · ${exam.subject_name}` : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(exam.exam_date).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </main>
    </AppSidebarLayout>
  );
};

export default CalendarPage;


