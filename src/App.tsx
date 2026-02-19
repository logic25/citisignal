import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardOverview from "@/pages/dashboard/DashboardOverview";
import PropertiesPage from "@/pages/dashboard/PropertiesPage";
import PropertyDetailPage from "@/pages/dashboard/PropertyDetailPage";
// Portfolio pages preserved in src/pages/dashboard/PortfoliosPage.tsx & PortfolioDetailPage.tsx
import ApplicationsPage from "@/pages/dashboard/ApplicationsPage";
import ViolationsPage from "@/pages/dashboard/ViolationsPage";
// DD Reports preserved for BinCheckNYC extraction
// import DDReportsPage from "@/pages/dashboard/DDReportsPage";
import VendorsPage from "@/pages/dashboard/VendorsPage";
import VendorDetailPage from "@/pages/dashboard/VendorDetailPage";
import WorkOrdersPage from "@/pages/dashboard/WorkOrdersPage";
import CAMPage from "@/pages/dashboard/CAMPage";
import OwnerStatementsPage from "@/pages/dashboard/OwnerStatementsPage";
import ReportBuilderPage from "@/pages/dashboard/ReportBuilderPage";
import TaxesPage from "@/pages/dashboard/TaxesPage";
import InsurancePage from "@/pages/dashboard/InsurancePage";
import SettingsPage from "@/pages/dashboard/SettingsPage";
import CalendarPage from "@/pages/dashboard/CalendarPage";
import NotificationsPage from "@/pages/dashboard/NotificationsPage";
import HelpCenterPage from "@/pages/dashboard/HelpCenterPage";
import AdminPage from "@/pages/dashboard/admin/AdminPage";
import AdminUserDetailPage from "@/pages/dashboard/admin/AdminUserDetailPage";
import TenantsPage from "@/pages/dashboard/TenantsPage";
import SignPO from "./pages/SignPO";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardOverview />} />
              <Route path="properties" element={<PropertiesPage />} />
              <Route path="properties/:id" element={<PropertyDetailPage />} />
              {/* Portfolio routes removed – files preserved for future use */}
              <Route path="applications" element={<ApplicationsPage />} />
              <Route path="violations" element={<ViolationsPage />} />
              {/* DD Reports route removed – code preserved for BinCheckNYC */}
              <Route path="vendors" element={<VendorsPage />} />
              <Route path="vendors/:id" element={<VendorDetailPage />} />
              <Route path="work-orders" element={<WorkOrdersPage />} />
              <Route path="cam" element={<CAMPage />} />
              <Route path="owner-statements" element={<OwnerStatementsPage />} />
              <Route path="reports" element={<ReportBuilderPage />} />
              <Route path="taxes" element={<TaxesPage />} />
              <Route path="insurance" element={<InsurancePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="help" element={<HelpCenterPage />} />
              <Route path="tenants" element={<TenantsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="admin/users/:userId" element={<AdminUserDetailPage />} />
            </Route>
            <Route path="/sign-po/:token" element={<SignPO />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
