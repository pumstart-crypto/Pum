import { Switch, Route, Router as WouterRouter, Link, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

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
import { NotificationsInboxPage } from "./pages/NotificationsInboxPage";
import { PrivacySettingsPage } from "./pages/PrivacySettingsPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
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
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#021526]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center">
            <span className="text-3xl">🎓</span>
          </div>
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* 공개 라우트 */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />

      {/* 인증 필요 라우트 */}
      <Route path="/">
        {user ? <HomePage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/notices">
        {user ? <NoticesPage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/schedule">
        {user ? <SchedulePage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/board">
        {user ? <BoardPage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/board/:id">
        {user ? <PostDetailPage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/finance">
        {user ? <FinancePage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/meals">
        {user ? <MealsPage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/settings">
        {user ? <SettingsPage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/settings/profile">
        {user ? <ProfileEditPage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/notifications">
        {user ? <NotificationsInboxPage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/settings/notifications">
        {user ? <NotificationSettingsPage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/settings/privacy">
        {user ? <PrivacySettingsPage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/academic-calendar">
        {user ? <AcademicCalendarPage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/bus">
        {user ? <BusPage /> : <Redirect to="/login" />}
      </Route>
      <Route path="/campus-map">
        {user ? <CampusMapPage /> : <Redirect to="/login" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
