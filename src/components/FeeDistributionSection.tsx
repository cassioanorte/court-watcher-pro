import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Users, ArrowDownRight, UserPlus, MinusCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface PaymentOrder {
  id: string;
  process_number: string | null;
  beneficiary_name: string | null;
  office_amount: number;
  type: string;
}

interface FeeDistribution {
  id: string;
  payment_order_id: string;
  lawyer_user_id: string;
  lawyer_name: string;
  amount: number;
  description: string | null;
  paid_at: string | null;
  created_at: string;
}

interface StaffProfile {
  user_id: string;
  full_name: string;
}

interface LawyerSplit {
  lawyerId: string;
  mode: "valor" | "percentual";
  percent: string;
  amount: string;
}

interface Props {
  orders: PaymentOrder[];
  tenantId: string | null;
  userId: string;
  fmt: (v: number) => string;
}

export const FeeDistributionSection = ({ orders, tenantId, userId, fmt }: Props) => {
  const [distributions, setDistributions] = useState<FeeDistribution[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [formOrderId, setFormOrderId] = useState("");
  const [formExpenses, setFormExpenses] = useState("");
  const [formExpensesDesc, setFormExpensesDesc] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPaidAt, setFormPaidAt] = useState("");
  const [splits, setSplits] = useState<LawyerSplit[]>([{ lawyerId: "", mode: "percentual", percent: "", amount: "" }]);
  const [submitting, setSubmitting] = useState(false);

  const fetchDistributions = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("fee_distributions" as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setDistributions((data || []) as unknown as FeeDistribution[]);
  }, [tenantId]);

  const fetchStaff = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("tenant_id", tenantId);
    const { data: roles } = await supabase
      .from("user_roles" as any)
      .select("user_id, role");
    const staffIds = new Set(
      ((roles || []) as any[])
        .filter((r: any) => r.role === "owner" || r.role === "staff")
        .map((r: any) => r.user_id)
    );
    setStaff(((data || []) as StaffProfile[]).filter(p => staffIds.has(p.user_id)));
  }, [tenantId]);

  useEffect(() => {
    fetchDistributions();
    fetchStaff();
  }, [fetchDistributions, fetchStaff]);

  const selectedOrder = orders.find(o => o.id === formOrderId);
  const expensesAmount = parseFloat(formExpenses) || 0;
  const baseAmount = selectedOrder ? selectedOrder.office_amount : 0;
  const netAmount = Math.max(baseAmount - expensesAmount, 0);

  const updateSplit = (index: number, field: keyof LawyerSplit, value: string) => {
    setSplits(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Auto-calculate amount when percent changes
      if (field === "percent" && updated[index].mode === "percentual") {
        const calc = Math.round(netAmount * (parseFloat(value) || 0) / 100 * 100) / 100;
        updated[index].amount = calc > 0 ? calc.toString() : "";
      }
      // Auto-calculate percent when amount changes in valor mode
      if (field === "amount" && updated[index].mode === "valor" && netAmount > 0) {
        const calc = Math.round((parseFloat(value) || 0) / netAmount * 100 * 100) / 100;
        updated[index].percent = calc > 0 ? calc.toString() : "";
      }

      return updated;
    });
  };

  const toggleSplitMode = (index: number, mode: "valor" | "percentual") => {
    setSplits(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], mode };
      return updated;
    });
  };

  const addSplit = () => {
    setSplits(prev => [...prev, { lawyerId: "", mode: "percentual", percent: "", amount: "" }]);
  };

  const removeSplit = (index: number) => {
    setSplits(prev => prev.filter((_, i) => i !== index));
  };

  const totalSplitAmount = splits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0);
  const totalSplitPercent = splits.reduce((s, sp) => s + (parseFloat(sp.percent) || 0), 0);
  const remaining = netAmount - totalSplitAmount;

  const resetForm = () => {
    setFormOrderId("");
    setFormExpenses("");
    setFormExpensesDesc("");
    setFormDescription("");
    setFormPaidAt("");
    setSplits([{ lawyerId: "", mode: "percentual", percent: "", amount: "" }]);
  };

  const handleSubmit = async () => {
    if (!tenantId || !userId || !formOrderId) {
      toast.error("Selecione um RPV/Precatório");
      return;
    }

    const validSplits = splits.filter(sp => sp.lawyerId && (parseFloat(sp.amount) || 0) > 0);
    if (validSplits.length === 0) {
      toast.error("Adicione pelo menos um advogado com valor válido");
      return;
    }

    // Check for duplicate lawyers
    const lawyerIds = validSplits.map(sp => sp.lawyerId);
    if (new Set(lawyerIds).size !== lawyerIds.length) {
      toast.error("Não é possível adicionar o mesmo advogado mais de uma vez");
      return;
    }

    if (totalSplitAmount > netAmount + 0.01) {
      toast.error("O total distribuído excede o valor líquido disponível");
      return;
    }

    setSubmitting(true);
    const inserts = validSplits.map(sp => {
      const staffMember = staff.find(s => s.user_id === sp.lawyerId);
      const desc = [
        formDescription,
        expensesAmount > 0 ? `Despesas descontadas: ${fmt(expensesAmount)}${formExpensesDesc ? ` (${formExpensesDesc})` : ""}` : "",
        sp.percent ? `${sp.percent}% do líquido` : "",
      ].filter(Boolean).join(" | ");

      return {
        tenant_id: tenantId,
        payment_order_id: formOrderId,
        lawyer_user_id: sp.lawyerId,
        lawyer_name: staffMember?.full_name || "—",
        amount: parseFloat(sp.amount) || 0,
        description: desc || null,
        paid_at: formPaidAt || null,
        created_by: userId,
      };
    });

    const { error } = await supabase.from("fee_distributions" as any).insert(inserts);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      // Register expense as financial transaction if any
      if (expensesAmount > 0 && selectedOrder) {
        await supabase.from("financial_transactions").insert({
          tenant_id: tenantId,
          type: "expense",
          category: "Despesas Processuais",
          amount: expensesAmount,
          description: `Despesa descontada do rateio — ${selectedOrder.type.toUpperCase()} ${selectedOrder.process_number || selectedOrder.beneficiary_name || ""}${formExpensesDesc ? `: ${formExpensesDesc}` : ""}`,
          case_id: (selectedOrder as any).case_id || null,
          created_by: userId,
          date: formPaidAt || new Date().toISOString().split("T")[0],
          status: "confirmed",
        });
      }
      toast.success(`${validSplits.length} distribuição(ões) registrada(s)!`);
      setShowNew(false);
      resetForm();
      fetchDistributions();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta distribuição?")) return;
    await supabase.from("fee_distributions" as any).delete().eq("id", id);
    setDistributions(prev => prev.filter(d => d.id !== id));
    toast.success("Excluído");
  };

  const activeOrders = orders.filter(o => (o as any).status !== "cancelado" && o.office_amount > 0);
  const totalDistributed = distributions.reduce((s, d) => s + (d.amount || 0), 0);

  const byLawyer = distributions.reduce<Record<string, { name: string; total: number; count: number }>>((acc, d) => {
    if (!acc[d.lawyer_user_id]) acc[d.lawyer_user_id] = { name: d.lawyer_name, total: 0, count: 0 };
    acc[d.lawyer_user_id].total += d.amount || 0;
    acc[d.lawyer_user_id].count += 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Distribuição de Honorários</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowNew(true)} className="gap-1">
          <Plus className="w-4 h-4" /> Lançar Saída
        </Button>
      </div>

      {/* Summary by lawyer */}
      {Object.keys(byLawyer).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(byLawyer).map(([uid, info]) => (
            <div key={uid} className="bg-card rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{info.name}</p>
                <Badge variant="secondary" className="text-xs">{info.count} lançamentos</Badge>
              </div>
              <p className="text-lg font-bold text-accent mt-1">{fmt(info.total)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Distribution list */}
      {distributions.length > 0 ? (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="p-3 font-medium">Advogado</th>
                  <th className="p-3 font-medium">RPV/Precatório</th>
                  <th className="p-3 font-medium text-right">Valor</th>
                  <th className="p-3 font-medium">Data Pgto</th>
                  <th className="p-3 font-medium">Descrição</th>
                  <th className="p-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {distributions.map(d => {
                  const order = orders.find(o => o.id === d.payment_order_id);
                  return (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium text-foreground">{d.lawyer_name}</td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {order ? (
                          <span className="font-mono">{order.process_number || order.beneficiary_name || "—"}</span>
                        ) : "—"}
                      </td>
                      <td className="p-3 text-right font-medium text-accent">{fmt(d.amount)}</td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {d.paid_at ? new Date(d.paid_at + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">{d.description || "—"}</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(d.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t p-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Total Distribuído</span>
            <span className="font-bold text-foreground">{fmt(totalDistributed)}</span>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border p-6 text-center">
          <ArrowDownRight className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma distribuição registrada</p>
        </div>
      )}

      {/* New Distribution Dialog */}
      <Dialog open={showNew} onOpenChange={(open) => { setShowNew(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lançar Rateio de Honorários</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Order selection */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">RPV/Precatório *</label>
              <Select value={formOrderId} onValueChange={(v) => {
                setFormOrderId(v);
                // Recalculate splits when order changes
                setSplits(prev => prev.map(sp => {
                  if (sp.mode === "percentual" && sp.percent) {
                    const order = orders.find(o => o.id === v);
                    const net = order ? Math.max(order.office_amount - expensesAmount, 0) : 0;
                    const calc = Math.round(net * (parseFloat(sp.percent) || 0) / 100 * 100) / 100;
                    return { ...sp, amount: calc > 0 ? calc.toString() : "" };
                  }
                  return sp;
                }));
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {activeOrders.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.type.toUpperCase()} — {o.process_number || o.beneficiary_name || "Sem número"} ({fmt(o.office_amount)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Expenses deduction */}
            {formOrderId && (
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <label className="text-xs font-medium text-foreground block">Despesas a Descontar (antes do rateio)</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Valor (R$)"
                    value={formExpenses}
                    className="w-32"
                    onChange={e => {
                      setFormExpenses(e.target.value);
                      const exp = parseFloat(e.target.value) || 0;
                      const net = Math.max(baseAmount - exp, 0);
                      setSplits(prev => prev.map(sp => {
                        if (sp.mode === "percentual" && sp.percent) {
                          const calc = Math.round(net * (parseFloat(sp.percent) || 0) / 100 * 100) / 100;
                          return { ...sp, amount: calc > 0 ? calc.toString() : "" };
                        }
                        return sp;
                      }));
                    }}
                  />
                  <Input
                    placeholder="Descrição da despesa"
                    value={formExpensesDesc}
                    className="flex-1"
                    onChange={e => setFormExpensesDesc(e.target.value)}
                  />
                </div>
                {baseAmount > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Honorários: {fmt(baseAmount)}</span>
                    {expensesAmount > 0 && <span>− Despesas: {fmt(expensesAmount)}</span>}
                    <span className="font-semibold text-foreground">Líquido p/ rateio: {fmt(netAmount)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Lawyer splits */}
            {formOrderId && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">Advogados no Rateio</label>
                    <Button type="button" variant="ghost" size="sm" onClick={addSplit} className="gap-1 text-xs h-7">
                      <UserPlus className="w-3.5 h-3.5" /> Adicionar
                    </Button>
                  </div>

                  {splits.map((sp, idx) => (
                    <div key={idx} className="bg-card border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Select value={sp.lawyerId} onValueChange={v => updateSplit(idx, "lawyerId", v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecione o advogado" />
                            </SelectTrigger>
                            <SelectContent>
                              {staff.map(s => (
                                <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {splits.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeSplit(idx)}>
                            <MinusCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex gap-1">
                          <Button type="button" variant={sp.mode === "percentual" ? "default" : "outline"} size="sm" className="h-7 text-xs px-2" onClick={() => toggleSplitMode(idx, "percentual")}>%</Button>
                          <Button type="button" variant={sp.mode === "valor" ? "default" : "outline"} size="sm" className="h-7 text-xs px-2" onClick={() => toggleSplitMode(idx, "valor")}>R$</Button>
                        </div>
                        {sp.mode === "percentual" ? (
                          <div className="flex-1">
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="Ex: 25"
                              className="h-8 text-sm"
                              value={sp.percent}
                              onChange={e => updateSplit(idx, "percent", e.target.value)}
                            />
                          </div>
                        ) : (
                          <div className="flex-1">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0,00"
                              className="h-8 text-sm"
                              value={sp.amount}
                              onChange={e => updateSplit(idx, "amount", e.target.value)}
                            />
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[80px] text-right">
                          {sp.amount ? fmt(parseFloat(sp.amount) || 0) : "—"}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Summary */}
                  {netAmount > 0 && (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Líquido p/ rateio</span>
                        <span className="text-foreground">{fmt(netAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total distribuído ({totalSplitPercent.toFixed(1)}%)</span>
                        <span className={`font-medium ${totalSplitAmount > netAmount + 0.01 ? "text-destructive" : "text-foreground"}`}>
                          {fmt(totalSplitAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span className="text-muted-foreground">Saldo restante</span>
                        <span className={remaining < -0.01 ? "text-destructive" : "text-foreground"}>
                          {fmt(remaining)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Common fields */}
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data do Pagamento</label>
                <Input type="date" value={formPaidAt} onChange={e => setFormPaidAt(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
                <Input placeholder="Ex: Rateio honorários" value={formDescription} onChange={e => setFormDescription(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Salvando..." : `Registrar ${splits.filter(sp => sp.lawyerId && (parseFloat(sp.amount) || 0) > 0).length} Distribuição(ões)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
