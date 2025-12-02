import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, BookOpen, ChevronUp, ChevronDown, Share2, Copy, Check, ListVideo } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AppSidebarLayout } from "@/components/AppSidebarLayout";

interface Subject {
  id: string;
  name: string;
  description: string | null;
  color: string;
}

interface Topic {
  id: string;
  name: string;
  description: string | null;
  revision_count: number;
  last_revised_at: string | null;
  video_url: string | null;
  sort_order: number | null;
  share_token: string | null;
  is_shared: boolean | null;
}

const SubjectPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTopic, setNewTopic] = useState({ name: "", description: "", video_url: "" });
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedTopicForShare, setSelectedTopicForShare] = useState<Topic | null>(null);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [shortenedUrl, setShortenedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user && id) {
      loadSubjectAndTopics();
    }
  }, [user, id]);

  /**
   * Loads the current subject and its topics.
   * Orders topics by sort_order (ascending), then by created_at (descending) as fallback.
   */
  const loadSubjectAndTopics = async () => {
    try {
      const [subjectRes, topicsRes] = await Promise.all([
        supabase.from("subjects").select("*").eq("id", id).single(),
        supabase.from("topics")
          .select("*")
          .eq("subject_id", id)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }),
      ]);

      if (subjectRes.error) throw subjectRes.error;
      if (topicsRes.error) throw topicsRes.error;

      setSubject(subjectRes.data);
      
      // Ensure all topics have a sort_order value and is_shared is boolean (not null)
      const topicsWithSortOrder = (topicsRes.data || []).map((topic, index) => ({
        ...topic,
        sort_order: topic.sort_order ?? index + 1,
        is_shared: topic.is_shared ?? false, // Ensure boolean, not null
      }));
      
      setTopics(topicsWithSortOrder);
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Counts how many topics have the same name as the given topic.
   */
  const getTopicNameCount = (topicName: string): number => {
    return topics.filter(t => t.name === topicName).length;
  };

  /**
   * Validates YouTube URL format and extracts video ID if valid.
   * Supports both youtube.com/watch?v= and youtu.be/ formats.
   */
  const validateYouTubeUrl = (url: string): string | null => {
    if (!url.trim()) return null;
    
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(youtubeRegex);
    return match ? match[1] : null;
  };

  /**
   * Handles topic creation with video URL and sort_order.
   */
  const handleCreateTopic = async () => {
    if (!newTopic.name.trim()) {
      toast({
        title: "Error",
        description: "Topic name is required",
        variant: "destructive",
      });
      return;
    }

    // Validate YouTube URL if provided
    let videoUrl = newTopic.video_url?.trim() || null;
    if (videoUrl) {
      const videoId = validateYouTubeUrl(videoUrl);
      if (!videoId) {
        toast({
          title: "Invalid YouTube URL",
          description: "Please enter a valid YouTube video URL",
          variant: "destructive",
        });
        return;
      }
      // Normalize to embeddable format
      videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }

    try {
      // Get the maximum sort_order for this subject to place new topic at the end
      const { data: existingTopics } = await supabase
        .from("topics")
        .select("sort_order")
        .eq("subject_id", id!)
        .order("sort_order", { ascending: false })
        .limit(1);

      const maxSortOrder = existingTopics && existingTopics.length > 0 
        ? (existingTopics[0].sort_order ?? 0)
        : 0;

      const { error } = await supabase.from("topics").insert({
        name: newTopic.name,
        description: newTopic.description || null,
        video_url: videoUrl,
        subject_id: id!,
        user_id: user!.id,
        sort_order: maxSortOrder + 1,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Topic created successfully",
      });

      setDialogOpen(false);
      setNewTopic({ name: "", description: "", video_url: "" });
      loadSubjectAndTopics();
    } catch (error: any) {
      toast({
        title: "Error creating topic",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleIncrementRevision = async (topicId: string, currentCount: number) => {
    try {
      const { error } = await supabase
        .from("topics")
        .update({
          revision_count: currentCount + 1,
          last_revised_at: new Date().toISOString(),
        })
        .eq("id", topicId);

      if (error) throw error;

      setTopics(topics.map(t => 
        t.id === topicId 
          ? { ...t, revision_count: currentCount + 1, last_revised_at: new Date().toISOString() }
          : t
      ));

      toast({
        title: "Revision recorded",
        description: "Keep up the great work!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Handles moving a topic up in the sort order.
   */
  const handleMoveUp = async (topicId: string, currentIndex: number) => {
    if (currentIndex === 0) return; // Already at the top

    const currentTopic = topics[currentIndex];
    const previousTopic = topics[currentIndex - 1];

    try {
      // Swap sort_order values
      const [currentSortOrder, previousSortOrder] = [
        currentTopic.sort_order ?? currentIndex + 1,
        previousTopic.sort_order ?? currentIndex,
      ];

      await Promise.all([
        supabase.from("topics").update({ sort_order: previousSortOrder }).eq("id", currentTopic.id),
        supabase.from("topics").update({ sort_order: currentSortOrder }).eq("id", previousTopic.id),
      ]);

      loadSubjectAndTopics();
    } catch (error: any) {
      toast({
        title: "Error reordering topic",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Handles moving a topic down in the sort order.
   */
  const handleMoveDown = async (topicId: string, currentIndex: number) => {
    if (currentIndex === topics.length - 1) return; // Already at the bottom

    const currentTopic = topics[currentIndex];
    const nextTopic = topics[currentIndex + 1];

    try {
      // Swap sort_order values
      const [currentSortOrder, nextSortOrder] = [
        currentTopic.sort_order ?? currentIndex + 1,
        nextTopic.sort_order ?? currentIndex + 2,
      ];

      await Promise.all([
        supabase.from("topics").update({ sort_order: nextSortOrder }).eq("id", currentTopic.id),
        supabase.from("topics").update({ sort_order: currentSortOrder }).eq("id", nextTopic.id),
      ]);

      loadSubjectAndTopics();
    } catch (error: any) {
      toast({
        title: "Error reordering topic",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Shortens a URL using is.gd API (free URL shortener).
   * Falls back to original URL if shortening fails.
   */
  const shortenUrl = async (url: string): Promise<string> => {
    try {
      const response = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (data.shorturl) {
        return data.shorturl;
      }
    } catch (error) {
      console.error("Error shortening URL:", error);
    }
    return url; // Return original URL if shortening fails
  };

  /**
   * Handles enabling/disabling sharing for a topic.
   */
  const handleToggleShare = async (topic: Topic) => {
    try {
      // Treat null as false for is_shared
      const currentIsShared = topic.is_shared ?? false;
      const newIsShared = !currentIsShared;
      const shareToken = newIsShared && !topic.share_token 
        ? crypto.randomUUID() 
        : topic.share_token;

      const { error, data } = await supabase
        .from("topics")
        .update({
          is_shared: newIsShared,
          share_token: shareToken,
        })
        .eq("id", topic.id)
        .select()
        .single();

      if (error) throw error;

      // Update local state immediately with the updated topic
      // Ensure boolean values are properly set (not null)
      const updatedTopic = { 
        ...topic, 
        is_shared: newIsShared, 
        share_token: shareToken 
      };
      setTopics(topics.map(t => t.id === topic.id ? updatedTopic : t));

      if (newIsShared) {
        // Generate the full share URL
        const fullShareUrl = `${window.location.origin}/shared/topic/${shareToken}`;
        
        // Shorten the URL
        const shortUrl = await shortenUrl(fullShareUrl);
        setShortenedUrl(shortUrl);
        
        // Set the selected topic and open dialog
        setSelectedTopicForShare(updatedTopic);
        setShareDialogOpen(true);
        
        // Automatically copy the shortened link to clipboard
        try {
          await navigator.clipboard.writeText(shortUrl);
          setShareLinkCopied(true);
          setTimeout(() => setShareLinkCopied(false), 3000);
          toast({
            title: "Sharing enabled",
            description: "Shortened share link has been copied to clipboard",
          });
        } catch (clipboardError) {
          // If clipboard fails, still show the dialog
          toast({
            title: "Sharing enabled",
            description: "Please copy the link manually",
          });
        }
      } else {
        setShortenedUrl(null);
        toast({
          title: "Sharing disabled",
          description: "This topic is no longer shared",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error updating share settings",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Copies the share link to clipboard (shortened version).
   */
  const handleCopyShareLink = async (shareToken: string) => {
    const fullShareUrl = `${window.location.origin}/shared/topic/${shareToken}`;
    try {
      // Use shortened URL if available, otherwise shorten it
      let urlToCopy = shortenedUrl;
      if (!urlToCopy || urlToCopy === fullShareUrl) {
        urlToCopy = await shortenUrl(fullShareUrl);
        setShortenedUrl(urlToCopy);
      }
      
      await navigator.clipboard.writeText(urlToCopy);
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 3000);
      toast({
        title: "Link copied",
        description: "Shortened share link has been copied to clipboard",
      });
    } catch (error) {
      // Fallback to full URL if shortening fails
      try {
        await navigator.clipboard.writeText(fullShareUrl);
        setShareLinkCopied(true);
        setTimeout(() => setShareLinkCopied(false), 3000);
        toast({
          title: "Link copied",
          description: "Share link has been copied to clipboard",
        });
      } catch (clipboardError) {
        toast({
          title: "Error copying link",
          description: "Please copy the link manually",
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    try {
      const { error } = await supabase.from("topics").delete().eq("id", topicId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Topic deleted successfully",
      });

      loadSubjectAndTopics();
    } catch (error: any) {
      toast({
        title: "Error deleting topic",
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
      <main className="container mx-auto px-4 py-8">
        {subject && (
          <header className="mb-8">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: subject.color }}
                />
                <div>
                  <h1 className="text-2xl font-display font-bold">{subject.name}</h1>
                  {subject.description && (
                    <p className="text-sm text-muted-foreground">{subject.description}</p>
                  )}
                </div>
              </div>
            </div>
          </header>
        )}

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-display font-bold">Topics</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Topic
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Topic</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Topic Name</Label>
                  <Input
                    id="name"
                    value={newTopic.name}
                    onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
                    placeholder="e.g., Calculus Basics"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={newTopic.description}
                    onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })}
                    placeholder="Brief description of what this topic covers"
                  />
                </div>
                <div>
                  <Label htmlFor="video_url">YouTube Video URL (Optional)</Label>
                  <Input
                    id="video_url"
                    type="url"
                    value={newTopic.video_url}
                    onChange={(e) => setNewTopic({ ...newTopic, video_url: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Add a YouTube video link related to this topic
                  </p>
                </div>
                <Button onClick={handleCreateTopic} className="w-full">
                  Create Topic
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {topics.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-display font-semibold mb-2">
              No topics yet
            </h3>
            <p className="text-muted-foreground mb-4">
              Start by creating your first topic to track
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Topic
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topics.map((topic, index) => (
              <Card
                key={topic.id}
                className="p-6 card-elevated cursor-pointer"
                onClick={() => navigate(`/subject/${id}/topic/${topic.id}/resources`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-display font-semibold text-lg mb-1">
                      {topic.name}
                    </h3>
                    {topic.description && (
                      <p className="text-sm text-muted-foreground">
                        {topic.description}
                      </p>
                    )}
                    {topic.video_url && (
                      <p className="text-xs text-primary mt-1 flex items-center gap-1">
                        <span>📹 Video available</span>
                      </p>
                    )}
                    {getTopicNameCount(topic.name) > 1 && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                        <ListVideo className="w-3 h-3" />
                        <span>{getTopicNameCount(topic.name)} topics - View playlist</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {getTopicNameCount(topic.name) > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/subject/${id}/playlist/${encodeURIComponent(topic.name)}`);
                        }}
                        title="View playlist"
                      >
                        <ListVideo className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleShare(topic);
                      }}
                      title={(topic.is_shared ?? false) ? "Sharing enabled" : "Share topic"}
                    >
                      <Share2 className={`w-4 h-4 ${(topic.is_shared ?? false) ? "text-primary" : ""}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTopic(topic.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Revisions</span>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleIncrementRevision(topic.id, topic.revision_count);
                      }}
                      className="font-mono font-bold"
                    >
                      {topic.revision_count} +
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Sort</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveUp(topic.id, index);
                        }}
                        disabled={index === 0}
                        title="Move up"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveDown(topic.id, index);
                        }}
                        disabled={index === topics.length - 1}
                        title="Move down"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  {topic.last_revised_at && (
                    <p className="text-xs text-muted-foreground">
                      Last revised: {new Date(topic.last_revised_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Share Dialog */}
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Topic</DialogTitle>
            </DialogHeader>
            {selectedTopicForShare && selectedTopicForShare.share_token && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Share this link to allow others to view this topic (including PPTs and videos):
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={shortenedUrl || `${window.location.origin}/shared/topic/${selectedTopicForShare.share_token}`}
                      readOnly
                      className="font-mono text-xs"
                      id="share-link-input"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopyShareLink(selectedTopicForShare.share_token!)}
                      title="Copy shortened link"
                    >
                      {shareLinkCopied ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  {shareLinkCopied && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Shortened link copied to clipboard!
                    </p>
                  )}
                  {shortenedUrl && shortenedUrl !== `${window.location.origin}/shared/topic/${selectedTopicForShare.share_token}` && (
                    <p className="text-xs text-muted-foreground">
                      Full link: <span className="font-mono">{`${window.location.origin}/shared/topic/${selectedTopicForShare.share_token}`}</span>
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleToggleShare(selectedTopicForShare)}
                  className="w-full"
                >
                  Disable Sharing
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </AppSidebarLayout>
  );
};

export default SubjectPage;
