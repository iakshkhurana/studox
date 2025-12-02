import { PomodoroTimer } from "@/components/Pomodoro/PomodoroTimer";
import { StopwatchTimer } from "@/components/Pomodoro/StopwatchTimer";
import { AppSidebarLayout } from "@/components/AppSidebarLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PomodoroPage = () => {
  /**
   * Pomodoro page is rendered inside the shared app sidebar layout so the user
   * keeps the same navigation chrome while using the timer.
   */
  return (
    <AppSidebarLayout>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-display font-bold mb-4">Timer</h1>
            <p className="text-muted-foreground text-lg">
              Use Pomodoro cycles or a simple stopwatch to stay focused and productive.
            </p>
          </div>

          {/**
           * Timer suite: user can switch between Pomodoro and Stopwatch while
           * staying on the same route and within the shared app layout.
           */}
          <Tabs defaultValue="pomodoro" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="pomodoro">Pomodoro</TabsTrigger>
              <TabsTrigger value="stopwatch">Stopwatch</TabsTrigger>
            </TabsList>

            <TabsContent value="pomodoro">
              <PomodoroTimer />
            </TabsContent>
            <TabsContent value="stopwatch">
              <StopwatchTimer />
            </TabsContent>
          </Tabs>

          <div className="mt-12 p-6 bg-muted/30 rounded-xl">
            <h3 className="font-display font-semibold text-lg mb-3">How it works</h3>
            <ol className="space-y-2 text-muted-foreground">
              <li>1. Focus for 25 minutes on a single task</li>
              <li>2. Take a 5-minute break when the timer ends</li>
              <li>3. Repeat this cycle to maintain high productivity</li>
              <li>4. After 4 cycles, take a longer 15-30 minute break</li>
            </ol>
          </div>
        </div>
      </main>
    </AppSidebarLayout>
  );
};

export default PomodoroPage;
