import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AdminLayout from "./layouts/AdminLayout";
import Dashboard from "./pages/Dashboard";
import Processes from "./pages/Processes";
import ProcessDetail from "./pages/ProcessDetail";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Settings from "./pages/Settings";
import ClientPortal from "./pages/ClientPortal";
import ClientProcessDetail from "./pages/ClientProcessDetail";
import Auth from "./pages/Auth";
import ClientAuth from "./pages/ClientAuth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, role } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (role === "client") return <Navigate to="/portal" replace />;
  return <>{children}</>;
};

const ProtectedClientRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/portal/login" replace />;
  return <>{children}</>;
};

const App = () => (
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
              <Route path="configuracoes" element={<Settings />} />
            </Route>

            {/* Client portal routes */}
            <Route path="/portal" element={<ProtectedClientRoute><ClientPortal /></ProtectedClientRoute>} />
            <Route path="/portal/processo/:id" element={<ProtectedClientRoute><ClientProcessDetail /></ProtectedClientRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
