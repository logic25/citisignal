import { Suspense, lazy } from "react";
import * as Sentry from "@sentry/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

// Eagerly load critical pages (landing + auth)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

// Eagerly load high-traffic dashboard pages
import DashboardOverview from "@/pages/dashboard/DashboardOverview";
import PropertiesPage from "@/pages/dashboard/PropertiesPage";
import PropertyDetailPage from "@/pages/dashboard/PropertyDetailPage";

const ApplicationsPage = lazy(() => import("@/pages/dashboard/ApplicationsPage"));
const ViolationsPage = lazy(() => import("@/pages/dashboard/ViolationsPage"));
const VendorsPage = lazy(() => import("@/pages/dashboard/VendorsPage"));
const VendorDetailPage = lazy(() => import("@/pages/dashboard/VendorDetailPage"));
const WorkOrdersPage = lazy(() => import("@/pages/dashboard/WorkOrdersPage"));
const CAMPage = lazy(() => import("@/pages/dashboard/CAMPage"));
const OwnerStatementsPage = lazy(() => import("@/pages/dashboard/OwnerStatementsPage"));
const ReportBuilderPage = lazy(() => import("@/pages/dashboard/ReportBuilderPage"));
const TaxesPage = lazy(() => import("@/pages/dashboard/TaxesPage"));
const InsurancePage = lazy(() => import("@/pages/dashboard/InsurancePage"));
const SettingsPage = lazy(() => import("@/pages/dashboard/SettingsPage"));
const CalendarPage = lazy(() => import("@/pages/dashboard/CalendarPage"));
const NotificationsPage = lazy(() => import("@/pages/dashboard/NotificationsPage"));
const HelpCenterPage = lazy(() => import("@/pages/dashboard/HelpCenterPage"));
const AdminPage = lazy(() => import("@/pages/dashboard/admin/AdminPage"));
const AdminUserDetailPage = lazy(() => import("@/pages/dashboard/admin/AdminUserDetailPage"));
const TenantsPage = lazy(() => import("@/pages/dashboard/TenantsPage"));
const SignPO = lazy(() => import("./pages/SignPO"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const ComplianceGuidePage = lazy(() => import("./pages/dashboard/ComplianceGuidePage"));

const queryClient = new QueryClient();

const App = () => (
  <Sentry.ErrorBoundary fallback={<div className="min-h-screen flex items-center justify-center bg-background text-foreground"><p>Something went wrong. Please refresh the page.</p></div>}>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
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
                <Route path="applications" element={<ApplicationsPage />} />
                <Route path="violations" element={<ViolationsPage />} />
                <Route path="vendors" element={<VendorsPage />} />
                <Route path="vendors/:id" element={<VendorDetailPage />} />
                <Route path="work-orders" element={<WorkOrdersPage />} />
                <Route path="cam" element={<CAMPage />} />
                <Route path="owner-statements" element={<OwnerStatementsPage />} />
                {/* DD Reports hidden — overlaps with BinCheck NYC product */}
                {/* <Route path="reports" element={<ReportBuilderPage />} /> */}
                <Route path="taxes" element={<TaxesPage />} />
                <Route path="insurance" element={<InsurancePage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="help" element={<HelpCenterPage />} />
                <Route path="tenants" element={<TenantsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="compliance-guide" element={<ComplianceGuidePage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="admin/users/:userId" element={<AdminUserDetailPage />} />
              </Route>
              <Route path="/sign-po/:token" element={<SignPO />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </Sentry.ErrorBoundary>
);

export default App;
