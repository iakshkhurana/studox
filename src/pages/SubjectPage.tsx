import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, BookOpen } from "lucide-react";
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
  const [newTopic, setNewTopic] = useState({ name: "", description: "" });

  useEffect(() => {
    if (user && id) {
      loadSubjectAndTopics();
    }
  }, [user, id]);

  /**
   * Loads the current subject and its topics.
   */
  const loadSubjectAndTopics = async () => {
    try {
      const [subjectRes, topicsRes] = await Promise.all([
        supabase.from("subjects").select("*").eq("id", id).single(),
        supabase.from("topics").select("*").eq("subject_id", id).order("created_at", { ascending: false }),
      ]);

      if (subjectRes.error) throw subjectRes.error;
      if (topicsRes.error) throw topicsRes.error;

      setSubject(subjectRes.data);
      setTopics(topicsRes.data || []);
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

  const handleCreateTopic = async () => {
    if (!newTopic.name.trim()) {
      toast({
        title: "Error",
        description: "Topic name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("topics").insert({
        name: newTopic.name,
        description: newTopic.description,
        subject_id: id!,
        user_id: user!.id,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Topic created successfully",
      });

      setDialogOpen(false);
      setNewTopic({ name: "", description: "" });
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
            {topics.map((topic) => (
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
                  </div>
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
      </main>
    </AppSidebarLayout>
  );
};

export default SubjectPage;
