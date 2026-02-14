import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { UserPlus, Users, X, Copy, Check, Shield, Briefcase, User, Pencil, Trash2 } from "lucide-react";

interface TeamMember {
  user_id: string;
  full_name: string;
  phone: string | null;
  oab_number: string | null;
  cpf: string | null;
  position: string | null;
  role: string;
}

const positionLabels: Record<string, string> = {
  socio: "Sócio",
  advogado_associado: "Advogado Associado",
  advogado_parceiro: "Advogado Parceiro",
  funcionario: "Funcionário",
  estagiario: "Estagiário",
};

const roleLabels: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  owner: { label: "Dono", icon: Shield, color: "text-accent" },
  staff: { label: "Funcionário", icon: Briefcase, color: "text-blue-500" },
  client: { label: "Cliente", icon: User, color: "text-emerald-500" },
};

const TeamManagement = () => {
  const { tenantId, user } = useAuth();
  const currentUserId = user?.id;
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formRole, setFormRole] = useState<"staff" | "client">("staff");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [cpf, setCpf] = useState("");
  const [position, setPosition] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tempPassword: string | null; alreadyExisted?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit state
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editOab, setEditOab] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete state
  const [deleteMember, setDeleteMember] = useState<TeamMember | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchMembers = async () => {
    if (!tenantId) return;
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone, oab_number, cpf, position")
      .eq("tenant_id", tenantId);

    if (profiles && profiles.length > 0) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", profiles.map((p) => p.user_id));

      const roleMap: Record<string, string> = {};
      (roles || []).forEach((r) => { roleMap[r.user_id] = r.role; });

      setMembers(
        profiles.map((p) => ({ ...p, role: roleMap[p.user_id] || "client" }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, [tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-client", {
        body: { email, fullName, phone: phone || undefined, role: formRole, oabNumber: oabNumber || undefined, cpf: cpf || undefined, position: position || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult({ tempPassword: data.tempPassword, alreadyExisted: data.alreadyExisted });
      const desc = data.alreadyExisted
        ? `${fullName} foi vinculado ao escritório. Utilize a senha já existente.`
        : `${fullName} foi adicionado como ${roleLabels[formRole].label}.`;
      toast({ title: "Usuário cadastrado!", description: desc });
      fetchMembers();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFullName("");
    setEmail("");
    setPhone("");
    setOabNumber("");
    setCpf("");
    setPosition("");
    setFormRole("staff");
    setResult(null);
  };

  const handleOpenEdit = (m: TeamMember) => {
    setEditMember(m);
    setEditName(m.full_name);
    setEditPhone(m.phone || "");
    setEditOab(m.oab_number || "");
    setEditCpf(m.cpf || "");
    setEditNewPassword("");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    setEditSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-team-member", {
        body: {
          action: "update",
          target_user_id: editMember.user_id,
          updates: {
            full_name: editName,
            phone: editPhone || null,
            oab_number: editOab || null,
            cpf: editCpf || null,
            new_password: editNewPassword || undefined,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Atualizado!", description: `${editName} foi atualizado com sucesso.` });
      setEditMember(null);
      fetchMembers();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteMember) return;
    setDeleteSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-team-member", {
        body: { action: "delete", target_user_id: deleteMember.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Removido!", description: `${deleteMember.full_name} foi removido do escritório.` });
      setDeleteMember(null);
      fetchMembers();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const grouped = {
    staff: members.filter((m) => m.role === "owner" || m.role === "staff"),
    clients: members.filter((m) => m.role === "client"),
  };

  const canManage = (m: TeamMember) => m.role !== "owner" && m.user_id !== currentUserId;

  const renderMemberRow = (m: TeamMember) => {
    const r = roleLabels[m.role] || roleLabels.staff;
    const Icon = r.icon;
    return (
      <div key={m.user_id} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/50 transition-colors">
        <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center ${r.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{m.full_name}</p>
          {m.position && <p className="text-xs text-muted-foreground">{positionLabels[m.position] || m.position}</p>}
          {m.oab_number && <p className="text-xs text-muted-foreground">OAB {m.oab_number}</p>}
        </div>
        {canManage(m) && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleOpenEdit(m)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Editar"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeleteMember(m)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {!canManage(m) && (
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${r.color}`}>{r.label}</span>
        )}
      </div>
    );
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-lg border p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" /> Equipe
          </h2>
          <button
            onClick={() => { setFormRole("staff"); setShowModal(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <UserPlus className="w-3.5 h-3.5" /> Cadastrar
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Equipe ({grouped.staff.length})</p>
              <div className="divide-y rounded-lg border overflow-hidden">
                {grouped.staff.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum funcionário cadastrado.</p>
                ) : (
                  grouped.staff.map(renderMemberRow)
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-foreground/30" onClick={handleCloseModal} />
          <div className="relative bg-card rounded-xl border shadow-lg w-full max-w-md p-6 animate-scale-in">
            <button onClick={handleCloseModal} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-foreground mb-1">Cadastrar Funcionário</h2>
            <p className="text-sm text-muted-foreground mb-5">Adicione funcionários ao escritório</p>

            {!result ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cargo *</label>
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    required
                    className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    <option value="">Selecione o cargo</option>
                    <option value="socio">Sócio</option>
                    <option value="advogado_associado">Advogado Associado</option>
                    <option value="advogado_parceiro">Advogado Parceiro</option>
                    <option value="funcionario">Funcionário</option>
                    <option value="estagiario">Estagiário</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome completo *</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CPF</label>
                  <input type="text" value={cpf} onChange={(e) => setCpf(e.target.value.replace(/\D/g, "").slice(0, 11))} className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" placeholder="00000000000" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">OAB</label>
                  <input type="text" value={oabNumber} onChange={(e) => setOabNumber(e.target.value)} placeholder="RS 123456" className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Telefone</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(51) 99999-0000" className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
                </div>
                <button type="submit" disabled={submitting} className="w-full h-10 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                  {submitting ? "Criando..." : "Cadastrar"}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                  <p className="text-sm font-semibold text-foreground mb-1">✅ Usuário cadastrado!</p>
                  <p className="text-xs text-muted-foreground">
                    {result.alreadyExisted ? "Este email já possui cadastro. O usuário foi vinculado ao escritório com a senha existente." : "Compartilhe a senha temporária abaixo:"}
                  </p>
                </div>
                {result.tempPassword && (
                  <>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm font-mono text-foreground">{result.tempPassword}</code>
                      <button onClick={handleCopy} className="h-9 w-9 rounded-lg border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">O usuário deve alterar a senha após o primeiro acesso.</p>
                  </>
                )}
                <button onClick={handleCloseModal} className="w-full h-10 rounded-lg border text-sm font-medium text-foreground hover:bg-muted transition-colors">Fechar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-foreground/30" onClick={() => setEditMember(null)} />
          <div className="relative bg-card rounded-xl border shadow-lg w-full max-w-md p-6 animate-scale-in">
            <button onClick={() => setEditMember(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-foreground mb-1">Editar Usuário</h2>
            <p className="text-sm text-muted-foreground mb-5">Atualize os dados de {editMember.full_name}</p>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome completo *</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Telefone</label>
                <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="(51) 99999-0000" className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              {editMember.role === "staff" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">OAB</label>
                  <input type="text" value={editOab} onChange={(e) => setEditOab(e.target.value)} placeholder="RS 123456" className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
                </div>
              )}
              {editMember.role === "client" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CPF</label>
                  <input type="text" value={editCpf} onChange={(e) => setEditCpf(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="00000000000" className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nova senha (opcional)</label>
                <input type="text" value={editNewPassword} onChange={(e) => setEditNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
                <p className="text-[10px] text-muted-foreground mt-1">Deixe em branco para manter a senha atual.</p>
              </div>
              <button type="submit" disabled={editSubmitting} className="w-full h-10 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {editSubmitting ? "Salvando..." : "Salvar alterações"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-foreground/30" onClick={() => setDeleteMember(null)} />
          <div className="relative bg-card rounded-xl border shadow-lg w-full max-w-md p-6 animate-scale-in">
            <h2 className="text-lg font-bold text-foreground mb-2">Confirmar exclusão</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Tem certeza que deseja remover <strong className="text-foreground">{deleteMember.full_name}</strong> do escritório? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteMember(null)} className="flex-1 h-10 rounded-lg border text-sm font-medium text-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button onClick={handleDeleteConfirm} disabled={deleteSubmitting} className="flex-1 h-10 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {deleteSubmitting ? "Removendo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TeamManagement;
