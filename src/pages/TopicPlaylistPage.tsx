import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, FileText, Link as LinkIcon } from "lucide-react";
import { AppSidebarLayout } from "@/components/AppSidebarLayout";

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
  content: string | null;
  topic_id: string;
}

interface Subject {
  id: string;
  name: string;
}

/**
 * Topic playlist page that compiles all topics with the same name
 * and displays their videos and resources in a playlist format.
 */
const TopicPlaylistPage = () => {
  const { subjectId, topicName } = useParams<{ subjectId: string; topicName: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [allResources, setAllResources] = useState<TopicNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  useEffect(() => {
    if (user && subjectId && topicName) {
      loadPlaylistData();
    }
  }, [user, subjectId, topicName]);

  /**
   * Loads all topics with the same name and their resources.
   */
  const loadPlaylistData = async () => {
    if (!subjectId || !topicName || !user) return;

    try {
      // Decode the topic name from URL
      const decodedTopicName = decodeURIComponent(topicName);

      // Load subject
      const { data: subjectData, error: subjectError } = await supabase
        .from("subjects")
        .select("id, name")
        .eq("id", subjectId)
        .single();

      if (subjectError) throw subjectError;
      setSubject(subjectData);

      // Load all topics with the same name
      const { data: topicsData, error: topicsError } = await supabase
        .from("topics")
        .select("id, name, description, video_url, subject_id")
        .eq("subject_id", subjectId)
        .eq("user_id", user.id)
        .eq("name", decodedTopicName)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (topicsError) throw topicsError;
      setTopics(topicsData || []);

      // Load all resources (notes/PPTs/links) from all topics with this name
      if (topicsData && topicsData.length > 0) {
        const topicIds = topicsData.map(t => t.id);
        
        const { data: notesData, error: notesError } = await supabase
          .from("notes")
          .select("id, title, file_url, file_name, content, topic_id")
          .in("topic_id", topicIds)
          .eq("user_id", user.id)
          .or("file_url.not.is.null,content.not.is.null")
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });

        if (notesError) {
          console.error("Error loading resources:", notesError);
        } else {
          // Filter to only include notes with file_url OR content that is a URL
          const filteredData = (notesData || []).filter((note) => {
            if (note.file_url) return true;
            if (note.content && (note.content.startsWith("http://") || note.content.startsWith("https://"))) {
              return true;
            }
            return false;
          });
          setAllResources(filteredData);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error loading playlist",
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
   * Gets all videos from topics (filtering out nulls).
   */
  const getVideos = (): string[] => {
    return topics
      .map(topic => topic.video_url)
      .filter((url): url is string => url !== null && extractYouTubeVideoId(url) !== null);
  };

  /**
   * Checks if a note is a link.
   */
  const isLinkNote = (note: TopicNote): boolean => {
    return !note.file_url && !!note.content && (note.content.startsWith("http://") || note.content.startsWith("https://"));
  };

  /**
   * Checks if a URL is a YouTube URL.
   */
  const isYouTubeUrl = (url: string): boolean => {
    return /(?:youtube\.com|youtu\.be)/.test(url);
  };

  const videos = getVideos();
  const currentVideo = videos[currentVideoIndex] || null;
  const currentVideoId = currentVideo ? extractYouTubeVideoId(currentVideo) : null;

  if (loading) {
    return (
      <AppSidebarLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppSidebarLayout>
    );
  }

  if (topics.length === 0) {
    return (
      <AppSidebarLayout>
        <main className="container mx-auto px-4 py-8">
          <Card className="p-12 text-center">
            <h2 className="text-xl font-display font-semibold mb-2">
              No topics found
            </h2>
            <p className="text-muted-foreground mb-4">
              No topics found with this name.
            </p>
            <Button onClick={() => navigate(`/subject/${subjectId}`)}>
              Go Back
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
            <Button variant="ghost" size="icon" onClick={() => navigate(`/subject/${subjectId}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                {subject?.name || "Subject"} - Playlist
              </p>
              <h1 className="text-2xl font-display font-bold">
                {topics[0].name}
              </h1>
              {topics.length > 1 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {topics.length} topics compiled
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Video Playlist Section */}
        {videos.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3">
              Video Playlist ({videos.length} {videos.length === 1 ? "video" : "videos"})
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Video Player */}
              <div className="lg:col-span-2">
                <Card className="p-4">
                  {currentVideoId ? (
                    <div className="aspect-video w-full bg-black rounded">
                      <iframe
                        src={getYouTubeEmbedUrl(currentVideoId)}
                        className="w-full h-full border-0 rounded"
                        title={`${topics[0].name} - Video ${currentVideoIndex + 1}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="aspect-video w-full bg-muted rounded flex items-center justify-center">
                      <p className="text-muted-foreground">No video selected</p>
                    </div>
                  )}
                </Card>
              </div>

              {/* Playlist Sidebar */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                  Playlist
                </h3>
                {videos.map((videoUrl, index) => {
                  const videoId = extractYouTubeVideoId(videoUrl);
                  const isActive = index === currentVideoIndex;
                  
                  return (
                    <Card
                      key={index}
                      className={`p-3 cursor-pointer transition-colors ${
                        isActive ? "border-primary bg-primary/5" : "hover:bg-muted"
                      }`}
                      onClick={() => setCurrentVideoIndex(index)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                          isActive ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}>
                          {isActive ? (
                            <Play className="w-4 h-4 fill-current" />
                          ) : (
                            <span className="text-xs font-mono">{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            Video {index + 1}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {videoUrl}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* All Resources Section */}
        {allResources.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3">
              All Resources ({allResources.length} {allResources.length === 1 ? "resource" : "resources"})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allResources.map((resource) => {
                const isLink = isLinkNote(resource);
                const isYouTube = isLink && resource.content && isYouTubeUrl(resource.content);
                
                return (
                  <Card
                    key={resource.id}
                    className="p-4 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => {
                      // Navigate to the topic resources page
                      navigate(`/subject/${subjectId}/topic/${resource.topic_id}/resources`);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isLink 
                          ? (isYouTube ? "bg-red-100 dark:bg-red-900" : "bg-blue-100 dark:bg-blue-900")
                          : "bg-primary/10"
                      }`}>
                        {isLink ? (
                          isYouTube ? (
                            <Play className="w-4 h-4 text-red-600 dark:text-red-400" />
                          ) : (
                            <LinkIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          )
                        ) : (
                          <FileText className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{resource.title}</p>
                        {isLink ? (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {resource.content}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">
                            {resource.file_name || "File"}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty State */}
        {videos.length === 0 && allResources.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">
              No videos or resources found in this playlist.
            </p>
          </Card>
        )}
      </main>
    </AppSidebarLayout>
  );
};

export default TopicPlaylistPage;

