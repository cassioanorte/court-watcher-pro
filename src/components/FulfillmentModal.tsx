import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2 } from "lucide-react";

const CATEGORIES = [
  { value: "peticao", label: "Petição" },
  { value: "recurso", label: "Recurso" },
  { value: "cumprimento_despacho", label: "Cumprimento de Despacho" },
  { value: "audiencia_diligencia", label: "Audiência/Diligência" },
  { value: "contato_cliente", label: "Ligar para o Cliente" },
  { value: "solicitar_documentacao", label: "Solicitar Documentação" },
  { value: "manifestacao", label: "Manifestação" },
  { value: "alvara", label: "Alvará" },
  { value: "calculo", label: "Cálculo" },
  { value: "providencia_administrativa", label: "Providência Administrativa" },
  { value: "contestacao", label: "Contestação" },
  { value: "replica", label: "Réplica" },
  { value: "outro", label: "Outro" },
];

const PRIORITIES = [
  { value: "urgente", label: "🔴 Urgente" },
  { value: "normal", label: "🟡 Normal" },
  { value: "baixa", label: "🟢 Baixa" },
];

const SUGGESTED_DAYS = [5, 10, 15, 30];

interface FulfillmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId?: string;
  processNumber?: string;
  sourceType?: "publication" | "movement" | "manual";
  sourceId?: string;
  onCreated?: () => void;
}

interface StaffMember {
  user_id: string;
  full_name: string;
  position: string | null;
  oab_number: string | null;
}

const FulfillmentModal = ({ open, onOpenChange, caseId, processNumber, sourceType, sourceId, onCreated }: FulfillmentModalProps) => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [cases, setCases] = useState<{ id: string; process_number: string }[]>([]);

  const [category, setCategory] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("normal");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState(caseId || "");

  useEffect(() => {
    if (!tenantId || !open) return;
    // Fetch staff members
    const fetchStaff = async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, position, oab_number")
        .eq("tenant_id", tenantId);
      if (!profiles) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", profiles.map(p => p.user_id));
      const staffIds = new Set((roles || []).filter(r => r.role === "owner" || r.role === "staff").map(r => r.user_id));
      setStaff(profiles.filter(p => staffIds.has(p.user_id)));
    };
    fetchStaff();

    // Fetch cases - always fetch so we can resolve processNumber to caseId
    supabase.from("cases").select("id, process_number").eq("tenant_id", tenantId).eq("archived", false).order("process_number").then(({ data }) => {
      const allCases = data || [];
      setCases(allCases);
      // Auto-select case if processNumber provided but no caseId
      if (!caseId && processNumber) {
        const match = allCases.find(c => c.process_number === processNumber);
        if (match) setSelectedCaseId(match.id);
      }
    });
  }, [tenantId, open, caseId, processNumber]);

  useEffect(() => {
    setSelectedCaseId(caseId || "");
  }, [caseId]);

  const setSuggestedDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().split("T")[0]);
  };

  const handleSubmit = async () => {
    if (!category || !assignedTo || !dueDate || !selectedCaseId) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("case_fulfillments").insert({
        case_id: selectedCaseId,
        tenant_id: tenantId!,
        category,
        description: description || null,
        assigned_to: assignedTo,
        assigned_by: user!.id,
        due_date: dueDate,
        status: "pendente",
        source_type: sourceType || "manual",
        source_id: sourceId || null,
        priority,
        notes: notes || null,
      });
      if (error) throw error;
      toast({ title: "Cumprimento criado!", description: "O responsável foi notificado." });
      onOpenChange(false);
      resetForm();
      onCreated?.();
    } catch (err: any) {
      toast({ title: "Erro ao criar cumprimento", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setCategory("");
    setAssignedTo("");
    setDueDate("");
    setPriority("normal");
    setDescription("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-accent" />
            Encaminhar para Cumprimento
          </DialogTitle>
        </DialogHeader>

        {processNumber && (
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 font-mono">
            Processo: {processNumber}
          </div>
        )}

        <div className="space-y-4 mt-2">
          {/* Case selector (only if no caseId) */}
          {!caseId && (
            <div className="space-y-1.5">
              <Label>Processo *</Label>
              <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o processo" />
                </SelectTrigger>
                <SelectContent>
                  {cases.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.process_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Tipo de Ação *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a ação" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assigned to */}
          <div className="space-y-1.5">
            <Label>Responsável *</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {staff.map(s => (
                  <SelectItem key={s.user_id} value={s.user_id}>
                    {s.full_name} {s.oab_number ? `(OAB ${s.oab_number})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due date with suggestions */}
          <div className="space-y-1.5">
            <Label>Prazo *</Label>
            <div className="flex items-center gap-2">
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="flex-1" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {SUGGESTED_DAYS.map(d => (
                <Button key={d} type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => setSuggestedDays(d)}>
                  {d} dias
                </Button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea placeholder="Descreva o que precisa ser feito..." value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Input placeholder="Observações adicionais..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <Button onClick={handleSubmit} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Encaminhar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FulfillmentModal;
