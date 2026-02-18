import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "owner" | "staff" | "client" | "superadmin";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  tenantId: string | null;
  profile: { full_name: string; avatar_url: string | null; oab_number: string | null; position: string | null } | null;
  tenantBlocked: boolean;
  tenantBlockReason: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  tenantId: null,
  profile: null,
  tenantBlocked: false,
  tenantBlockReason: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [tenantBlocked, setTenantBlocked] = useState(false);
  const [tenantBlockReason, setTenantBlockReason] = useState<string | null>(null);

  const fetchUserData = async (userId: string) => {
    try {
      const [roleRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("profiles").select("full_name, avatar_url, oab_number, position, tenant_id").eq("user_id", userId).single(),
      ]);

      if (roleRes.data && roleRes.data.length > 0) {
        const priority: AppRole[] = ["superadmin", "owner", "staff", "client"];
        const bestRole = priority.find(r => roleRes.data.some(row => row.role === r)) || roleRes.data[0].role;
        setRole(bestRole as AppRole);
      }
      if (profileRes.data) {
        setTenantId(profileRes.data.tenant_id);
        setProfile({
          full_name: profileRes.data.full_name,
          avatar_url: profileRes.data.avatar_url,
          oab_number: profileRes.data.oab_number,
          position: profileRes.data.position,
        });

        // Check tenant blocking (skip for superadmins)
        const isSuperadmin = roleRes.data?.some(r => r.role === "superadmin");
        if (!isSuperadmin && profileRes.data.tenant_id) {
          const { data: tenant } = await supabase
            .from("tenants")
            .select("subscription_status, monthly_fee, trial_ends_at")
            .eq("id", profileRes.data.tenant_id)
            .single();

          if (tenant) {
            const isExempt = tenant.subscription_status === "exempt";
            const isFree = Number(tenant.monthly_fee) === 0;
            const isBlocked = tenant.subscription_status === "blocked";
            const isOverdue = tenant.subscription_status === "overdue";
            const trialExpired = tenant.subscription_status === "trial" && tenant.trial_ends_at && new Date(tenant.trial_ends_at) < new Date();

            if (isExempt || isFree) {
              setTenantBlocked(false);
              setTenantBlockReason(null);
            } else if (isBlocked) {
              setTenantBlocked(true);
              setTenantBlockReason("Seu escritório está bloqueado por falta de pagamento. Entre em contato com o administrador.");
            } else if (isOverdue) {
              setTenantBlocked(true);
              setTenantBlockReason("Seu escritório possui pagamento em atraso. Entre em contato com o administrador para regularizar.");
            } else if (trialExpired) {
              setTenantBlocked(true);
              setTenantBlockReason("O período de teste do seu escritório expirou. Entre em contato com o administrador.");
            } else {
              setTenantBlocked(false);
              setTenantBlockReason(null);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchUserData(session.user.id), 0);
      } else {
        setRole(null);
        setTenantId(null);
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setTenantId(null);
    setProfile(null);
    setTenantBlocked(false);
    setTenantBlockReason(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, tenantId, profile, tenantBlocked, tenantBlockReason, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
