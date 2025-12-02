import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { BookOpen, Clock, MessageSquare, CalendarDays, History, HelpCircle, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

/**
 * High-level application layout that adds a navigational sidebar.
 *
 * This component centralizes the sidebar structure so that pages such as the
 * dashboard and subject view can share the same navigation (Dashboard, Pomodoro,
 * AI Tutor). The sidebar works on both desktop and mobile using the shared
 * shadcn-based sidebar primitives.
 */
interface AppSidebarLayoutProps {
  /** Main page content to render to the right of the sidebar. */
  children: ReactNode;
  /** Optional custom className for the inset main area. */
  className?: string;
}

export const AppSidebarLayout = ({ children, className }: AppSidebarLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  /**
   * Helper to check if a link is active based on the current location pathname.
   * This keeps sidebar buttons visually in sync with routing.
   */
  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <SidebarProvider>
      <Sidebar className="border-r bg-sidebar text-sidebar-foreground" collapsible="offcanvas" variant="sidebar">
        <SidebarHeader className="h-16 px-4">
          <div className="flex w-full items-center justify-start">
            {/**
             * Sidebar brand: keep it minimal and text-only as requested.
             * We rely on the display font and weight to make "studox" stand out.
             */}
            <span className="font-display font-semibold text-2xl tracking-tight">
              studox
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent className="justify-between pb-4">
          <SidebarMenu className="px-2 pt-2 space-y-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isActive("/")}
                onClick={() => navigate("/")}
                className="cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isActive("/calendar")}
                onClick={() => navigate("/calendar")}
                className="cursor-pointer"
              >
                <CalendarDays className="w-4 h-4" />
                <span>Calendar</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isActive("/datesheet")}
                onClick={() => navigate("/datesheet")}
                className="cursor-pointer"
              >
                <CalendarDays className="w-4 h-4" />
                <span>Datesheet</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isActive("/pomodoro")}
                onClick={() => navigate("/pomodoro")}
                className="cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                <span>Timer</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isActive("/history")}
                onClick={() => navigate("/history")}
                className="cursor-pointer"
              >
                <History className="w-4 h-4" />
                <span>History</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isActive("/ai-tutor")}
                onClick={() => navigate("/ai-tutor")}
                className="cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>AI Tutor</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          <SidebarMenu className="px-2 space-y-1 text-xs">
            <SidebarMenuItem>
              <SidebarMenuButton
                className="cursor-pointer"
                isActive={isActive("/help")}
                onClick={() => navigate("/help")}
              >
                <HelpCircle className="w-4 h-4" />
                <span>Help</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="cursor-pointer"
                isActive={isActive("/settings")}
                onClick={() => navigate("/settings")}
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="cursor-pointer"
                onClick={() => signOut()}
              >
                <LogOut className="w-4 h-4" />
                <span>Log out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className={cn("bg-background", className)}>
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-20">
          <div className="px-4 py-3 flex items-center gap-3">
            <SidebarTrigger />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
};


