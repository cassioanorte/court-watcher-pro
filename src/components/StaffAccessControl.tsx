import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Eye, Shield, Save, X, Plus, Trash2 } from "lucide-react";

type AccessMode = "all" | "own_only" | "own_plus_oab" | "own_plus_clients";

interface StaffMember {
  user_id: string;
  full_name: string;
  position: string | null;
  oab_number: string | null;
  role: string;
}

interface AccessConfig {
  user_id: string;
  access_mode: AccessMode;
  allowed_oab_numbers: string[];
  allowed_client_ids: string[];
}

const accessModeLabels: Record<AccessMode, { label: string; description: string }> = {
  all: { label: "Todos os processos", description: "Acesso irrestrito a todos os processos do escritório" },
  own_only: { label: "Somente os seus", description: "Apenas processos onde é responsável" },
  own_plus_oab: { label: "Seus + OAB específica", description: "Seus processos + processos de advogados específicos" },
  own_plus_clients: { label: "Seus + Clientes específicos", description: "Seus processos + processos de clientes selecionados" },
};

const StaffAccessControl = () => {
  const { tenantId, role } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [configs, setConfigs] = useState<Record<string, AccessConfig>>({});
  const [clients, setClients] = useState<{ user_id: string; full_name: string }[]>([]);
  const [oabNumbers, setOabNumbers] = useState<{ oab: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);

  const canManageAccess = role === "owner" || role === "superadmin";

  useEffect(() => {
    if (!tenantId || !canManageAccess) return;
    loadData();
  }, [tenantId, role]);

  const loadData = async () => {
    if (!tenantId) return;

    const [profilesRes, rolesRes, accessRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, position, oab_number").eq("tenant_id", tenantId),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("staff_case_access").select("*").eq("tenant_id", tenantId),
    ]);

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const roleMap: Record<string, string> = {};
    roles.forEach((r) => { roleMap[r.user_id] = r.role; });

    // Filter staff members (not owners, not clients)
    const staffMembers = profiles
      .filter((p) => roleMap[p.user_id] === "staff")
      .map((p) => ({ ...p, role: roleMap[p.user_id] || "staff" }));

    setStaff(staffMembers);

    // Build access configs map
    const configMap: Record<string, AccessConfig> = {};
    (accessRes.data || []).forEach((a: any) => {
      configMap[a.user_id] = {
        user_id: a.user_id,
        access_mode: a.access_mode,
        allowed_oab_numbers: a.allowed_oab_numbers || [],
        allowed_client_ids: a.allowed_client_ids || [],
      };
    });
    setConfigs(configMap);

    // Get all clients for dropdown
    const clientList = profiles
      .filter((p) => roleMap[p.user_id] === "client")
      .map((p) => ({ user_id: p.user_id, full_name: p.full_name }));
    setClients(clientList);

    // Get all unique OAB numbers
    const oabs = profiles
      .filter((p) => p.oab_number && (roleMap[p.user_id] === "staff" || roleMap[p.user_id] === "owner"))
      .map((p) => ({ oab: p.oab_number!, name: p.full_name }));
    setOabNumbers(oabs);

    setLoading(false);
  };

  const getConfig = (userId: string): AccessConfig => {
    return configs[userId] || { user_id: userId, access_mode: "own_only", allowed_oab_numbers: [], allowed_client_ids: [] };
  };

  const updateConfig = (userId: string, updates: Partial<AccessConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [userId]: { ...getConfig(userId), ...updates },
    }));
  };

  const handleSave = async (userId: string) => {
    if (!tenantId) return;
    setSaving(userId);
    const config = getConfig(userId);

    try {
      const { error } = await supabase.from("staff_case_access").upsert(
        {
          user_id: userId,
          tenant_id: tenantId,
          access_mode: config.access_mode,
          allowed_oab_numbers: config.allowed_oab_numbers,
          allowed_client_ids: config.allowed_client_ids,
        },
        { onConflict: "user_id,tenant_id" }
      );
      if (error) throw error;
      toast({ title: "Salvo!", description: "Permissões de acesso atualizadas." });
      setEditingUser(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  if (!canManageAccess) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-lg border p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Eye className="w-4 h-4 text-accent" /> Permissões de Acesso a Processos
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Configure quais processos cada membro da equipe pode visualizar. Por padrão, cada membro vê apenas os processos onde é responsável.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : staff.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum funcionário cadastrado na equipe.</p>
      ) : (
        <div className="space-y-2">
          {staff.map((member) => {
            const config = getConfig(member.user_id);
            const isEditing = editingUser === member.user_id;
            const modeInfo = accessModeLabels[config.access_mode];

            return (
              <div key={member.user_id} className="rounded-lg border overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setEditingUser(isEditing ? null : member.user_id)}
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-blue-500">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground">{modeInfo.label}</p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    config.access_mode === "all" ? "bg-emerald-500/10 text-emerald-600" :
                    config.access_mode === "own_only" ? "bg-orange-500/10 text-orange-600" :
                    "bg-blue-500/10 text-blue-600"
                  }`}>
                    {config.access_mode === "all" ? "Total" : config.access_mode === "own_only" ? "Restrito" : "Parcial"}
                  </span>
                </div>

                {isEditing && (
                  <div className="px-4 py-4 border-t bg-muted/20 space-y-4">
                    {/* Access mode select */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Modo de acesso</label>
                      <select
                        value={config.access_mode}
                        onChange={(e) => updateConfig(member.user_id, { access_mode: e.target.value as AccessMode })}
                        className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                      >
                        {Object.entries(accessModeLabels).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-muted-foreground mt-1">{accessModeLabels[config.access_mode].description}</p>
                    </div>

                    {/* OAB selection for own_plus_oab */}
                    {config.access_mode === "own_plus_oab" && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">OABs permitidas</label>
                        <div className="mt-2 space-y-2">
                          {config.allowed_oab_numbers.map((oab, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={oab}
                                onChange={(e) => {
                                  const updated = [...config.allowed_oab_numbers];
                                  updated[idx] = e.target.value;
                                  updateConfig(member.user_id, { allowed_oab_numbers: updated });
                                }}
                                placeholder="Ex: RS 123456"
                                className="flex-1 h-9 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                              />
                              <button
                                onClick={() => {
                                  const updated = config.allowed_oab_numbers.filter((_, i) => i !== idx);
                                  updateConfig(member.user_id, { allowed_oab_numbers: updated });
                                }}
                                className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {oabNumbers.length > 0 && (
                            <select
                              onChange={(e) => {
                                if (e.target.value && !config.allowed_oab_numbers.includes(e.target.value)) {
                                  updateConfig(member.user_id, { allowed_oab_numbers: [...config.allowed_oab_numbers, e.target.value] });
                                }
                                e.target.value = "";
                              }}
                              className="w-full h-9 px-3 rounded-lg bg-background border text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                              defaultValue=""
                            >
                              <option value="" disabled>+ Selecionar OAB da equipe</option>
                              {oabNumbers.filter(o => !config.allowed_oab_numbers.includes(o.oab)).map((o) => (
                                <option key={o.oab} value={o.oab}>{o.oab} — {o.name}</option>
                              ))}
                            </select>
                          )}
                          <button
                            onClick={() => updateConfig(member.user_id, { allowed_oab_numbers: [...config.allowed_oab_numbers, ""] })}
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                          >
                            <Plus className="w-3 h-3" /> Adicionar OAB manualmente
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Client selection for own_plus_clients */}
                    {config.access_mode === "own_plus_clients" && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Clientes permitidos</label>
                        <div className="mt-2 space-y-2">
                          {config.allowed_client_ids.map((clientId, idx) => {
                            const client = clients.find(c => c.user_id === clientId);
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="flex-1 h-9 px-3 rounded-lg bg-background border text-sm text-foreground flex items-center">
                                  {client?.full_name || clientId}
                                </span>
                                <button
                                  onClick={() => {
                                    const updated = config.allowed_client_ids.filter((_, i) => i !== idx);
                                    updateConfig(member.user_id, { allowed_client_ids: updated });
                                  }}
                                  className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                          <select
                            onChange={(e) => {
                              if (e.target.value && !config.allowed_client_ids.includes(e.target.value)) {
                                updateConfig(member.user_id, { allowed_client_ids: [...config.allowed_client_ids, e.target.value] });
                              }
                              e.target.value = "";
                            }}
                            className="w-full h-9 px-3 rounded-lg bg-background border text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                            defaultValue=""
                          >
                            <option value="" disabled>+ Selecionar cliente</option>
                            {clients.filter(c => !config.allowed_client_ids.includes(c.user_id)).map((c) => (
                              <option key={c.user_id} value={c.user_id}>{c.full_name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Save button */}
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingUser(null)}
                        className="px-4 h-9 rounded-lg border text-sm font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleSave(member.user_id)}
                        disabled={saving === member.user_id}
                        className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {saving === member.user_id ? "Salvando..." : "Salvar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default StaffAccessControl;
