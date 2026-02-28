import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Eye, Shield, Save, Plus, Trash2, Ban, CheckCircle, ListChecks } from "lucide-react";
import BulkCaseAssignModal from "./BulkCaseAssignModal";

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
  blocked_case_ids: string[];
  extra_case_ids: string[];
}

interface CaseInfo {
  id: string;
  process_number: string;
  parties: string | null;
}

const accessModeLabels: Record<AccessMode, { label: string; description: string }> = {
  all: { label: "Todos os processos", description: "Acesso irrestrito a todos os processos do escritório" },
  own_only: { label: "Somente os seus", description: "Apenas processos onde é responsável ou onde sua OAB aparece em publicações" },
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
  const [cases, setCases] = useState<CaseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [caseSearch, setCaseSearch] = useState("");
  const [bulkAssignUser, setBulkAssignUser] = useState<string | null>(null);
  const canManageAccess = role === "owner" || role === "superadmin";

  useEffect(() => {
    if (!tenantId || !canManageAccess) return;
    loadData();
  }, [tenantId, role]);

  const loadData = async () => {
    if (!tenantId) return;

    const [profilesRes, rolesRes, accessRes, casesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, position, oab_number").eq("tenant_id", tenantId),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("staff_case_access").select("*").eq("tenant_id", tenantId),
      supabase.from("cases").select("id, process_number, parties").eq("tenant_id", tenantId).order("process_number"),
    ]);

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const roleMap: Record<string, string> = {};
    roles.forEach((r) => { roleMap[r.user_id] = r.role; });

    const staffMembers = profiles
      .filter((p) => roleMap[p.user_id] === "staff")
      .map((p) => ({ ...p, role: roleMap[p.user_id] || "staff" }));
    setStaff(staffMembers);

    const configMap: Record<string, AccessConfig> = {};
    (accessRes.data || []).forEach((a: any) => {
      configMap[a.user_id] = {
        user_id: a.user_id,
        access_mode: a.access_mode,
        allowed_oab_numbers: a.allowed_oab_numbers || [],
        allowed_client_ids: a.allowed_client_ids || [],
        blocked_case_ids: a.blocked_case_ids || [],
        extra_case_ids: a.extra_case_ids || [],
      };
    });
    setConfigs(configMap);

    const clientList = profiles
      .filter((p) => roleMap[p.user_id] === "client")
      .map((p) => ({ user_id: p.user_id, full_name: p.full_name }));
    setClients(clientList);

    const oabs = profiles
      .filter((p) => p.oab_number && (roleMap[p.user_id] === "staff" || roleMap[p.user_id] === "owner"))
      .map((p) => ({ oab: p.oab_number!, name: p.full_name }));
    setOabNumbers(oabs);

    setCases(casesRes.data || []);
    setLoading(false);
  };

  const getConfig = (userId: string): AccessConfig => {
    return configs[userId] || { user_id: userId, access_mode: "own_only", allowed_oab_numbers: [], allowed_client_ids: [], blocked_case_ids: [], extra_case_ids: [] };
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
          blocked_case_ids: config.blocked_case_ids,
          extra_case_ids: config.extra_case_ids,
        } as any,
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

  const getCaseName = (caseId: string) => {
    const c = cases.find(cs => cs.id === caseId);
    return c ? `${c.process_number}${c.parties ? ` — ${c.parties.substring(0, 40)}` : ''}` : caseId;
  };

  const filteredCases = caseSearch.length >= 3
    ? cases.filter(c =>
        c.process_number.includes(caseSearch) ||
        (c.parties && c.parties.toLowerCase().includes(caseSearch.toLowerCase()))
      ).slice(0, 10)
    : [];

  if (!canManageAccess) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-lg border p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Eye className="w-4 h-4 text-accent" /> Permissões de Acesso a Processos
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Configure quais processos cada membro da equipe pode visualizar. Por padrão, cada membro vê processos onde sua OAB aparece em publicações. Use os ajustes manuais para corrigir erros.
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
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); setBulkAssignUser(member.user_id); }}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                      title="Liberar processos em lote"
                    >
                      <ListChecks className="w-3.5 h-3.5" />
                    </button>
                    {config.blocked_case_ids.length > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                        {config.blocked_case_ids.length} bloqueado(s)
                      </span>
                    )}
                    {config.extra_case_ids.length > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">
                        {config.extra_case_ids.length} extra(s)
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                      config.access_mode === "all" ? "bg-emerald-500/10 text-emerald-600" :
                      config.access_mode === "own_only" ? "bg-orange-500/10 text-orange-600" :
                      "bg-accent/10 text-accent"
                    }`}>
                      {config.access_mode === "all" ? "Total" : config.access_mode === "own_only" ? "Restrito" : "Parcial"}
                    </span>
                  </div>
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
                              <button onClick={() => updateConfig(member.user_id, { allowed_oab_numbers: config.allowed_oab_numbers.filter((_, i) => i !== idx) })} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md"><Trash2 className="w-3.5 h-3.5" /></button>
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
                          <button onClick={() => updateConfig(member.user_id, { allowed_oab_numbers: [...config.allowed_oab_numbers, ""] })} className="inline-flex items-center gap-1 text-xs text-accent hover:underline"><Plus className="w-3 h-3" /> Adicionar OAB manualmente</button>
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
                                <span className="flex-1 h-9 px-3 rounded-lg bg-background border text-sm text-foreground flex items-center">{client?.full_name || clientId}</span>
                                <button onClick={() => updateConfig(member.user_id, { allowed_client_ids: config.allowed_client_ids.filter((_, i) => i !== idx) })} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md"><Trash2 className="w-3.5 h-3.5" /></button>
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

                    {/* Manual overrides section */}
                    <div className="border-t pt-4 space-y-3">
                      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                        Ajustes Manuais
                      </h3>
                      <p className="text-[10px] text-muted-foreground">
                        Use para corrigir erros nas publicações: bloqueie processos que aparecem indevidamente ou libere processos que não aparecem.
                      </p>

                      {/* Blocked cases */}
                      <div>
                        <label className="text-xs font-medium text-red-600 flex items-center gap-1">
                          <Ban className="w-3 h-3" /> Processos bloqueados (não aparecerão mesmo que a OAB conste)
                        </label>
                        <div className="mt-2 space-y-1">
                          {config.blocked_case_ids.map((caseId) => (
                            <div key={caseId} className="flex items-center gap-2 bg-red-500/5 rounded-lg px-3 py-1.5">
                              <span className="flex-1 text-xs text-foreground truncate">{getCaseName(caseId)}</span>
                              <button onClick={() => updateConfig(member.user_id, { blocked_case_ids: config.blocked_case_ids.filter(id => id !== caseId) })} className="p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Extra allowed cases */}
                      <div>
                        <label className="text-xs font-medium text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Processos liberados manualmente (aparecerão sempre)
                        </label>
                        <div className="mt-2 space-y-1">
                          {config.extra_case_ids.map((caseId) => (
                            <div key={caseId} className="flex items-center gap-2 bg-green-500/5 rounded-lg px-3 py-1.5">
                              <span className="flex-1 text-xs text-foreground truncate">{getCaseName(caseId)}</span>
                              <button onClick={() => updateConfig(member.user_id, { extra_case_ids: config.extra_case_ids.filter(id => id !== caseId) })} className="p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Case search to add */}
                      <div>
                        <input
                          type="text"
                          value={caseSearch}
                          onChange={(e) => setCaseSearch(e.target.value)}
                          placeholder="Buscar processo por número ou nome da parte (mínimo 3 caracteres)..."
                          className="w-full h-9 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                        />
                        {filteredCases.length > 0 && (
                          <div className="mt-1 border rounded-lg bg-background max-h-40 overflow-y-auto">
                            {filteredCases.map((c) => {
                              const isBlocked = config.blocked_case_ids.includes(c.id);
                              const isExtra = config.extra_case_ids.includes(c.id);
                              return (
                                <div key={c.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 border-b last:border-b-0">
                                  <span className="text-xs text-foreground truncate flex-1">{c.process_number}{c.parties ? ` — ${c.parties.substring(0, 30)}` : ''}</span>
                                  <div className="flex items-center gap-1 ml-2">
                                    <button
                                      onClick={() => {
                                        if (!isBlocked) {
                                          updateConfig(member.user_id, {
                                            blocked_case_ids: [...config.blocked_case_ids, c.id],
                                            extra_case_ids: config.extra_case_ids.filter(id => id !== c.id),
                                          });
                                        } else {
                                          updateConfig(member.user_id, { blocked_case_ids: config.blocked_case_ids.filter(id => id !== c.id) });
                                        }
                                        setCaseSearch("");
                                      }}
                                      className={`text-[10px] px-2 py-1 rounded ${isBlocked ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-600 hover:bg-red-500/20'}`}
                                    >
                                      <Ban className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (!isExtra) {
                                          updateConfig(member.user_id, {
                                            extra_case_ids: [...config.extra_case_ids, c.id],
                                            blocked_case_ids: config.blocked_case_ids.filter(id => id !== c.id),
                                          });
                                        } else {
                                          updateConfig(member.user_id, { extra_case_ids: config.extra_case_ids.filter(id => id !== c.id) });
                                        }
                                        setCaseSearch("");
                                      }}
                                      className={`text-[10px] px-2 py-1 rounded ${isExtra ? 'bg-green-500 text-white' : 'bg-green-500/10 text-green-600 hover:bg-green-500/20'}`}
                                    >
                                      <CheckCircle className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

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

      {bulkAssignUser && tenantId && (() => {
        const member = staff.find(s => s.user_id === bulkAssignUser);
        const config = getConfig(bulkAssignUser);
        return (
          <BulkCaseAssignModal
            staffName={member?.full_name || ""}
            staffUserId={bulkAssignUser}
            tenantId={tenantId}
            currentExtraIds={config.extra_case_ids}
            currentBlockedIds={config.blocked_case_ids}
            onClose={() => setBulkAssignUser(null)}
            onSave={async (extraIds) => {
              updateConfig(bulkAssignUser, { extra_case_ids: extraIds });
              // Auto-save
              const updatedConfig = { ...getConfig(bulkAssignUser), extra_case_ids: extraIds };
              const { error } = await supabase.from("staff_case_access").upsert(
                {
                  user_id: bulkAssignUser,
                  tenant_id: tenantId,
                  access_mode: updatedConfig.access_mode,
                  allowed_oab_numbers: updatedConfig.allowed_oab_numbers,
                  allowed_client_ids: updatedConfig.allowed_client_ids,
                  blocked_case_ids: updatedConfig.blocked_case_ids,
                  extra_case_ids: extraIds,
                } as any,
                { onConflict: "user_id,tenant_id" }
              );
              if (error) {
                toast({ title: "Erro", description: error.message, variant: "destructive" });
              } else {
                toast({ title: "Salvo!", description: `${extraIds.length} processos liberados.` });
              }
              setBulkAssignUser(null);
            }}
          />
        );
      })()}
    </motion.div>
  );
};

export default StaffAccessControl;
