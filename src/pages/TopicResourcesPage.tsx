import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppSidebarLayout } from "@/components/AppSidebarLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileText, Trash2, FileDown } from "lucide-react";

interface Subject {
  id: string;
  name: string;
}

interface Topic {
  id: string;
  name: string;
}

interface TopicNote {
  id: string;
  title: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string | null;
}

/**
 * Topic resources page for managing PPTs associated with a specific topic.
 *
 * This uses the existing `notes` table and `notes` storage bucket to store
 * uploaded PPT/PPTX/PDF files, so no schema changes are required.
 */
const TopicResourcesPage = () => {
  const { subjectId, topicId } = useParams<{ subjectId: string; topicId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [notes, setNotes] = useState<TopicNote[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (user && subjectId && topicId) {
      loadTopicContext();
      loadNotes();
    }
  }, [user, subjectId, topicId]);

  /**
   * Loads subject and topic metadata so the header can show clear context.
   */
  const loadTopicContext = async () => {
    try {
      const [subjectRes, topicRes] = await Promise.all([
        supabase.from("subjects").select("id, name").eq("id", subjectId).single(),
        supabase.from("topics").select("id, name").eq("id", topicId).single(),
      ]);

      if (subjectRes.error) throw subjectRes.error;
      if (topicRes.error) throw topicRes.error;

      setSubject(subjectRes.data);
      setTopic(topicRes.data);
    } catch (error: any) {
      toast({
        title: "Error loading topic",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Loads notes with file attachments for this topic so we can treat them as PPT
   * resources. We only care about rows that have a `file_url` present.
   */
  const loadNotes = async () => {
    if (!topicId || !user) return;

    try {
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, file_url, file_name, file_size, created_at")
        .eq("topic_id", topicId)
        .eq("user_id", user.id)
        .not("file_url", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading PPTs",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Handles PPT/PPTX/PDF uploads into the existing `notes` storage bucket.
   */
  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Choose a PPT/PPTX/PDF file to upload first.",
        variant: "destructive",
      });
      return;
    }

    if (!user || !subjectId || !topicId) return;

    setUploading(true);
    try {
      const path = `${user.id}/${subjectId}/${topicId}/${selectedFile.name}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("notes")
        .upload(path, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("notes").getPublicUrl(uploadData.path);

      const { error: insertError } = await supabase.from("notes").insert({
        user_id: user.id,
        topic_id: topicId,
        subject_id: subjectId,
        title: selectedFile.name.replace(/\.[^.]+$/, ""),
        file_url: publicUrlData.publicUrl,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
      });

      if (insertError) throw insertError;

      toast({
        title: "PPT uploaded",
        description: "Your file has been attached to this topic.",
      });

      setSelectedFile(null);
      loadNotes();
    } catch (error: any) {
      toast({
        title: "Error uploading PPT",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteNote = async (note: TopicNote) => {
    try {
      await supabase.from("notes").delete().eq("id", note.id);
      toast({
        title: "Deleted",
        description: "The PPT has been removed from this topic.",
      });
      loadNotes();
    } catch (error: any) {
      toast({
        title: "Error deleting PPT",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <AppSidebarLayout>
      <main className="container mx-auto px-4 py-8 space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                {subject?.name || "Subject"}
              </p>
              <h1 className="text-2xl font-display font-bold">
                {topic?.name || "Topic resources"}
              </h1>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-[1.3fr,1.7fr] gap-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-sm font-semibold">Upload PPT / PDF</h2>
            <p className="text-xs text-muted-foreground">
              Attach lecture slides or notes to this topic so they are always one click away.
            </p>
            <Input
              type="file"
              accept=".ppt,.pptx,.pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
            <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
              {uploading ? "Uploading..." : "Upload file"}
            </Button>
          </Card>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-3">Topic PPTs</h2>
          {notes.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              No PPTs uploaded for this topic yet.
            </Card>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <Card key={note.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{note.title}</p>
                      {note.file_size != null && (
                        <p className="text-xs text-muted-foreground">
                          {(note.file_size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {note.file_url && (
                      <Button asChild size="icon" variant="outline">
                        <a href={note.file_url} target="_blank" rel="noopener noreferrer">
                          <FileDown className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteNote(note)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppSidebarLayout>
  );
};

export default TopicResourcesPage;


