import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppSidebarLayout } from "@/components/AppSidebarLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, FileText, Trash2, FileDown, Eye } from "lucide-react";

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
  const [previewNote, setPreviewNote] = useState<TopicNote | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

      /**
       * Store the storage path directly in file_url so we can generate signed URLs later.
       * Since the bucket is private, we can't use public URLs.
       */
      const { error: insertError } = await supabase.from("notes").insert({
        user_id: user.id,
        topic_id: topicId,
        subject_id: subjectId,
        title: selectedFile.name.replace(/\.[^.]+$/, ""),
        file_url: uploadData.path, // Store the storage path, not a public URL
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

  /**
   * Extracts the storage path from a file_url.
   * Handles both old public URLs and new path-only storage.
   */
  const extractStoragePath = (fileUrl: string | null): string | null => {
    if (!fileUrl) return null;
    
    // If it's already a path (no http), return as-is
    if (!fileUrl.startsWith("http")) {
      return fileUrl;
    }
    
    // Extract path from Supabase storage URL
    // Format: https://<project>.supabase.co/storage/v1/object/public/notes/path/to/file
    // or: https://<project>.supabase.co/storage/v1/object/sign/notes/path/to/file
    const match = fileUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/notes\/(.+)$/);
    return match ? match[1] : fileUrl;
  };

  /**
   * Generates a signed URL for downloading or previewing a file from private storage.
   */
  const getSignedUrl = async (filePath: string, expiresIn: number = 3600): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from("notes")
        .createSignedUrl(filePath, expiresIn);

      if (error) throw error;
      return data?.signedUrl || null;
    } catch (error: any) {
      console.error("Error generating signed URL:", error);
      toast({
        title: "Error accessing file",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  /**
   * Handles file download by generating a signed URL and triggering download.
   */
  const handleDownload = async (note: TopicNote) => {
    if (!note.file_url) return;

    const storagePath = extractStoragePath(note.file_url);
    if (!storagePath) {
      toast({
        title: "Error",
        description: "Could not determine file path.",
        variant: "destructive",
      });
      return;
    }

    const signedUrl = await getSignedUrl(storagePath);
    if (!signedUrl) return;

    // Trigger download
    const link = document.createElement("a");
    link.href = signedUrl;
    link.download = note.file_name || note.title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Handles file preview by generating a signed URL and opening it in a dialog.
   */
  const handlePreview = async (note: TopicNote) => {
    if (!note.file_url) return;

    const storagePath = extractStoragePath(note.file_url);
    if (!storagePath) {
      toast({
        title: "Error",
        description: "Could not determine file path.",
        variant: "destructive",
      });
      return;
    }

    const signedUrl = await getSignedUrl(storagePath, 7200); // 2 hours for preview
    if (!signedUrl) return;

    setPreviewNote(note);
    setPreviewUrl(signedUrl);
  };

  /**
   * Determines if a file can be previewed inline (PDFs can be shown in iframe).
   */
  const canPreviewInline = (fileName: string | null): boolean => {
    if (!fileName) return false;
    return fileName.toLowerCase().endsWith(".pdf");
  };

  /**
   * Gets a preview URL for PPT/PPTX files using Office Online viewer.
   * Note: Office Online requires the file to be publicly accessible or use a special format.
   * For private files, we'll provide download/open options instead.
   */
  const getOfficeOnlineUrl = (signedUrl: string): string => {
    // Office Online viewer format
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`;
  };

  const handleDeleteNote = async (note: TopicNote) => {
    try {
      // Also delete the file from storage
      const storagePath = extractStoragePath(note.file_url);
      if (storagePath) {
        await supabase.storage.from("notes").remove([storagePath]);
      }
      
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
                      <>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handlePreview(note)}
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleDownload(note)}
                          title="Download"
                        >
                          <FileDown className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteNote(note)}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Preview Dialog */}
        <Dialog open={!!previewNote} onOpenChange={(open) => !open && setPreviewNote(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{previewNote?.title || "Preview"}</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {previewUrl && previewNote && (
                <div className="w-full h-[70vh]">
                  {canPreviewInline(previewNote.file_name) ? (
                    // PDF files can be previewed directly in iframe
                    <iframe
                      src={previewUrl}
                      className="w-full h-full border rounded"
                      title={previewNote.title}
                    />
                  ) : previewNote.file_name?.toLowerCase().endsWith(".ppt") ||
                    previewNote.file_name?.toLowerCase().endsWith(".pptx") ? (
                    // PPT/PPTX files - try Office Online viewer
                    <div className="w-full h-full flex flex-col border rounded bg-muted">
                      <iframe
                        src={getOfficeOnlineUrl(previewUrl)}
                        className="w-full flex-1 border-0"
                        title={previewNote.title}
                      />
                      <div className="p-3 border-t bg-background flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          If preview doesn&apos;t load, try downloading the file.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(previewUrl, "_blank")}
                          >
                            Open in new tab
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              handleDownload(previewNote);
                              setPreviewNote(null);
                            }}
                          >
                            Download
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Other file types
                    <div className="w-full h-full flex flex-col items-center justify-center border rounded bg-muted">
                      <p className="text-sm text-muted-foreground mb-4">
                        Preview not available for this file type. Please download to view.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => window.open(previewUrl, "_blank")}
                        >
                          Open in new tab
                        </Button>
                        <Button
                          onClick={() => {
                            handleDownload(previewNote);
                            setPreviewNote(null);
                          }}
                        >
                          Download
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </AppSidebarLayout>
  );
};

export default TopicResourcesPage;


