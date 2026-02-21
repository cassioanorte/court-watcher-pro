import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import ErrorBoundary from "@/components/ErrorBoundary";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import AdminLayout from "./layouts/AdminLayout";
import SuperAdminLayout from "./layouts/SuperAdminLayout";
import Dashboard from "./pages/Dashboard";
import Processes from "./pages/Processes";
import ProcessDetail from "./pages/ProcessDetail";
import ClientDetail from "./pages/ClientDetail";
import Agenda from "./pages/Agenda";
import Financeiro from "./pages/Financeiro";
import Cobranca from "./pages/Cobranca";
import Publicacoes from "./pages/Publicacoes";
import CRM from "./pages/CRM";
import Contatos from "./pages/Contatos";
import ContatoDetail from "./pages/ContatoDetail";
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
import ExtrairTexto from "./pages/ExtrairTexto";
import LeadCapture from "./pages/LeadCapture";
import LandingPages from "./pages/LandingPages";
import LandingPageEditor from "./pages/LandingPageEditor";
import LandingPagePublic from "./pages/LandingPagePublic";
import Pagamentos from "./pages/Pagamentos";
import AgentesIA from "./pages/AgentesIA";
import Calculadoras from "./pages/Calculadoras";
import GoogleCalendarCallback from "./pages/GoogleCalendarCallback";
const queryClient = new QueryClient();

const TenantBlockedScreen = () => {
  const { tenantBlockReason, signOut } = useAuth();
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="max-w-md mx-auto p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <span className="text-3xl">🔒</span>
        </div>
        <h1 className="text-xl font-bold text-foreground">Acesso Bloqueado</h1>
        <p className="text-muted-foreground text-sm">{tenantBlockReason}</p>
        <button onClick={signOut} className="mt-4 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          Sair
        </button>
      </div>
    </div>
  );
};

const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, role, tenantBlocked } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (role === "client") return <Navigate to="/portal" replace />;
  
  if (tenantBlocked) return <TenantBlockedScreen />;
  return <>{children}</>;
};

const ProtectedClientRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, tenantBlocked } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/portal/login" replace />;
  if (tenantBlocked) return <TenantBlockedScreen />;
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
      <PWAInstallPrompt />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Auth routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/portal/login" element={<ClientAuth />} />
            <Route path="/extrair-texto" element={<ExtrairTexto />} />
            <Route path="/lead-form" element={<LeadCapture />} />
            <Route path="/lp/:slug" element={<LandingPagePublic />} />
            <Route path="/google-calendar-callback" element={<GoogleCalendarCallback />} />

            {/* Admin / Staff routes */}
            <Route path="/" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="processos" element={<Processes />} />
              <Route path="processos/:id" element={<ProcessDetail />} />
              <Route path="clientes/:id" element={<ClientDetail />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="publicacoes" element={<Publicacoes />} />
              <Route path="crm" element={<CRM />} />
              <Route path="contatos" element={<Contatos />} />
              <Route path="contatos/:id" element={<ContatoDetail />} />
              <Route path="financeiro" element={<Financeiro />} />
              <Route path="cobranca" element={<Cobranca />} />
              <Route path="pagamentos" element={<Pagamentos />} />
              <Route path="landing-pages" element={<LandingPages />} />
              <Route path="landing-pages/:id" element={<LandingPageEditor />} />
              <Route path="configuracoes" element={<Settings />} />
              <Route path="agentes-ia" element={<AgentesIA />} />
              <Route path="calculadoras" element={<Calculadoras />} />
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
