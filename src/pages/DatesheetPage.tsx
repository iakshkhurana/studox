import { useEffect, useState, ChangeEvent } from "react";
import { AppSidebarLayout } from "@/components/AppSidebarLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, FileText } from "lucide-react";

interface SubjectSummary {
  id: string;
  name: string;
  color: string | null;
}

interface Exam {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  exam_date: string;
  exam_type: string | null;
  tags: string[] | null;
  ppt_url: string | null;
  ppt_name: string | null;
  ppt_size: number | null;
}

/**
 * Global exam datesheet page that shows all exams across subjects.
 * Users can add exams, attach PPTs, and see upcoming exams in one place.
 */
const DatesheetPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creatingExam, setCreatingExam] = useState(false);
  const [newExam, setNewExam] = useState({
    title: "",
    subjectId: "",
    examDate: "",
    examType: "",
    tagsInput: "",
  });
  const [examFile, setExamFile] = useState<File | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  /**
   * Loads all subjects and exams for the current user so the datesheet can
   * show a complete, cross-subject view of upcoming exams.
   */
  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [subjectsRes, examsRes] = await Promise.all([
        supabase
          .from("subjects")
          .select("id, name, color")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("exams")
          .select("*")
          .eq("user_id", user.id)
          .order("exam_date", { ascending: true }),
      ]);

      if (subjectsRes.error) throw subjectsRes.error;
      if (examsRes.error) throw examsRes.error;

      setSubjects(subjectsRes.data || []);
      setExams(examsRes.data || []);
    } catch (error: any) {
      toast({
        title: "Error loading datesheet",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const parseTags = (raw: string): string[] =>
    raw
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

  const handleExamFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      setExamFile(null);
      return;
    }
    setExamFile(files[0]);
  };

  const handleCreateExam = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be signed in to create an exam",
        variant: "destructive",
      });
      return;
    }

    if (!newExam.title.trim() || !newExam.examDate || !newExam.subjectId) {
      toast({
        title: "Missing information",
        description: "Title, subject and exam date are required",
        variant: "destructive",
      });
      return;
    }

    setCreatingExam(true);

    try {
      const tags = parseTags(newExam.tagsInput);

      const { data: inserted, error: insertError } = await supabase
        .from("exams")
        .insert({
          title: newExam.title.trim(),
          exam_date: new Date(newExam.examDate).toISOString(),
          exam_type: newExam.examType || null,
          tags: tags.length > 0 ? tags : null,
          subject_id: newExam.subjectId,
          user_id: user.id,
        })
        .select("*")
        .single();

      if (insertError) throw insertError;

      let finalExam: Exam = inserted as Exam;

      if (examFile) {
        const path = `${user.id}/${newExam.subjectId}/${inserted.id}/${examFile.name}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("exams")
          .upload(path, examFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from("exams").getPublicUrl(uploadData.path);

        const { data: updated, error: updateError } = await supabase
          .from("exams")
          .update({
            ppt_url: publicUrlData.publicUrl,
            ppt_name: examFile.name,
            ppt_size: examFile.size,
          })
          .eq("id", inserted.id)
          .select("*")
          .single();

        if (updateError) throw updateError;
        finalExam = updated as Exam;
      }

      setExams((prev) =>
        [...prev, finalExam].sort(
          (a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime(),
        ),
      );

      toast({
        title: "Exam created",
        description: "Exam has been added to your datesheet",
      });

      setDialogOpen(false);
      setNewExam({
        title: "",
        subjectId: "",
        examDate: "",
        examType: "",
        tagsInput: "",
      });
      setExamFile(null);
    } catch (error: any) {
      toast({
        title: "Error creating exam",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreatingExam(false);
    }
  };

  const handleDeleteExam = async (exam: Exam) => {
    try {
      if (exam.ppt_url) {
        try {
          const url = new URL(exam.ppt_url);
          const parts = url.pathname.split("/object/sign/").pop() || "";
          const pathWithParams = parts.split("?")[0];
          const [, objectPath] = pathWithParams.split("/exams/");
          if (objectPath) {
            await supabase.storage.from("exams").remove([objectPath]);
          }
        } catch {
          // swallow storage delete issues
        }
      }

      const { error } = await supabase.from("exams").delete().eq("id", exam.id);
      if (error) throw error;

      setExams((prev) => prev.filter((e) => e.id !== exam.id));

      toast({
        title: "Exam deleted",
        description: "The exam has been removed from your datesheet",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting exam",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  return (
    <AppSidebarLayout>
      <main className="container mx-auto px-4 py-8">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold">Exam Datesheet</h1>
              <p className="text-muted-foreground">
                View and manage all your upcoming exams across every subject.
              </p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                Add Exam
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Exam</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="exam-title">Title</Label>
                  <Input
                    id="exam-title"
                    value={newExam.title}
                    onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                    placeholder="e.g., Mid-Semester Test"
                  />
                </div>
                <div>
                  <Label htmlFor="exam-subject">Subject</Label>
                  <Select
                    value={newExam.subjectId}
                    onValueChange={(value) => setNewExam({ ...newExam, subjectId: value })}
                  >
                    <SelectTrigger id="exam-subject">
                      <SelectValue placeholder="Choose subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="exam-date">Exam Date &amp; Time</Label>
                  <Input
                    id="exam-date"
                    type="datetime-local"
                    value={newExam.examDate}
                    onChange={(e) => setNewExam({ ...newExam, examDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="exam-type">Exam Type (EST / MST / Other)</Label>
                  <Input
                    id="exam-type"
                    value={newExam.examType}
                    onChange={(e) => setNewExam({ ...newExam, examType: e.target.value })}
                    placeholder="e.g., EST, MST, Viva"
                  />
                </div>
                <div>
                  <Label htmlFor="exam-tags">Tags (comma-separated)</Label>
                  <Input
                    id="exam-tags"
                    value={newExam.tagsInput}
                    onChange={(e) => setNewExam({ ...newExam, tagsInput: e.target.value })}
                    placeholder="e.g., important, unit-1, high-weightage"
                  />
                </div>
                <div>
                  <Label htmlFor="exam-file">Attach PPT (optional)</Label>
                  <Input
                    id="exam-file"
                    type="file"
                    accept=".ppt,.pptx,.pdf"
                    onChange={handleExamFileChange}
                  />
                </div>
                <Button onClick={handleCreateExam} className="w-full" disabled={creatingExam || loading}>
                  {creatingExam ? "Creating..." : "Create Exam"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </header>

        {loading ? (
          <div className="min-h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : exams.length === 0 ? (
          <Card className="p-10 text-center">
            <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-display font-semibold mb-2">No exams scheduled</h2>
            <p className="text-muted-foreground mb-4">
              Use the button above to add your first exam to the datesheet.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exams.map((exam) => {
              const subject = subjectById.get(exam.subject_id);
              return (
                <Card key={exam.id} className="p-6 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {subject && (
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ backgroundColor: subject.color || "#6366f1" }}
                            />
                          )}
                          <h3 className="font-display font-semibold text-lg">{exam.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(exam.exam_date).toLocaleString()}
                        </p>
                        {subject && (
                          <p className="text-xs text-muted-foreground mt-1">Subject: {subject.name}</p>
                        )}
                        {exam.exam_type && (
                          <p className="mt-1 text-xs font-medium uppercase text-primary">
                            {exam.exam_type}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteExam(exam)}
                      >
                        ×
                      </Button>
                    </div>
                    {exam.tags && exam.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {exam.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full bg-primary/10 text-xs text-primary"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {exam.ppt_url && (
                    <a
                      href={exam.ppt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center text-sm text-primary hover:underline"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      {exam.ppt_name || "View PPT"}
                    </a>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </AppSidebarLayout>
  );
};

export default DatesheetPage;


