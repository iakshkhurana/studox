import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { MoreVertical, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SubjectCardProps {
  id: string;
  name: string;
  description?: string;
  color: string;
  topicsCount: number;
  completedTopics: number;
  onEdit: () => void;
  onDelete: () => void;
}

export const SubjectCard = ({
  id,
  name,
  description,
  color,
  topicsCount,
  completedTopics,
  onEdit,
  onDelete,
}: SubjectCardProps) => {
  const navigate = useNavigate();
  const progress = topicsCount > 0 ? (completedTopics / topicsCount) * 100 : 0;

  return (
    <Card className="p-6 card-elevated cursor-pointer" onClick={() => navigate(`/subject/${id}`)}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div>
            <h3 className="font-display font-semibold text-lg">{name}</h3>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>{topicsCount} topics</span>
          </div>
          <span className="text-muted-foreground">
            {completedTopics}/{topicsCount} completed
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    </Card>
  );
};
