import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Scale } from "lucide-react";
import { format } from "date-fns";

interface ContactFeesProps {
  contactUserId: string;
  tenantId: string;
  cases: { id: string; process_number: string; parties?: string | null }[];
}

const FEE_CATEGORIES = [
  "Consulta Presencial",
  "Consulta Online",
  "Consulta por Telefone",
  "Honorários Iniciais",
  "Honorários Contratuais",
  "Honorários Ad Exitum",
  "Parecer Jurídico",
  "Análise de Documentos",
  "Elaboração de Contrato",
  "Elaboração de Petição",
  "Mediação / Conciliação",
  "Outros",
];

const PAYMENT_METHODS = [
  "Dinheiro",
  "PIX",
  "Transferência Bancária",
  "Cartão de Crédito",
  "Cartão de Débito",
  "Boleto",
  "Cheque",
  "Parcelado",
];

const ContactFees = ({ contactUserId, tenantId, cases }: ContactFeesProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fees, setFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: "Consulta Presencial",
    date: format(new Date(), "yyyy-MM-dd"),
    case_id: "",
    status: "pending",
    recurrence: "",
  });

  const loadFees = async () => {
    const { data, error } = await supabase
      .from("financial_transactions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("client_user_id", contactUserId)
      .eq("type", "fee_initial")
      .order("date", { ascending: false });
    if (!error && data) setFees(data);
    setLoading(false);
  };

  useEffect(() => {
    loadFees();
  }, [contactUserId, tenantId]);

  const handleSubmit = async () => {
    if (!form.description.trim() || !form.amount || parseFloat(form.amount) <= 0) {
      toast({ title: "Preencha a descrição e o valor.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("financial_transactions")
        .insert({
          tenant_id: tenantId,
          client_user_id: contactUserId,
          case_id: form.case_id || null,
          description: form.description.trim(),
          amount: parseFloat(form.amount),
          category: form.category,
          date: form.date,
          type: "fee_initial",
          status: form.status,
          recurrence: form.recurrence || null,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      setFees((prev) => [data, ...prev]);
      setForm({ description: "", amount: "", category: "Consulta Presencial", date: format(new Date(), "yyyy-MM-dd"), case_id: "", status: "pending", recurrence: "" });
      setShowForm(false);
      toast({ title: "Honorário lançado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
      if (error) throw error;
      setFees((prev) => prev.filter((e) => e.id !== id));
      toast({ title: "Registro excluído." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const toggleStatus = async (fee: any) => {
    const newStatus = fee.status === "paid" ? "pending" : "paid";
    const { error } = await supabase
      .from("financial_transactions")
      .update({ status: newStatus })
      .eq("id", fee.id);
    if (!error) {
      setFees((prev) => prev.map((e) => e.id === fee.id ? { ...e, status: newStatus } : e));
    }
  };

  const totalPending = fees.filter((e) => e.status !== "paid").reduce((sum, e) => sum + Number(e.amount), 0);
  const totalPaid = fees.filter((e) => e.status === "paid").reduce((sum, e) => sum + Number(e.amount), 0);

  const getCaseLabel = (caseId: string) => {
    const c = cases.find((cs) => cs.id === caseId);
    return c ? c.process_number : "";
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Carregando...</div>;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">A Receber</p>
          <p className="text-lg font-bold text-amber-600 mt-1">
            R$ {totalPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Recebido</p>
          <p className="text-lg font-bold text-emerald-600 mt-1">
            R$ {totalPaid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Lançamentos</p>
          <p className="text-lg font-bold text-foreground mt-1">{fees.length}</p>
        </div>
      </div>

      {/* Add Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" /> Lançar Consulta / Honorário
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Novo Lançamento</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Descrição *</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Consulta inicial sobre divórcio"
                className="mt-1 h-9 px-3 rounded border bg-background text-sm text-foreground w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0,00"
                className="mt-1 h-9 px-3 rounded border bg-background text-sm text-foreground w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="mt-1 h-9 px-2 rounded border bg-background text-sm text-foreground w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {FEE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Data</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="mt-1 h-9 px-3 rounded border bg-background text-sm text-foreground w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Processo Vinculado</label>
              <select
                value={form.case_id}
                onChange={(e) => setForm((f) => ({ ...f, case_id: e.target.value }))}
                className="mt-1 h-9 px-2 rounded border bg-background text-sm text-foreground w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Nenhum (consulta avulsa)</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.process_number}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Forma de Pagamento</label>
              <select
                value={form.recurrence}
                onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value }))}
                className="mt-1 h-9 px-2 rounded border bg-background text-sm text-foreground w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Não informado</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="mt-1 h-9 px-2 rounded border bg-background text-sm text-foreground w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="pending">Pendente</option>
                <option value="paid">Recebido</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />}
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {fees.length === 0 ? (
        <div className="bg-card border rounded-lg p-8 text-center">
          <Scale className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum honorário ou consulta registrado.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Lance consultas e honorários iniciais do cliente.</p>
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descrição</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pagamento</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => (
                <tr key={fee.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 text-foreground whitespace-nowrap">
                    {format(new Date(fee.date + "T12:00:00"), "dd/MM/yyyy")}
                  </td>
                  <td className="px-4 py-2.5 text-foreground">{fee.description}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{fee.category}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{fee.recurrence || "—"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">
                    R$ {Number(fee.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => toggleStatus(fee)}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide border transition-colors cursor-pointer ${
                        fee.status === "paid"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20"
                      }`}
                    >
                      {fee.status === "paid" ? "Recebido" : "Pendente"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    {confirmDeleteId === fee.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(fee.id)}
                          disabled={deletingId === fee.id}
                          className="text-[10px] px-2 py-0.5 rounded bg-destructive text-destructive-foreground font-semibold hover:opacity-90"
                        >
                          {deletingId === fee.id ? "..." : "Confirmar"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[10px] px-2 py-0.5 rounded border text-muted-foreground hover:text-foreground"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(fee.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ContactFees;
