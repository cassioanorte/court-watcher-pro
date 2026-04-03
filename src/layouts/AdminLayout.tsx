import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Scale, Users, Settings, Menu, X, CalendarDays, DollarSign, Receipt, LogOut, Newspaper, UserPlus, Contact, User, Globe, Shield, Banknote, Bot, Calculator, Sun, Moon, Check, ClipboardCheck, CheckSquare } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { useColorMode, LIGHT_VARIANT_OPTIONS, DARK_VARIANT_OPTIONS, type LightVariant, type DarkVariant } from "@/hooks/useColorMode";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useThemeLoader, getLogoFilter, DEFAULT_THEME, type ThemeColors } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTaskNotifications } from "@/hooks/useTaskNotifications";
import { usePaymentMovementAlerts } from "@/hooks/usePaymentMovementAlerts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";


const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/processos", icon: Scale, label: "Processos" },
  { to: "/contatos", icon: Contact, label: "Contatos" },
  { to: "/crm", icon: UserPlus, label: "CRM" },
  { to: "/agenda", icon: CalendarDays, label: "Agenda" },
  { to: "/publicacoes", icon: Newspaper, label: "Publicações" },
  { to: "/cumprimentos", icon: ClipboardCheck, label: "Cumprimentos" },
  { to: "/tarefas", icon: CheckSquare, label: "Tarefas" },
  { to: "/financeiro", icon: DollarSign, label: "Financeiro" },
  { to: "/cobranca", icon: Receipt, label: "Cobrança" },
  { to: "/pagamentos", icon: Banknote, label: "Pagamentos" },
  { to: "/landing-pages", icon: Globe, label: "Landing Pages" },
  { to: "/agentes-ia", icon: Bot, label: "Agentes de IA" },
  { to: "/calculadoras", icon: Calculator, label: "Calculadoras" },
  { to: "/configuracoes?tab=api", icon: Settings, label: "API" },
];

const AdminLayout = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });
  const { tenantId, profile, role, user } = useAuth();
  // Realtime popup notifications for task assignments
  useTaskNotifications();
  // Realtime alerts for movements on cases with pending payment orders
  usePaymentMovementAlerts();
  const [tenantName, setTenantName] = useState("LEX IMPERIUM");
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [logoFilter, setLogoFilter] = useState("");
  const [logoBg, setLogoBg] = useState("");
  useThemeLoader();
  const { mode, toggle: toggleColorMode, lightVariant, setVariant, darkVariant, setDarkVariant } = useColorMode();

  useEffect(() => {
    if (!tenantId) return;
    supabase.from("tenants").select("name, logo_url, theme_colors").eq("id", tenantId).single().then(({ data }) => {
      if (data) {
        setTenantName(data.name || "LEX IMPERIUM");
        setTenantLogo(data.logo_url || null);
        document.title = data.name || "LEX IMPERIUM";
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
          "fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 gradient-hero",
          sidebarCollapsed ? "w-16" : "w-64",
          "lg:relative",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          {!sidebarCollapsed && (
            <>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden shrink-0 logo-bg-container" style={logoBg ? { background: logoBg } : undefined}>
                {tenantLogo ? (
                  <img src={tenantLogo} alt="Logo" className="w-full h-full object-contain logo-img" style={logoFilter ? { filter: logoFilter } : undefined} />
                ) : (
                  <Scale className="w-5 h-5 text-accent-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-sm font-bold text-sidebar-foreground tracking-wide truncate">{tenantName}</h1>
                <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest font-display">Imperial</p>
              </div>
            </>
          )}
          {sidebarCollapsed && (
            <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden shrink-0 logo-bg-container mx-auto" style={logoBg ? { background: logoBg } : undefined}>
              {tenantLogo ? (
                <img src={tenantLogo} alt="Logo" className="w-full h-full object-contain logo-img" style={logoFilter ? { filter: logoFilter } : undefined} />
              ) : (
                <Scale className="w-5 h-5 text-accent-foreground" />
              )}
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                title={sidebarCollapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  sidebarCollapsed && "justify-center px-2",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-4 border-t border-sidebar-border space-y-1">
          {role === "superadmin" && (
            <Link to="/admin" onClick={() => setSidebarOpen(false)} title={sidebarCollapsed ? "Painel Super Admin" : undefined} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 w-full transition-all", sidebarCollapsed && "justify-center px-2")}>
              <Shield className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && "Painel Super Admin"}
            </Link>
          )}
          <Link to="/configuracoes" onClick={() => setSidebarOpen(false)} title={sidebarCollapsed ? "Configurações" : undefined} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 w-full transition-all", sidebarCollapsed && "justify-center px-2")}>
            <Settings className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && "Configurações"}
          </Link>
          {/* Collapse toggle - desktop only */}
          <button
            onClick={() => {
              setSidebarCollapsed(prev => {
                const next = !prev;
                localStorage.setItem("sidebar-collapsed", String(next));
                return next;
              });
            }}
            title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            className={cn("hidden lg:flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 w-full transition-all", sidebarCollapsed && "justify-center px-2")}
          >
            {sidebarCollapsed ? <Menu className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
            {!sidebarCollapsed && "Recolher menu"}
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
            className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 w-full transition-all", sidebarCollapsed && "justify-center px-2")}
            title={sidebarCollapsed ? "Sair" : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && "Sair"}
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
            <button
              onClick={toggleColorMode}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={mode === "dark" ? "Tema claro" : "Tema escuro"}
            >
              {mode === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-md px-2 py-1">
                  <span className="hidden sm:inline">
                    {mode === "light"
                      ? LIGHT_VARIANT_OPTIONS.find(v => v.key === lightVariant)?.label
                      : DARK_VARIANT_OPTIONS.find(v => v.key === darkVariant)?.label
                    }
                  </span>
                  <span className="sm:hidden">Tema</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover z-[100] max-h-80 overflow-y-auto">
                <DropdownMenuLabel className="text-xs">
                  {mode === "light" ? "Variante do Tema Claro" : "Variante do Tema Escuro"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {mode === "light"
                  ? LIGHT_VARIANT_OPTIONS.map((v) => (
                    <DropdownMenuItem key={v.key} onClick={() => setVariant(v.key)} className="flex items-center gap-2 cursor-pointer">
                      <Check className={cn("w-3.5 h-3.5 shrink-0", lightVariant === v.key ? "opacity-100" : "opacity-0")} />
                      <div>
                        <p className="text-sm font-medium">{v.label}</p>
                        <p className="text-xs text-muted-foreground">{v.desc}</p>
                      </div>
                    </DropdownMenuItem>
                  ))
                  : DARK_VARIANT_OPTIONS.map((v) => (
                    <DropdownMenuItem key={v.key} onClick={() => setDarkVariant(v.key)} className="flex items-center gap-2 cursor-pointer">
                      <Check className={cn("w-3.5 h-3.5 shrink-0", darkVariant === v.key ? "opacity-100" : "opacity-0")} />
                      <div>
                        <p className="text-sm font-medium">{v.label}</p>
                        <p className="text-xs text-muted-foreground">{v.desc}</p>
                      </div>
                    </DropdownMenuItem>
                  ))
                }
              </DropdownMenuContent>
            </DropdownMenu>
            <NotificationBell />
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
