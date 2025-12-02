import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/Dashboard/StatCard";
import { SubjectCard } from "@/components/Dashboard/SubjectCard";
import { CreateSubjectDialog } from "@/components/Dashboard/CreateSubjectDialog";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Brain, Clock, Plus } from "lucide-react";
import { AppSidebarLayout } from "@/components/AppSidebarLayout";
import { Calendar } from "@/components/ui/calendar";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

interface Subject {
  id: string;
  name: string;
  description: string | null;
  color: string;
  user_id: string;
}

interface TimelinePoint {
  /** Short label for the X axis, e.g. "Mon" or "12/02". */
  label: string;
  /** Total study minutes for the day. */
  minutes: number;
}

interface DailyTodo {
  id: string;
  text: string;
  done: boolean;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [stats, setStats] = useState({
    totalSubjects: 0,
    totalTopics: 0,
    totalRevisions: 0,
    studyTime: 0,
  });
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [todos, setTodos] = useState<DailyTodo[]>([]);
  const [todoInput, setTodoInput] = useState("");

  useEffect(() => {
    if (user) {
      loadSubjects();
      loadStats();
      loadTimeline();
    }
  }, [user]);

  const loadSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSubjects(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading subjects",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const [subjectsRes, topicsRes, sessionsRes] = await Promise.all([
        supabase.from("subjects").select("id", { count: "exact", head: true }),
        supabase.from("topics").select("id, revision_count", { count: "exact" }),
        supabase.from("study_sessions").select("duration_minutes").eq("completed", true),
      ]);

      const totalRevisions = topicsRes.data?.reduce((sum, topic) => sum + (topic.revision_count || 0), 0) || 0;
      const studyTime = sessionsRes.data?.reduce((sum, session) => sum + session.duration_minutes, 0) || 0;

      setStats({
        totalSubjects: subjectsRes.count || 0,
        totalTopics: topicsRes.count || 0,
        totalRevisions,
        studyTime,
      });
    } catch (error: any) {
      console.error("Error loading stats:", error);
    }
  };

  /**
   * Loads study sessions for the last 7 days and aggregates them into a simple
   * per-day timeline that powers the dashboard graph.
   */
  const loadTimeline = async () => {
    if (!user) return;

    try {
      const today = new Date();
      const since = new Date();
      since.setDate(today.getDate() - 6);

      const { data, error } = await supabase
        .from("study_sessions")
        .select("duration_minutes, started_at")
        .eq("user_id", user.id)
        .eq("completed", true)
        .gte("started_at", since.toISOString());

      if (error) throw error;

      const byDate: Record<string, number> = {};
      (data || []).forEach((session) => {
        if (!session.started_at) return;
        const d = new Date(session.started_at);
        const key = d.toISOString().slice(0, 10);
        byDate[key] = (byDate[key] || 0) + (session.duration_minutes || 0);
      });

      const points: TimelinePoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString(undefined, { weekday: "short" });
        points.push({ label, minutes: byDate[key] || 0 });
      }

      setTimeline(points);
    } catch (error) {
      console.error("Error loading timeline:", error);
    }
  };

  /**
   * Adds a simple client-side todo for the current day. These todos are meant
   * as lightweight reminders and are not persisted to Supabase yet.
   */
  const handleAddTodo = () => {
    const value = todoInput.trim();
    if (!value) return;
    setTodos((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: value, done: false },
    ]);
    setTodoInput("");
  };

  const handleToggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  };

  const handleRemoveTodo = (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const handleCreateSubject = async (data: {
    name: string;
    description: string;
    color: string;
  }) => {
    try {
      const { error } = await supabase.from("subjects").insert({
        name: data.name,
        description: data.description,
        color: data.color,
        user_id: user!.id,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subject created successfully",
      });

      setCreateDialogOpen(false);
      loadSubjects();
      loadStats();
    } catch (error: any) {
      toast({
        title: "Error creating subject",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteSubject = async (id: string) => {
    try {
      const { error } = await supabase.from("subjects").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subject deleted successfully",
      });

      loadSubjects();
      loadStats();
    } catch (error: any) {
      toast({
        title: "Error deleting subject",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Opens the edit dialog for a given subject, allowing the user to update it.
   */
  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setEditDialogOpen(true);
  };

  /**
   * Updates the selected subject in Supabase and refreshes local state and stats.
   */
  const handleUpdateSubject = async (data: {
    name: string;
    description: string;
    color: string;
  }) => {
    if (!editingSubject) return;

    try {
      const { error } = await supabase
        .from("subjects")
        .update({
          name: data.name,
          description: data.description,
          color: data.color,
        })
        .eq("id", editingSubject.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subject updated successfully",
      });

      setEditDialogOpen(false);
      setEditingSubject(null);
      loadSubjects();
      loadStats();
    } catch (error: any) {
      toast({
        title: "Error updating subject",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AppSidebarLayout>
      <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Top bar similar to reference: date and range selector */}
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Today
            </p>
            <h1 className="text-xl md:text-2xl font-display font-semibold">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              Day
            </Button>
            <Button variant="ghost" size="sm">
              Week
            </Button>
            <Button variant="ghost" size="sm">
              Month
            </Button>
          </div>
        </section>

        {/* Timeline row: shows study minutes for the last 7 days with todos on the side */}
        <section>
          <Card className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-[2fr,1.2fr] gap-6 items-start">
              <div>
            <p className="text-sm font-medium mb-2">Timeline</p>
                {timeline.length === 0 ? (
                  <div className="h-32 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    No completed Pomodoro sessions recorded in the last 7 days.
                  </div>
                ) : (
                  <ChartContainer
                    className="h-40"
                    config={{
                      minutes: {
                        label: "Study minutes",
                        color: "hsl(var(--primary))",
                      },
                    }}
                  >
                    <BarChart data={timeline}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}m`}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="minutes" fill="var(--color-minutes)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Today&apos;s todos</p>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
                    placeholder="Add a quick task for today..."
                    value={todoInput}
                    onChange={(e) => setTodoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTodo();
                    }}
                  />
                  <Button size="sm" onClick={handleAddTodo} disabled={!todoInput.trim()}>
                    Add
                  </Button>
                </div>
                {todos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No todos yet. Add 2–3 key tasks you want to finish today.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm max-h-32 overflow-auto pr-1">
                    {todos.map((todo) => (
                      <li
                        key={todo.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <label className="flex items-center gap-2 flex-1">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border"
                            checked={todo.done}
                            onChange={() => handleToggleTodo(todo.id)}
                          />
                          <span
                            className={
                              todo.done ? "line-through text-muted-foreground" : ""
                            }
                          >
                            {todo.text}
                          </span>
                        </label>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-xs"
                          onClick={() => handleRemoveTodo(todo.id)}
                        >
                          ×
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        </section>

        {/* Three-column layout: projects/subjects, calendar, summary */}
        <section className="grid grid-cols-1 lg:grid-cols-[2fr,2fr,1.5fr] gap-6">
          {/* Projects & subjects */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Projects &amp; subjects</p>
              <Button size="sm" variant="outline" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>
            <Card className="p-4 space-y-3">
              {subjects.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  No subjects yet. Click &quot;Add&quot; to create your first one.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {/**
                   * Keep the subjects list constrained so it does not push the dashboard layout.
                   * When there are many subjects this area becomes scrollable instead of overflowing.
                   */}
                  {subjects.map((subject) => (
                    <SubjectCard
                      key={subject.id}
                      id={subject.id}
                      name={subject.name}
                      description={subject.description || undefined}
                      color={subject.color}
                      topicsCount={0}
                      completedTopics={0}
                      onEdit={() => handleEditSubject(subject)}
                      onDelete={() => handleDeleteSubject(subject.id)}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Inline calendar column for quick at-a-glance planning */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Calendar</p>
            <Card className="p-4">
              {/* Lightweight calendar: reuses shared Calendar component without extra data bindings */}
              <Calendar mode="single" className="w-full" />
            </Card>
          </div>

          {/* Daily summary */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Daily summary</p>
            <Card className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Overview of your current day&apos;s learning activity based on subjects and sessions.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Total subjects</span>
                  <span className="font-medium">{stats.totalSubjects}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total topics</span>
                  <span className="font-medium">{stats.totalTopics}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total revisions</span>
                  <span className="font-medium">{stats.totalRevisions}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Study time</span>
                  <span className="font-medium">
                    {`${Math.floor(stats.studyTime / 60)}h ${stats.studyTime % 60}m`}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </main>
      <CreateSubjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateSubject}
      />
      <CreateSubjectDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingSubject(null);
          }
        }}
        onSubmit={handleUpdateSubject}
        initialData={
          editingSubject
            ? {
                name: editingSubject.name,
                description: editingSubject.description || "",
                color: editingSubject.color,
              }
            : undefined
        }
        isEdit
      />
    </AppSidebarLayout>
  );
};

export default Dashboard;
