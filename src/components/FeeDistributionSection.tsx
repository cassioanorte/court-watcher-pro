import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Users, ArrowDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [formLawyerId, setFormLawyerId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPaidAt, setFormPaidAt] = useState("");
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
    // Filter to only staff/owner by checking user_roles
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

  const handleSubmit = async () => {
    if (!tenantId || !userId || !formOrderId || !formLawyerId || !formAmount) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const selectedStaff = staff.find(s => s.user_id === formLawyerId);
    setSubmitting(true);
    const { error } = await supabase.from("fee_distributions" as any).insert({
      tenant_id: tenantId,
      payment_order_id: formOrderId,
      lawyer_user_id: formLawyerId,
      lawyer_name: selectedStaff?.full_name || "—",
      amount: parseFloat(formAmount) || 0,
      description: formDescription || null,
      paid_at: formPaidAt || null,
      created_by: userId,
    });
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Distribuição registrada!");
      setShowNew(false);
      setFormOrderId("");
      setFormLawyerId("");
      setFormAmount("");
      setFormDescription("");
      setFormPaidAt("");
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

  // Group by lawyer
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
                      <td className="p-3 text-muted-foreground text-xs">{d.description || "—"}</td>
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
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lançar Saída de Honorários</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">RPV/Precatório *</label>
              <Select value={formOrderId} onValueChange={setFormOrderId}>
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
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Advogado *</label>
              <Select value={formLawyerId} onValueChange={setFormLawyerId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {staff.map(s => (
                    <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valor (R$) *</label>
              <Input type="number" step="0.01" placeholder="0,00" value={formAmount} onChange={e => setFormAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data do Pagamento</label>
              <Input type="date" value={formPaidAt} onChange={e => setFormPaidAt(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
              <Input placeholder="Ex: Quota-parte honorários contratuais" value={formDescription} onChange={e => setFormDescription(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Salvando..." : "Registrar Distribuição"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
