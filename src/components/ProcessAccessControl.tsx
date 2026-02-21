import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Shield, X, Ban, CheckCircle, Loader2 } from "lucide-react";

interface StaffAccess {
  user_id: string;
  full_name: string;
  oab_number: string | null;
  is_blocked: boolean;
  is_extra: boolean;
}

interface ProcessAccessControlProps {
  caseId: string;
  processNumber: string;
  onClose: () => void;
}

const ProcessAccessControl = ({ caseId, processNumber, onClose }: ProcessAccessControlProps) => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [staffList, setStaffList] = useState<StaffAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    loadStaffAccess();
  }, [tenantId]);

  const loadStaffAccess = async () => {
    if (!tenantId) return;

    const [profilesRes, rolesRes, accessRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, oab_number").eq("tenant_id", tenantId),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("staff_case_access").select("*").eq("tenant_id", tenantId),
    ]);

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const accessRows = accessRes.data || [];

    const roleMap: Record<string, string> = {};
    roles.forEach((r) => { roleMap[r.user_id] = r.role; });

    const staffMembers = profiles
      .filter((p) => roleMap[p.user_id] === "staff")
      .map((p) => {
        const accessRow = accessRows.find((a: any) => a.user_id === p.user_id);
        const blockedIds: string[] = (accessRow as any)?.blocked_case_ids || [];
        const extraIds: string[] = (accessRow as any)?.extra_case_ids || [];

        return {
          user_id: p.user_id,
          full_name: p.full_name,
          oab_number: p.oab_number,
          is_blocked: blockedIds.includes(caseId),
          is_extra: extraIds.includes(caseId),
        };
      });

    setStaffList(staffMembers);
    setLoading(false);
  };

  const toggleAccess = async (staffUserId: string, action: "block" | "unblock" | "grant" | "revoke") => {
    if (!tenantId) return;
    setSaving(staffUserId);

    try {
      // Get current access config
      const { data: existing } = await supabase
        .from("staff_case_access")
        .select("*")
        .eq("user_id", staffUserId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      const blockedIds: string[] = (existing as any)?.blocked_case_ids || [];
      const extraIds: string[] = (existing as any)?.extra_case_ids || [];

      let newBlocked = [...blockedIds];
      let newExtra = [...extraIds];

      if (action === "block") {
        if (!newBlocked.includes(caseId)) newBlocked.push(caseId);
        newExtra = newExtra.filter((id) => id !== caseId);
      } else if (action === "unblock") {
        newBlocked = newBlocked.filter((id) => id !== caseId);
      } else if (action === "grant") {
        if (!newExtra.includes(caseId)) newExtra.push(caseId);
        newBlocked = newBlocked.filter((id) => id !== caseId);
      } else if (action === "revoke") {
        newExtra = newExtra.filter((id) => id !== caseId);
      }

      const upsertData = {
        user_id: staffUserId,
        tenant_id: tenantId,
        access_mode: (existing as any)?.access_mode || "own_only",
        allowed_oab_numbers: (existing as any)?.allowed_oab_numbers || [],
        allowed_client_ids: (existing as any)?.allowed_client_ids || [],
        blocked_case_ids: newBlocked,
        extra_case_ids: newExtra,
      };

      const { error } = await supabase
        .from("staff_case_access")
        .upsert(upsertData as any, { onConflict: "user_id,tenant_id" });

      if (error) throw error;

      // Update local state
      setStaffList((prev) =>
        prev.map((s) =>
          s.user_id === staffUserId
            ? { ...s, is_blocked: newBlocked.includes(caseId), is_extra: newExtra.includes(caseId) }
            : s
        )
      );

      const actionLabels = { block: "bloqueado", unblock: "desbloqueado", grant: "liberado", revoke: "acesso removido" };
      toast({ title: `Acesso ${actionLabels[action]}!` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-foreground/30" onClick={onClose} />
      <div className="relative bg-card rounded-xl border shadow-lg w-full max-w-md p-5 animate-scale-in max-h-[80vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-accent" />
          <h2 className="text-base font-bold text-foreground">Controle de Acesso</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4 font-mono">{processNumber}</p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : staffList.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum funcionário na equipe.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-2">
              Membros da equipe
            </p>
            {staffList.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{member.full_name}</p>
                  {member.oab_number && (
                    <p className="text-[10px] text-muted-foreground">{member.oab_number}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {member.is_blocked && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600">
                      Bloqueado
                    </span>
                  )}
                  {member.is_extra && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">
                      Liberado
                    </span>
                  )}

                  {saving === member.user_id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      {member.is_blocked ? (
                        <button
                          onClick={() => toggleAccess(member.user_id, "unblock")}
                          className="p-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                          title="Desbloquear acesso"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleAccess(member.user_id, "block")}
                          className="p-1.5 rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                          title="Bloquear acesso"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {member.is_extra ? (
                        <button
                          onClick={() => toggleAccess(member.user_id, "revoke")}
                          className="p-1.5 rounded-md bg-green-500 text-white hover:bg-green-600 transition-colors"
                          title="Remover liberação manual"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleAccess(member.user_id, "grant")}
                          className="p-1.5 rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
                          title="Liberar acesso manualmente"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground mt-4">
          <Ban className="w-3 h-3 inline text-red-500 mr-1" /> Bloqueia o acesso mesmo que a OAB conste nas publicações.
          <br />
          <CheckCircle className="w-3 h-3 inline text-green-500 mr-1" /> Libera o acesso independente do vínculo por OAB.
        </p>
      </div>
    </div>
  );
};

export default ProcessAccessControl;
