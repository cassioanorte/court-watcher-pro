import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { UserCheck, ArrowRight, Plus, Loader2, X, Shield, ShieldAlert } from "lucide-react";

interface SubstabelecimentoRecord {
  id: string;
  case_id: string;
  from_user_id: string;
  to_user_id: string;
  type: "com_reservas" | "sem_reservas";
  notes: string | null;
  created_by: string;
  created_at: string;
}

interface StaffOption {
  user_id: string;
  full_name: string;
  oab_number: string | null;
}

interface SubstabelecimentoSectionProps {
  caseId: string;
  responsibleUserId: string | null;
  onResponsibleChanged: (newId: string) => void;
}

const SubstabelecimentoSection = ({ caseId, responsibleUserId, onResponsibleChanged }: SubstabelecimentoSectionProps) => {
  const { tenantId, user, role } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<SubstabelecimentoRecord[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fromUserId, setFromUserId] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [type, setType] = useState<"com_reservas" | "sem_reservas">("com_reservas");
  const [notes, setNotes] = useState("");

  const isLawyer = role === "owner" || role === "staff" || role === "superadmin";

  useEffect(() => {
    if (!tenantId) return;
    loadData();
  }, [tenantId, caseId]);

  const loadData = async () => {
    if (!tenantId) return;

    const [subsRes, profilesRes, rolesRes] = await Promise.all([
      supabase.from("substabelecimentos").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, oab_number").eq("tenant_id", tenantId),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const roleMap: Record<string, string> = {};
    roles.forEach((r) => { roleMap[r.user_id] = r.role; });

    const pMap: Record<string, string> = {};
    profiles.forEach((p) => { pMap[p.user_id] = p.full_name; });
    setProfileMap(pMap);

    const lawyers = profiles.filter((p) => roleMap[p.user_id] === "owner" || roleMap[p.user_id] === "staff");
    setStaffOptions(lawyers);

    setRecords((subsRes.data || []) as SubstabelecimentoRecord[]);

    // Default from = current responsible
    if (responsibleUserId) setFromUserId(responsibleUserId);

    setLoading(false);
  };

  const logActivity = async (description: string, metadata?: any) => {
    if (!tenantId || !user) return;
    await supabase.from("case_activities").insert({
      case_id: caseId,
      tenant_id: tenantId,
      user_id: user.id,
      action_type: "substabelecimento",
      description,
      metadata,
    } as any);
  };

  const handleSubmit = async () => {
    if (!tenantId || !user || !fromUserId || !toUserId) return;
    if (fromUserId === toUserId) {
      toast({ title: "Erro", description: "O advogado de origem e destino devem ser diferentes.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("substabelecimentos").insert({
        case_id: caseId,
        tenant_id: tenantId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        type,
        notes: notes.trim() || null,
        created_by: user.id,
      } as any).select("*").single();

      if (error) throw error;

      // If sem_reservas, update responsible_user_id on the case
      if (type === "sem_reservas") {
        const { error: updateErr } = await supabase
          .from("cases")
          .update({ responsible_user_id: toUserId, responsible_user_ids: [toUserId] } as any)
          .eq("id", caseId);
        if (updateErr) throw updateErr;
        onResponsibleChanged(toUserId);
      }

      const fromName = profileMap[fromUserId] || fromUserId;
      const toName = profileMap[toUserId] || toUserId;
      const typeLabel = type === "com_reservas" ? "com reservas" : "sem reservas";
      await logActivity(
        `Substabelecimento ${typeLabel}: ${fromName} → ${toName}${notes.trim() ? `. Obs: ${notes.trim()}` : ""}`,
        { from_user_id: fromUserId, to_user_id: toUserId, type }
      );

      if (data) setRecords((prev) => [data as SubstabelecimentoRecord, ...prev]);
      setShowForm(false);
      setToUserId("");
      setNotes("");
      toast({ title: "Substabelecimento registrado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground py-4">Carregando...</p>;

  return (
    <div className="space-y-4">
      {/* Current responsible */}
      <div className="bg-card rounded-lg border p-4 shadow-card">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Advogado Responsável Atual</p>
        <p className="text-sm font-semibold text-foreground">
          {responsibleUserId ? (profileMap[responsibleUserId] || "—") : "Não definido"}
        </p>
      </div>

      {/* New substabelecimento */}
      {isLawyer && (
        showForm ? (
          <div className="bg-card rounded-lg border p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-accent" /> Novo Substabelecimento
              </h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">De (advogado atual)</label>
                <select
                  value={fromUserId}
                  onChange={(e) => setFromUserId(e.target.value)}
                  className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                >
                  <option value="">Selecione...</option>
                  {staffOptions.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {s.full_name}{s.oab_number ? ` (${s.oab_number})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Para (novo advogado)</label>
                <select
                  value={toUserId}
                  onChange={(e) => setToUserId(e.target.value)}
                  className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                >
                  <option value="">Selecione...</option>
                  {staffOptions.filter((s) => s.user_id !== fromUserId).map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {s.full_name}{s.oab_number ? ` (${s.oab_number})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo</label>
              <div className="mt-2 flex gap-3">
                <label className={`flex-1 cursor-pointer rounded-lg border-2 p-3 transition-colors ${type === "com_reservas" ? "border-accent bg-accent/5" : "border-border hover:border-muted-foreground/30"}`}>
                  <input type="radio" name="sub_type" value="com_reservas" checked={type === "com_reservas"} onChange={() => setType("com_reservas")} className="sr-only" />
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-accent" />
                    <span className="text-sm font-semibold text-foreground">Com Reservas</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Ambos os advogados permanecem responsáveis pelo processo.</p>
                </label>
                <label className={`flex-1 cursor-pointer rounded-lg border-2 p-3 transition-colors ${type === "sem_reservas" ? "border-accent bg-accent/5" : "border-border hover:border-muted-foreground/30"}`}>
                  <input type="radio" name="sub_type" value="sem_reservas" checked={type === "sem_reservas"} onChange={() => setType("sem_reservas")} className="sr-only" />
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-semibold text-foreground">Sem Reservas</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Apenas o novo advogado será responsável. O anterior perde a responsabilidade.</p>
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Observações (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Motivo, condições, referências..."
                className="w-full mt-1 px-3 py-2 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 h-9 rounded-lg border text-sm font-medium text-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !fromUserId || !toUserId}
                className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                {saving ? "Registrando..." : "Registrar Substabelecimento"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full border-2 border-dashed rounded-lg p-4 text-sm text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Novo Substabelecimento
          </button>
        )
      )}

      {/* History */}
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum substabelecimento registrado.</p>
      ) : (
        <div className="space-y-0">
          {records.map((rec, i) => (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="relative pl-8 pb-5 last:pb-0"
            >
              {i < records.length - 1 && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />}
              <div className={`absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center ${rec.type === "sem_reservas" ? "border-orange-500 bg-orange-500/15" : "border-accent bg-accent/15"}`}>
                <UserCheck className={`w-3 h-3 ${rec.type === "sem_reservas" ? "text-orange-500" : "text-accent"}`} />
              </div>
              <div className="bg-card rounded-lg border p-4 shadow-card">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${rec.type === "com_reservas" ? "bg-accent/10 text-accent" : "bg-orange-500/10 text-orange-600"}`}>
                    {rec.type === "com_reservas" ? "Com Reservas" : "Sem Reservas"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(rec.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <span className="font-medium">{profileMap[rec.from_user_id] || rec.from_user_id}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-medium">{profileMap[rec.to_user_id] || rec.to_user_id}</span>
                </div>
                {rec.notes && <p className="text-xs text-muted-foreground mt-2">{rec.notes}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">Registrado por: {profileMap[rec.created_by] || rec.created_by}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SubstabelecimentoSection;
