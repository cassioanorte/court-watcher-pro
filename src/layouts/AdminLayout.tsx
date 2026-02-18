import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Scale, Users, Settings, Bell, Menu, X, CalendarDays, DollarSign, Receipt, LogOut, Newspaper, UserPlus, Contact, User, Globe, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useThemeLoader, getLogoFilter, DEFAULT_THEME, type ThemeColors } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";


const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/processos", icon: Scale, label: "Processos" },
  { to: "/contatos", icon: Contact, label: "Contatos" },
  { to: "/crm", icon: UserPlus, label: "CRM" },
  { to: "/agenda", icon: CalendarDays, label: "Agenda" },
  { to: "/publicacoes", icon: Newspaper, label: "Publicações" },
  { to: "/financeiro", icon: DollarSign, label: "Financeiro" },
  { to: "/cobranca", icon: Receipt, label: "Cobrança" },
  { to: "/landing-pages", icon: Globe, label: "Landing Pages" },
];

const AdminLayout = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { tenantId, profile, role, user } = useAuth();
  const [tenantName, setTenantName] = useState("Portal Jurídico");
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [logoFilter, setLogoFilter] = useState("");
  const [logoBg, setLogoBg] = useState("");
  useThemeLoader();

  useEffect(() => {
    if (!tenantId) return;
    supabase.from("tenants").select("name, logo_url, theme_colors").eq("id", tenantId).single().then(({ data }) => {
      if (data) {
        setTenantName(data.name || "Portal Jurídico");
        setTenantLogo(data.logo_url || null);
        document.title = data.name || "Portal Jurídico";
        const tc = data.theme_colors as unknown as Partial<ThemeColors> | null;
        const merged = { ...DEFAULT_THEME, ...tc };
        setLogoFilter(getLogoFilter(merged));
        setLogoBg(merged.logoBg || "");
      }
    });
  }, [tenantId]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 gradient-hero flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden shrink-0 logo-bg-container">
            {tenantLogo ? (
              <img src={tenantLogo} alt="Logo" className="w-full h-full object-contain logo-img" />
            ) : (
              <Scale className="w-5 h-5 text-accent-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-sidebar-foreground tracking-wide truncate">{tenantName}</h1>
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Escritório</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
          {role === "superadmin" && (
            <Link to="/admin" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 w-full transition-all">
              <Shield className="w-4 h-4" />
              Painel Super Admin
            </Link>
          )}
          <Link to="/configuracoes" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 w-full transition-all">
            <Settings className="w-4 h-4" />
            Configurações
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 w-full transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b bg-card flex items-center justify-between px-4 lg:px-6 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <button className="relative text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-semibold text-primary-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {profile?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-popover z-[100]">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-sm font-semibold text-primary-foreground shrink-0">
                      {profile?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{profile?.full_name || "Usuário"}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 space-y-1">
                  {profile?.oab_number && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Scale className="w-3 h-3" />
                      <span>OAB: {profile.oab_number}</span>
                    </div>
                  )}
                  {(role || profile?.position) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span>{profile?.position ? ({socio:"Sócio",advogado_associado:"Advogado Associado",advogado_parceiro:"Advogado Parceiro",funcionario:"Funcionário",estagiario:"Estagiário"} as Record<string,string>)[profile.position] || profile.position : role === "owner" ? "Proprietário" : role === "staff" ? "Colaborador" : role === "client" ? "Cliente" : "Super Admin"}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <LayoutDashboard className="w-3 h-3" />
                    <span className="truncate">{tenantName}</span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/configuracoes" className="flex items-center gap-2 cursor-pointer">
                    <Settings className="w-4 h-4" />
                    Configurações
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = "/auth";
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
