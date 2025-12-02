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
import { ArrowLeft, FileText, Trash2, FileDown, Eye, ChevronUp, ChevronDown, Link as LinkIcon, ExternalLink } from "lucide-react";

interface Subject {
  id: string;
  name: string;
}

interface Topic {
  id: string;
  name: string;
  video_url: string | null;
}

interface TopicNote {
  id: string;
  title: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  content: string | null; // Used to store link URLs
  created_at: string | null;
  sort_order: number | null;
}

/**
 * Checks if a note is a link (has content URL but no file_url).
 */
const isLinkNote = (note: TopicNote): boolean => {
  return !note.file_url && !!note.content && (note.content.startsWith("http://") || note.content.startsWith("https://"));
};

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
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [newLink, setNewLink] = useState({ title: "", url: "" });

  useEffect(() => {
    if (user && subjectId && topicId) {
      loadTopicContext();
      loadNotes();
    }
  }, [user, subjectId, topicId]);

  /**
   * Loads subject and topic metadata so the header can show clear context.
   * Also loads video_url for YouTube video display.
   */
  const loadTopicContext = async () => {
    try {
      const [subjectRes, topicRes] = await Promise.all([
        supabase.from("subjects").select("id, name").eq("id", subjectId).single(),
        supabase.from("topics").select("id, name, video_url").eq("id", topicId).single(),
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
   * Extracts YouTube video ID from various YouTube URL formats.
   * Supports youtube.com/watch?v=, youtube.com/embed/, and youtu.be/ formats.
   */
  const extractYouTubeVideoId = (url: string | null): string | null => {
    if (!url) return null;
    
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(youtubeRegex);
    return match ? match[1] : null;
  };

  /**
   * Generates YouTube embed URL from video ID.
   */
  const getYouTubeEmbedUrl = (videoId: string): string => {
    return `https://www.youtube.com/embed/${videoId}`;
  };

  /**
   * Loads notes with file attachments and links for this topic.
   * Includes both file-based notes (file_url) and link-based notes (content with URL).
   * Orders by sort_order (ascending), then by created_at (descending) as fallback.
   */
  const loadNotes = async () => {
    if (!topicId || !user) return;

    try {
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, file_url, file_name, file_size, content, created_at, sort_order")
        .eq("topic_id", topicId)
        .eq("user_id", user.id)
        .or("file_url.not.is.null,content.not.is.null")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Filter to only include notes with file_url OR content that is a URL
      const filteredData = (data || []).filter((note) => {
        if (note.file_url) return true; // File-based note
        if (note.content && (note.content.startsWith("http://") || note.content.startsWith("https://"))) {
          return true; // Link-based note
        }
        return false;
      });
      
      // Ensure all notes have a sort_order value
      const notesWithSortOrder = filteredData.map((note, index) => ({
        ...note,
        sort_order: note.sort_order ?? index + 1,
      }));
      
      setNotes(notesWithSortOrder);
    } catch (error: any) {
      toast({
        title: "Error loading resources",
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
      // Get the maximum sort_order for this topic to place new note at the end
      const { data: existingNotes } = await supabase
        .from("notes")
        .select("sort_order")
        .eq("topic_id", topicId)
        .order("sort_order", { ascending: false })
        .limit(1);

      const maxSortOrder = existingNotes && existingNotes.length > 0 
        ? (existingNotes[0].sort_order ?? 0)
        : 0;

      const { error: insertError } = await supabase.from("notes").insert({
        user_id: user.id,
        topic_id: topicId,
        subject_id: subjectId,
        title: selectedFile.name.replace(/\.[^.]+$/, ""),
        file_url: uploadData.path, // Store the storage path, not a public URL
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        sort_order: maxSortOrder + 1,
        content: null, // No content for file-based notes
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
   * Checks if a URL is a YouTube URL.
   */
  const isYouTubeUrl = (url: string): boolean => {
    return /(?:youtube\.com|youtu\.be)/.test(url);
  };

  /**
   * Checks if a URL is a Google Drive URL.
   */
  const isGoogleDriveUrl = (url: string): boolean => {
    return /drive\.google\.com/.test(url);
  };

  /**
   * Extracts Google Drive file ID from various URL formats.
   */
  const extractGoogleDriveFileId = (url: string): string | null => {
    // Matches formats like:
    // https://drive.google.com/file/d/FILE_ID/view
    // https://drive.google.com/open?id=FILE_ID
    // https://drive.google.com/uc?id=FILE_ID
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9_-]+)/,
      /[?&]id=([a-zA-Z0-9_-]+)/,
      /\/uc\?id=([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  /**
   * Converts a Google Drive URL to a viewable format.
   */
  const convertGoogleDriveToViewer = (url: string): string => {
    const fileId = extractGoogleDriveFileId(url);
    if (fileId) {
      // Use Google Drive viewer for better compatibility
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    return url; // Return original URL if file ID not found
  };

  /**
   * Checks if a URL points to a directly viewable file (PDF, image, etc.).
   */
  const isDirectFileUrl = (url: string): boolean => {
    const directFileExtensions = /\.(pdf|jpg|jpeg|png|gif|webp|svg|mp4|webm|mp3|ogg)$/i;
    return directFileExtensions.test(url);
  };

  /**
   * Converts a YouTube URL to an embeddable format.
   */
  const convertToYouTubeEmbed = (url: string): string => {
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return url; // Return original URL if not a valid YouTube URL
  };

  /**
   * Converts various file hosting URLs to viewable formats.
   */
  const convertUrlToViewable = (url: string): string => {
    if (isYouTubeUrl(url)) {
      return convertToYouTubeEmbed(url);
    }
    if (isGoogleDriveUrl(url)) {
      return convertGoogleDriveToViewer(url);
    }
    // For direct file URLs, return as-is (they can be viewed directly)
    return url;
  };

  /**
   * Handles file preview by generating a signed URL and opening it in a dialog.
   * For link-based notes, converts URLs to viewable formats (YouTube, Google Drive, etc.).
   */
  const handlePreview = async (note: TopicNote) => {
    // Handle link-based notes
    if (isLinkNote(note) && note.content) {
      setPreviewNote(note);
      // Convert URLs to viewable formats (YouTube, Google Drive, etc.)
      const urlToPreview = convertUrlToViewable(note.content);
      setPreviewUrl(urlToPreview);
      return;
    }

    // Handle file-based notes
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
   * Handles adding a new link to the topic.
   */
  const handleAddLink = async () => {
    if (!newLink.title.trim() || !newLink.url.trim()) {
      toast({
        title: "Error",
        description: "Link title and URL are required",
        variant: "destructive",
      });
      return;
    }

    // Validate URL format
    let url = newLink.url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    try {
      // Get the maximum sort_order for this topic to place new link at the end
      const { data: existingNotes } = await supabase
        .from("notes")
        .select("sort_order")
        .eq("topic_id", topicId)
        .order("sort_order", { ascending: false })
        .limit(1);

      const maxSortOrder = existingNotes && existingNotes.length > 0 
        ? (existingNotes[0].sort_order ?? 0)
        : 0;

      const { error } = await supabase.from("notes").insert({
        user_id: user!.id,
        topic_id: topicId!,
        subject_id: subjectId!,
        title: newLink.title.trim(),
        content: url, // Store the link URL in content field
        file_url: null, // No file for link-based notes
        file_name: null,
        file_size: null,
        sort_order: maxSortOrder + 1,
      });

      if (error) throw error;

      toast({
        title: "Link added",
        description: "Your link has been added to this topic.",
      });

      setLinkDialogOpen(false);
      setNewLink({ title: "", url: "" });
      loadNotes();
    } catch (error: any) {
      toast({
        title: "Error adding link",
        description: error.message,
        variant: "destructive",
      });
    }
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

  /**
   * Handles moving a note/PPT up in the sort order.
   */
  const handleMoveUp = async (noteId: string, currentIndex: number) => {
    if (currentIndex === 0) return; // Already at the top

    const currentNote = notes[currentIndex];
    const previousNote = notes[currentIndex - 1];

    try {
      // Swap sort_order values
      const [currentSortOrder, previousSortOrder] = [
        currentNote.sort_order ?? currentIndex + 1,
        previousNote.sort_order ?? currentIndex,
      ];

      await Promise.all([
        supabase.from("notes").update({ sort_order: previousSortOrder }).eq("id", currentNote.id),
        supabase.from("notes").update({ sort_order: currentSortOrder }).eq("id", previousNote.id),
      ]);

      loadNotes();
    } catch (error: any) {
      toast({
        title: "Error reordering PPT",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Handles moving a note/PPT down in the sort order.
   */
  const handleMoveDown = async (noteId: string, currentIndex: number) => {
    if (currentIndex === notes.length - 1) return; // Already at the bottom

    const currentNote = notes[currentIndex];
    const nextNote = notes[currentIndex + 1];

    try {
      // Swap sort_order values
      const [currentSortOrder, nextSortOrder] = [
        currentNote.sort_order ?? currentIndex + 1,
        nextNote.sort_order ?? currentIndex + 2,
      ];

      await Promise.all([
        supabase.from("notes").update({ sort_order: nextSortOrder }).eq("id", currentNote.id),
        supabase.from("notes").update({ sort_order: currentSortOrder }).eq("id", nextNote.id),
      ]);

      loadNotes();
    } catch (error: any) {
      toast({
        title: "Error reordering PPT",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Handles deleting a note (file or link).
   * For file-based notes, also deletes the file from storage.
   */
  const handleDeleteNote = async (note: TopicNote) => {
    try {
      // Delete file from storage if it's a file-based note
      if (note.file_url && !isLinkNote(note)) {
        const storagePath = extractStoragePath(note.file_url);
        if (storagePath) {
          await supabase.storage.from("notes").remove([storagePath]);
        }
      }
      
      await supabase.from("notes").delete().eq("id", note.id);
      toast({
        title: "Deleted",
        description: isLinkNote(note) 
          ? "The link has been removed from this topic."
          : "The PPT has been removed from this topic.",
      });
      loadNotes();
    } catch (error: any) {
      toast({
        title: "Error deleting resource",
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

        {/* YouTube Video Section */}
        {topic?.video_url && extractYouTubeVideoId(topic.video_url) && (
          <section>
            <h2 className="text-sm font-semibold mb-3">Video</h2>
            <Card className="p-4">
              <div className="aspect-video w-full">
                <iframe
                  src={getYouTubeEmbedUrl(extractYouTubeVideoId(topic.video_url)!)}
                  title={topic.name}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full rounded"
                />
              </div>
            </Card>
          </section>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

          <Card className="p-6 space-y-4">
            <h2 className="text-sm font-semibold">Add Link</h2>
            <p className="text-xs text-muted-foreground">
              Add a web link or resource URL to this topic.
            </p>
            <Input
              placeholder="Link title"
              value={newLink.title}
              onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
            />
            <Input
              type="url"
              placeholder="https://example.com"
              value={newLink.url}
              onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
            />
            <Button onClick={handleAddLink} disabled={!newLink.title.trim() || !newLink.url.trim()}>
              Add Link
            </Button>
          </Card>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-3">Topic Resources</h2>
          {notes.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              No resources added for this topic yet.
            </Card>
          ) : (
            <div className="space-y-3">
              {notes.map((note, index) => {
                const isLink = isLinkNote(note);
                return (
                  <Card key={note.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex flex-col gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6"
                          onClick={() => handleMoveUp(note.id, index)}
                          disabled={index === 0}
                          title="Move up"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6"
                          onClick={() => handleMoveDown(note.id, index)}
                          disabled={index === notes.length - 1}
                          title="Move down"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isLink ? "bg-blue-100 dark:bg-blue-900" : "bg-primary/10"
                      }`}>
                        {isLink ? (
                          <LinkIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <FileText className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{note.title}</p>
                        {isLink ? (
                          <p className="text-xs text-muted-foreground truncate">
                            {note.content}
                          </p>
                        ) : note.file_size != null ? (
                          <p className="text-xs text-muted-foreground">
                            {(note.file_size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isLink ? (
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handlePreview(note)}
                          title="Open link"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      ) : note.file_url ? (
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
                      ) : null}
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
                );
              })}
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
                <div className={`w-full ${isLinkNote(previewNote) && (isYouTubeUrl(previewNote.content || "") || isGoogleDriveUrl(previewNote.content || "")) ? "" : "h-[70vh]"}`}>
                  {isLinkNote(previewNote) ? (
                    // Link-based notes - open in iframe
                    // Special handling for YouTube and Google Drive links
                    isYouTubeUrl(previewNote.content || "") ? (
                      // YouTube links - use embed format with proper aspect ratio
                      <div className="w-full flex flex-col border rounded bg-muted overflow-hidden">
                        <div className="aspect-video w-full bg-black">
                          <iframe
                            src={previewUrl}
                            className="w-full h-full border-0"
                            title={previewNote.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                        <div className="p-3 border-t bg-background flex items-center justify-between shrink-0">
                          <p className="text-xs text-muted-foreground truncate">
                            Viewing: {previewNote.content}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(previewNote.content || "", "_blank")}
                            >
                              Open in new tab
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : isGoogleDriveUrl(previewNote.content || "") ? (
                      // Google Drive links - use viewer format
                      <div className="w-full flex flex-col border rounded bg-muted overflow-hidden">
                        <div className="w-full" style={{ height: "70vh" }}>
                          <iframe
                            src={previewUrl}
                            className="w-full h-full border-0"
                            title={previewNote.title}
                            allow="autoplay"
                          />
                        </div>
                        <div className="p-3 border-t bg-background flex items-center justify-between shrink-0">
                          <p className="text-xs text-muted-foreground truncate">
                            Viewing: {previewNote.content}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(previewNote.content || "", "_blank")}
                            >
                              Open in new tab
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : isDirectFileUrl(previewNote.content || "") ? (
                      // Direct file URLs (PDFs, images, etc.) - can be viewed directly
                      <div className="w-full h-full flex flex-col border rounded bg-muted">
                        <iframe
                          src={previewUrl}
                          className="w-full flex-1 border-0"
                          title={previewNote.title}
                        />
                        <div className="p-3 border-t bg-background flex items-center justify-between">
                          <p className="text-xs text-muted-foreground truncate">
                            Viewing: {previewNote.content}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(previewNote.content || "", "_blank")}
                            >
                              Open in new tab
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Other links - open in iframe with sandbox
                      <div className="w-full h-full flex flex-col border rounded bg-muted">
                        <iframe
                          src={previewUrl}
                          className="w-full flex-1 border-0"
                          title={previewNote.title}
                          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                        />
                        <div className="p-3 border-t bg-background flex items-center justify-between">
                          <p className="text-xs text-muted-foreground truncate">
                            Viewing: {previewNote.content}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(previewNote.content || "", "_blank")}
                            >
                              Open in new tab
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  ) : canPreviewInline(previewNote.file_name) ? (
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


