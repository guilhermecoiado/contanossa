import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BrowserRouter, Routes, Route, Outlet, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PlanRoute } from "@/components/PlanRoute";
import LoginPage from "./pages/LoginPage";
import ResetPassword from "./pages/ResetPassword";
import CompleteRegistrationPage from "./pages/CompleteRegistrationPage";
import SignupSuccessPage from "./pages/SignupSuccessPage";
import Dashboard from "./pages/Dashboard";
import MembersPage from "./pages/MembersPage";
import IncomesPage from "./pages/IncomesPage";
import ExpensesPage from "./pages/ExpensesPage";
import BanksPage from "./pages/BanksPage";
import CardsPage from "./pages/CardsPage";
import InvestmentsPage from "./pages/InvestmentsPage";
import DebtsPage from './pages/DebtsPage';
import FamilyHealthPage from "./pages/FamilyHealthPage";
import PlanPage from "./pages/PlanPage";
import CategoriesPage from "./pages/CategoriesPage";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PwaInstallPrompt />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <ScrollToTop />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/complete-registration" element={<CompleteRegistrationPage />} />
              <Route path="/signup/success" element={<SignupSuccessPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <Outlet />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/members" element={<MembersPage />} />
                <Route path="/incomes" element={<IncomesPage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/banks" element={<PlanRoute allow={["full"]}><BanksPage /></PlanRoute>} />
                <Route path="/cards" element={<PlanRoute allow={["full"]}><CardsPage /></PlanRoute>} />
                <Route path="/investments" element={<PlanRoute allow={["full"]}><InvestmentsPage /></PlanRoute>} />
                <Route path="/debts" element={<PlanRoute allow={["full"]}><DebtsPage /></PlanRoute>} />
                <Route path="/family-health" element={<FamilyHealthPage />} />
                <Route path="/plan" element={<PlanPage />} />
                <Route path="/categories" element={<CategoriesPage />} />

              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
