import { Switch, Route, Router as WouterRouter, Link } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Pages
import { HomePage } from "./pages/HomePage";
import { BoardPage } from "./pages/BoardPage";
import { SchedulePage } from "./pages/SchedulePage";
import { FinancePage } from "./pages/FinancePage";
import { MealsPage } from "./pages/MealsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NoticesPage } from "./pages/NoticesPage";
import { ProfileEditPage } from "./pages/ProfileEditPage";
import { AcademicCalendarPage } from "./pages/AcademicCalendarPage";
import { BusPage } from "./pages/BusPage";
import { CampusMapPage } from "./pages/CampusMapPage";
import { PostDetailPage } from "./pages/PostDetailPage";
import { NotificationSettingsPage } from "./pages/NotificationSettingsPage";
import { Layout } from "./components/Layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function NotFound() {
  return (
    <Layout>
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-xl font-bold text-foreground mb-2">페이지를 찾을 수 없습니다</p>
        <p className="text-muted-foreground mb-8">요청하신 페이지가 사라졌거나 잘못된 경로입니다.</p>
        <Link href="/" className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all">
          홈으로 돌아가기
        </Link>
      </div>
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/notices" component={NoticesPage} />
      <Route path="/schedule" component={SchedulePage} />
      <Route path="/board" component={BoardPage} />
      <Route path="/board/:id" component={PostDetailPage} />
      <Route path="/finance" component={FinancePage} />
      <Route path="/meals" component={MealsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/settings/profile" component={ProfileEditPage} />
      <Route path="/settings/notifications" component={NotificationSettingsPage} />
      <Route path="/academic-calendar" component={AcademicCalendarPage} />
      <Route path="/bus" component={BusPage} />
      <Route path="/campus-map" component={CampusMapPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
