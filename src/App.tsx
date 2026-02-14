import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import ErrorBoundary from "@/components/ErrorBoundary";
import AdminLayout from "./layouts/AdminLayout";
import SuperAdminLayout from "./layouts/SuperAdminLayout";
import Dashboard from "./pages/Dashboard";
import Processes from "./pages/Processes";
import ProcessDetail from "./pages/ProcessDetail";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Agenda from "./pages/Agenda";
import Financeiro from "./pages/Financeiro";
import Cobranca from "./pages/Cobranca";
import Settings from "./pages/Settings";
import ClientPortal from "./pages/ClientPortal";
import ClientProcessDetail from "./pages/ClientProcessDetail";
import Auth from "./pages/Auth";
import ClientAuth from "./pages/ClientAuth";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTenants from "./pages/admin/AdminTenants";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminActivity from "./pages/admin/AdminActivity";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminTrials from "./pages/admin/AdminTrials";
import AdminReports from "./pages/admin/AdminReports";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();

const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, role } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (role === "client") return <Navigate to="/portal" replace />;
  if (role === "superadmin") return <Navigate to="/admin" replace />;
  return <>{children}</>;
};

const ProtectedClientRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/portal/login" replace />;
  return <>{children}</>;
};

const ProtectedSuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, role } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-400 bg-slate-950">Carregando...</div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (role !== "superadmin") return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Auth routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/portal/login" element={<ClientAuth />} />

            {/* Admin / Staff routes */}
            <Route path="/" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="processos" element={<Processes />} />
              <Route path="processos/:id" element={<ProcessDetail />} />
              <Route path="clientes" element={<Clients />} />
              <Route path="clientes/:id" element={<ClientDetail />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="financeiro" element={<Financeiro />} />
              <Route path="cobranca" element={<Cobranca />} />
              <Route path="configuracoes" element={<Settings />} />
            </Route>

            {/* Client portal routes */}
            <Route path="/portal" element={<ProtectedClientRoute><ClientPortal /></ProtectedClientRoute>} />
            <Route path="/portal/processo/:id" element={<ProtectedClientRoute><ClientProcessDetail /></ProtectedClientRoute>} />

            {/* Super Admin routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<ProtectedSuperAdminRoute><SuperAdminLayout /></ProtectedSuperAdminRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="tenants" element={<AdminTenants />} />
              <Route path="usuarios" element={<AdminUsers />} />
              <Route path="atividade" element={<AdminActivity />} />
              <Route path="cobranca" element={<AdminBilling />} />
              <Route path="testes" element={<AdminTrials />} />
              <Route path="relatorios" element={<AdminReports />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
