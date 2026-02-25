import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Receipt } from "lucide-react";
import { format } from "date-fns";

interface ContactExpensesProps {
  contactUserId: string;
  tenantId: string;
  cases: { id: string; process_number: string; parties?: string | null }[];
}

const EXPENSE_CATEGORIES = [
  "Custas Judiciais",
  "Taxas Cartorárias",
  "Diligências",
  "Cópias e Impressões",
  "Deslocamento / Km",
  "Hospedagem",
  "Alimentação",
  "Correios / Postagem",
  "Certidões",
  "Perícia",
  "Tradução Juramentada",
  "Publicação de Edital",
  "Autenticação / Reconhecimento",
  "Honorários Periciais",
  "Despesas com Testemunhas",
  "Outros",
];

const ContactExpenses = ({ contactUserId, tenantId, cases }: ContactExpensesProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: "Custas Judiciais",
    date: format(new Date(), "yyyy-MM-dd"),
    case_id: "",
    status: "pending",
  });

  const loadExpenses = async () => {
    const { data, error } = await supabase
      .from("financial_transactions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("client_user_id", contactUserId)
      .eq("type", "expense_client")
      .order("date", { ascending: false });
    if (!error && data) setExpenses(data);
    setLoading(false);
  };

  useEffect(() => {
    loadExpenses();
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
          type: "expense_client",
          status: form.status,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      setExpenses((prev) => [data, ...prev]);
      setForm({ description: "", amount: "", category: "Custas Judiciais", date: format(new Date(), "yyyy-MM-dd"), case_id: "", status: "pending" });
      setShowForm(false);
      toast({ title: "Despesa lançada!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expenseId: string) => {
    setDeletingId(expenseId);
    try {
      const { error } = await supabase.from("financial_transactions").delete().eq("id", expenseId);
      if (error) throw error;
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      toast({ title: "Despesa excluída." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const toggleStatus = async (expense: any) => {
    const newStatus = expense.status === "paid" ? "pending" : "paid";
    const { error } = await supabase
      .from("financial_transactions")
      .update({ status: newStatus })
      .eq("id", expense.id);
    if (!error) {
      setExpenses((prev) => prev.map((e) => e.id === expense.id ? { ...e, status: newStatus } : e));
    }
  };

  const totalPending = expenses.filter((e) => e.status !== "paid").reduce((sum, e) => sum + Number(e.amount), 0);
  const totalPaid = expenses.filter((e) => e.status === "paid").reduce((sum, e) => sum + Number(e.amount), 0);

  const getCaseLabel = (caseId: string) => {
    const c = cases.find((cs) => cs.id === caseId);
    return c ? c.process_number : "";
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Carregando despesas...</div>;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total a Cobrar</p>
          <p className="text-lg font-bold text-destructive mt-1">
            R$ {totalPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Pago</p>
          <p className="text-lg font-bold text-emerald-600 mt-1">
            R$ {totalPaid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Lançamentos</p>
          <p className="text-lg font-bold text-foreground mt-1">{expenses.length}</p>
        </div>
      </div>

      {/* Add Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" /> Lançar Despesa
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Nova Despesa</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Descrição *</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Custas de distribuição"
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
              <label className="text-xs font-medium text-muted-foreground">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="mt-1 h-9 px-2 rounded border bg-background text-sm text-foreground w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
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
                <option value="">Nenhum (despesa geral)</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.process_number}</option>
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
                <option value="pending">Pendente (a cobrar)</option>
                <option value="paid">Pago pelo cliente</option>
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
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Receipt className="w-3.5 h-3.5" />}
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {/* Expenses List */}
      {expenses.length === 0 ? (
        <div className="bg-card border rounded-lg p-8 text-center">
          <Receipt className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma despesa lançada para este contato.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Use o botão acima para registrar despesas reembolsáveis.</p>
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descrição</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categoria</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Processo</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 text-foreground whitespace-nowrap">
                    {format(new Date(exp.date + "T12:00:00"), "dd/MM/yyyy")}
                  </td>
                  <td className="px-4 py-2.5 text-foreground">{exp.description}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{exp.category}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono">
                    {exp.case_id ? getCaseLabel(exp.case_id) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">
                    R$ {Number(exp.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => toggleStatus(exp)}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide border transition-colors cursor-pointer ${
                        exp.status === "paid"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20"
                      }`}
                    >
                      {exp.status === "paid" ? "Pago" : "Pendente"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    {confirmDeleteId === exp.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(exp.id)}
                          disabled={deletingId === exp.id}
                          className="text-[10px] px-2 py-0.5 rounded bg-destructive text-destructive-foreground font-semibold hover:opacity-90"
                        >
                          {deletingId === exp.id ? "..." : "Confirmar"}
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
                        onClick={() => setConfirmDeleteId(exp.id)}
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

export default ContactExpenses;
