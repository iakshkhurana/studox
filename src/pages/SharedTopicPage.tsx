import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, FileDown, Eye, Link as LinkIcon, ExternalLink } from "lucide-react";
import { AppSidebarLayout } from "@/components/AppSidebarLayout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

interface Subject {
  id: string;
  name: string;
}

interface Topic {
  id: string;
  name: string;
  description: string | null;
  video_url: string | null;
  subject_id: string;
}

interface TopicNote {
  id: string;
  title: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  content: string | null;
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
 * Shared topic page for viewing topics shared via share_token.
 * This is a read-only view that displays topic information, video, and PPTs.
 */
const SharedTopicPage = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [notes, setNotes] = useState<TopicNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewNote, setPreviewNote] = useState<TopicNote | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (shareToken) {
      loadSharedTopic();
    }
  }, [shareToken]);

  /**
   * Loads the shared topic by share_token.
   * Uses public read access policy to fetch topic data.
   */
  const loadSharedTopic = async () => {
    if (!shareToken) return;

    try {
      // Fetch topic by share_token - this uses the public read policy
      const { data: topicData, error: topicError } = await supabase
        .from("topics")
        .select("id, name, description, video_url, subject_id")
        .eq("share_token", shareToken)
        .eq("is_shared", true)
        .single();

      if (topicError) throw topicError;
      if (!topicData) {
        toast({
          title: "Topic not found",
          description: "This shared topic may have been removed or the link is invalid.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      setTopic(topicData);

      // Fetch subject name
      const { data: subjectData, error: subjectError } = await supabase
        .from("subjects")
        .select("id, name")
        .eq("id", topicData.subject_id)
        .single();

      if (subjectError) {
        console.error("Error loading subject:", subjectError);
      } else {
        setSubject(subjectData);
      }

      // Fetch notes/PPTs and links for this topic
      // RLS policy allows public access to notes for shared topics
      const { data: notesData, error: notesError } = await supabase
        .from("notes")
        .select("id, title, file_url, file_name, file_size, content, created_at, sort_order")
        .eq("topic_id", topicData.id)
        .or("file_url.not.is.null,content.not.is.null")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (notesError) {
        console.error("Error loading notes:", notesError);
        toast({
          title: "Error loading resources",
          description: notesError.message,
          variant: "destructive",
        });
      } else {
        // Filter to only include notes with file_url OR content that is a URL
        const filteredData = (notesData || []).filter((note) => {
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
      }
    } catch (error: any) {
      toast({
        title: "Error loading shared topic",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Extracts YouTube video ID from various YouTube URL formats.
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
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    return url;
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
    return url;
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
    return url;
  };

  /**
   * Extracts the storage path from a file_url.
   */
  const extractStoragePath = (fileUrl: string | null): string | null => {
    if (!fileUrl) return null;
    
    if (!fileUrl.startsWith("http")) {
      return fileUrl;
    }
    
    const match = fileUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/notes\/(.+)$/);
    return match ? match[1] : fileUrl;
  };

  /**
   * Generates a signed URL for downloading or previewing a file.
   * Note: This might fail for shared topics due to RLS policies.
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
        description: "This file may not be accessible. Please contact the topic owner.",
        variant: "destructive",
      });
      return null;
    }
  };

  /**
   * Handles file preview and link opening.
   * For link-based notes, converts URLs to viewable formats.
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

    const signedUrl = await getSignedUrl(storagePath, 7200);
    if (!signedUrl) return;

    setPreviewNote(note);
    setPreviewUrl(signedUrl);
  };

  /**
   * Handles file download.
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

    const link = document.createElement("a");
    link.href = signedUrl;
    link.download = note.file_name || note.title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Determines if a file can be previewed inline (PDFs).
   */
  const canPreviewInline = (fileName: string | null): boolean => {
    if (!fileName) return false;
    return fileName.toLowerCase().endsWith(".pdf");
  };

  /**
   * Gets Office Online viewer URL for PPT/PPTX files.
   */
  const getOfficeOnlineUrl = (signedUrl: string): string => {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`;
  };

  if (loading) {
    return (
      <AppSidebarLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppSidebarLayout>
    );
  }

  if (!topic) {
    return (
      <AppSidebarLayout>
        <main className="container mx-auto px-4 py-8">
          <Card className="p-12 text-center">
            <h2 className="text-xl font-display font-semibold mb-2">
              Topic not found
            </h2>
            <p className="text-muted-foreground mb-4">
              This shared topic may have been removed or the link is invalid.
            </p>
            <Button onClick={() => navigate("/")}>
              Go to Home
            </Button>
          </Card>
        </main>
      </AppSidebarLayout>
    );
  }

  return (
    <AppSidebarLayout>
      <main className="container mx-auto px-4 py-8 space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                {subject?.name || "Shared Topic"}
              </p>
              <h1 className="text-2xl font-display font-bold">
                {topic.name}
              </h1>
              {topic.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {topic.description}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* YouTube Video Section */}
        {topic.video_url && extractYouTubeVideoId(topic.video_url) && (
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

        {/* Resources Section (PPTs and Links) */}
        <section>
          <h2 className="text-sm font-semibold mb-3">Topic Resources</h2>
          {notes.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              No resources available for this shared topic.
            </Card>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => {
                const isLink = isLinkNote(note);
                return (
                  <Card key={note.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
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
                    // Link-based notes
                    isYouTubeUrl(previewNote.content || "") ? (
                      // YouTube links
                      <div className="w-full flex flex-col border rounded bg-muted overflow-hidden">
                        <div className="aspect-video w-full bg-black">
                          <iframe
                            src={previewUrl}
                            className="w-full h-full border-0 rounded"
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
                      // Google Drive links
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
                      // Direct file URLs
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
                      // Other links
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
                    // PDF files
                    <iframe
                      src={previewUrl}
                      className="w-full h-full border rounded"
                      title={previewNote.title}
                    />
                  ) : previewNote.file_name?.toLowerCase().endsWith(".ppt") ||
                    previewNote.file_name?.toLowerCase().endsWith(".pptx") ? (
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

export default SharedTopicPage;

