import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Bot } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export const ChatMessage = ({ role, content }: ChatMessageProps) => {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 py-4 px-4 rounded-xl animate-in fade-in slide-in-from-bottom-2",
        isUser ? "bg-primary/5 ml-8" : "bg-card mr-8"
      )}
    >
      <Avatar className={cn("w-8 h-8 shrink-0", !isUser && "bg-primary")}>
        <AvatarFallback>
          {isUser ? (
            <User className="w-4 h-4" />
          ) : (
            <Bot className="w-4 h-4 text-primary-foreground" />
          )}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium">{isUser ? "You" : "AI Tutor"}</p>
        <div className="text-sm leading-relaxed whitespace-pre-wrap">{content}</div>
      </div>
    </div>
  );
};
