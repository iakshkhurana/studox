import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PomodoroPage from "./pages/PomodoroPage";
import AITutorPage from "./pages/AITutorPage";
import SubjectPage from "./pages/SubjectPage";
import TopicResourcesPage from "./pages/TopicResourcesPage";
import SharedTopicPage from "./pages/SharedTopicPage";
import TopicPlaylistPage from "./pages/TopicPlaylistPage";
import DatesheetPage from "./pages/DatesheetPage";
import CalendarPage from "./pages/CalendarPage";
import NotFound from "./pages/NotFound";
import HistoryPage from "./pages/HistoryPage";
import HelpPage from "./pages/HelpPage";
import SettingsPage from "./pages/SettingsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/pomodoro" element={<PomodoroPage />} />
          <Route path="/ai-tutor" element={<AITutorPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/datesheet" element={<DatesheetPage />} />
          {/* More specific topic-resources route should be defined before the generic subject route */}
          <Route path="/subject/:subjectId/topic/:topicId/resources" element={<TopicResourcesPage />} />
          <Route path="/subject/:subjectId/playlist/:topicName" element={<TopicPlaylistPage />} />
          <Route path="/shared/topic/:shareToken" element={<SharedTopicPage />} />
          <Route path="/subject/:id" element={<SubjectPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
