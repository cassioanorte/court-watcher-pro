// build-v7-lazy
import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import ErrorBoundary from "@/components/ErrorBoundary";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

// Layouts carregam eager (são necessários imediatamente)
import AdminLayout from "./layouts/AdminLayout";
import SuperAdminLayout from "./layouts/SuperAdminLayout";

// Todas as páginas com lazy loading
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Processes = React.lazy(() => import("./pages/Processes"));
const ProcessDetail = React.lazy(() => import("./pages/ProcessDetail"));
const ClientDetail = React.lazy(() => import("./pages/ClientDetail"));
const Agenda = React.lazy(() => import("./pages/Agenda"));
const Financeiro = React.lazy(() => import("./pages/Financeiro"));
const Cobranca = React.lazy(() => import("./pages/Cobranca"));
const Publicacoes = React.lazy(() => import("./pages/Publicacoes"));
const CRM = React.lazy(() => import("./pages/CRM"));
const Contatos = React.lazy(() => import("./pages/Contatos"));
const ContatoDetail = React.lazy(() => import("./pages/ContatoDetail"));
const Settings = React.lazy(() => import("./pages/Settings"));
const ClientPortal = React.lazy(() => import("./pages/ClientPortal"));
const ClientProcessDetail = React.lazy(() => import("./pages/ClientProcessDetail"));
const Auth = React.lazy(() => import("./pages/Auth"));
const ClientAuth = React.lazy(() => import("./pages/ClientAuth"));
const AdminLogin = React.lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = React.lazy(() => import("./pages/admin/AdminDashboard"));
const AdminTenants = React.lazy(() => import("./pages/admin/AdminTenants"));
const AdminUsers = React.lazy(() => import("./pages/admin/AdminUsers"));
const AdminActivity = React.lazy(() => import("./pages/admin/AdminActivity"));
const AdminBilling = React.lazy(() => import("./pages/admin/AdminBilling"));
const AdminTrials = React.lazy(() => import("./pages/admin/AdminTrials"));
const AdminReports = React.lazy(() => import("./pages/admin/AdminReports"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const ExtrairTexto = React.lazy(() => import("./pages/ExtrairTexto"));
const LeadCapture = React.lazy(() => import("./pages/LeadCapture"));
const LandingPages = React.lazy(() => import("./pages/LandingPages"));
const LandingPageEditor = React.lazy(() => import("./pages/LandingPageEditor"));
const LandingPagePublic = React.lazy(() => import("./pages/LandingPagePublic"));
const Pagamentos = React.lazy(() => import("./pages/Pagamentos"));
const AgentesIA = React.lazy(() => import("./pages/AgentesIA"));
const Calculadoras = React.lazy(() => import("./pages/Calculadoras"));
const Cumprimentos = React.lazy(() => import("./pages/Cumprimentos"));
const Tarefas = React.lazy(() => import("./pages/Tarefas"));
const GoogleCalendarCallback = React.lazy(() => import("./pages/GoogleCalendarCallback"));
const DocumentosEproc = React.lazy(() => import("./pages/DocumentosEproc"));
const HonorariosPrevistos = React.lazy(() => import("./pages/HonorariosPrevistos"));
const CalculadoraFullPage = React.lazy(() => import("./pages/CalculadoraFullPage"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="space-y-5 p-6 animate-fade-in">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-7 w-40 bg-muted animate-pulse rounded" />
        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
      </div>
    </div>
    <div className="h-10 w-full bg-muted animate-pulse rounded-lg" />
    <div className="bg-card rounded-lg border overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
          <div className="h-4 flex-1 max-w-[200px] bg-muted animate-pulse rounded" />
          <div className="h-4 flex-1 max-w-[150px] bg-muted animate-pulse rounded hidden md:block" />
          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
        </div>
      ))}
    </div>
  </div>
);

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
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Auth routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/portal/login" element={<ClientAuth />} />
            <Route path="/extrair-texto" element={<ExtrairTexto />} />
            <Route path="/lead-form" element={<LeadCapture />} />
            <Route path="/lp/:slug" element={<LandingPagePublic />} />
            <Route path="/google-calendar-callback" element={<GoogleCalendarCallback />} />
            <Route path="/documentos-eproc" element={<DocumentosEproc />} />

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
              <Route path="financeiro/honorarios-previstos" element={<HonorariosPrevistos />} />
              <Route path="cobranca" element={<Cobranca />} />
              <Route path="pagamentos" element={<Pagamentos />} />
              <Route path="landing-pages" element={<LandingPages />} />
              <Route path="landing-pages/:id" element={<LandingPageEditor />} />
              <Route path="configuracoes" element={<Settings />} />
              <Route path="agentes-ia" element={<AgentesIA />} />
              <Route path="calculadoras" element={<Calculadoras />} />
              <Route path="calculadoras/:calcId" element={<CalculadoraFullPage />} />
              <Route path="cumprimentos" element={<Cumprimentos />} />
              <Route path="tarefas" element={<Tarefas />} />
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
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
