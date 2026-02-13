import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout";
import Dashboard from "./pages/Dashboard";
import Processes from "./pages/Processes";
import ProcessDetail from "./pages/ProcessDetail";
import Clients from "./pages/Clients";
import ClientPortal from "./pages/ClientPortal";
import ClientProcessDetail from "./pages/ClientProcessDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Admin / Staff routes */}
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="processos" element={<Processes />} />
            <Route path="processos/:id" element={<ProcessDetail />} />
            <Route path="clientes" element={<Clients />} />
          </Route>

          {/* Client portal routes */}
          <Route path="/portal" element={<ClientPortal />} />
          <Route path="/portal/processo/:id" element={<ClientProcessDetail />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
