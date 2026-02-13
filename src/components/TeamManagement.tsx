import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { UserPlus, Users, X, Copy, Check, Shield, Briefcase, User } from "lucide-react";

interface TeamMember {
  user_id: string;
  full_name: string;
  phone: string | null;
  oab_number: string | null;
  role: string;
}

const roleLabels: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  owner: { label: "Dono", icon: Shield, color: "text-accent" },
  staff: { label: "Funcionário", icon: Briefcase, color: "text-blue-500" },
  client: { label: "Cliente", icon: User, color: "text-emerald-500" },
};

const TeamManagement = () => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formRole, setFormRole] = useState<"staff" | "client">("staff");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tempPassword: string | null; alreadyExisted?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchMembers = async () => {
    if (!tenantId) return;
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone, oab_number")
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
        body: { email, fullName, phone: phone || undefined, role: formRole, oabNumber: oabNumber || undefined },
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
    setFormRole("staff");
    setResult(null);
  };

  const grouped = {
    staff: members.filter((m) => m.role === "owner" || m.role === "staff"),
    clients: members.filter((m) => m.role === "client"),
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-lg border p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" /> Equipe & Clientes
          </h2>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <UserPlus className="w-3.5 h-3.5" /> Cadastrar
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-4">
            {/* Staff */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Equipe ({grouped.staff.length})</p>
              <div className="divide-y rounded-lg border overflow-hidden">
                {grouped.staff.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum funcionário cadastrado.</p>
                ) : (
                  grouped.staff.map((m) => {
                    const r = roleLabels[m.role] || roleLabels.staff;
                    const Icon = r.icon;
                    return (
                      <div key={m.user_id} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/50 transition-colors">
                        <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center ${r.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{m.full_name}</p>
                          {m.oab_number && <p className="text-xs text-muted-foreground">OAB {m.oab_number}</p>}
                        </div>
                        <span className={`text-[10px] font-semibold uppercase tracking-wide ${r.color}`}>{r.label}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Clients */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Clientes ({grouped.clients.length})</p>
              <div className="divide-y rounded-lg border overflow-hidden">
                {grouped.clients.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum cliente cadastrado.</p>
                ) : (
                  grouped.clients.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-emerald-500">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{m.full_name}</p>
                        {m.phone && <p className="text-xs text-muted-foreground">{m.phone}</p>}
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500">Cliente</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-foreground/30" onClick={handleCloseModal} />
          <div className="relative bg-card rounded-xl border shadow-lg w-full max-w-md p-6 animate-scale-in">
            <button onClick={handleCloseModal} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-foreground mb-1">Cadastrar Usuário</h2>
            <p className="text-sm text-muted-foreground mb-5">Adicione funcionários ou clientes ao escritório</p>

            {!result ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Role selector */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo de acesso *</label>
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setFormRole("staff")}
                      className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${formRole === "staff" ? "bg-accent/15 border-accent text-accent" : "bg-background text-muted-foreground hover:bg-muted"}`}
                    >
                      <Briefcase className="w-3.5 h-3.5 inline mr-1.5" />
                      Funcionário
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormRole("client")}
                      className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${formRole === "client" ? "bg-emerald-500/15 border-emerald-500 text-emerald-600" : "bg-background text-muted-foreground hover:bg-muted"}`}
                    >
                      <User className="w-3.5 h-3.5 inline mr-1.5" />
                      Cliente
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formRole === "staff"
                      ? "Funcionários têm acesso a todos os processos e clientes do escritório."
                      : "Clientes só podem ver seus próprios processos no portal."}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome completo *</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
                </div>

                {formRole === "staff" && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">OAB</label>
                    <input type="text" value={oabNumber} onChange={(e) => setOabNumber(e.target.value)} placeholder="RS 123456" className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
                  </div>
                )}

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
                    {result.alreadyExisted
                      ? "Este email já possui cadastro. O usuário foi vinculado ao escritório com a senha existente."
                      : "Compartilhe a senha temporária abaixo:"}
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
                <button onClick={handleCloseModal} className="w-full h-10 rounded-lg border text-sm font-medium text-foreground hover:bg-muted transition-colors">
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default TeamManagement;
