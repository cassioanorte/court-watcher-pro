import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus, Phone, Mail, MessageSquare, Calendar, ChevronRight,
  Plus, X, Search, Filter, BarChart3, Users, DollarSign, Clock,
  Check, Trash2, Edit2, Save, Loader2, ArrowRight, Building2,
  PhoneCall, Video, StickyNote, Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CrmStage = "contato_inicial" | "reuniao_agendada" | "proposta_enviada" | "negociacao" | "fechado_ganho" | "fechado_perdido";

interface Lead {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  company: string | null;
  origin: string | null;
  stage: CrmStage;
  notes: string | null;
  estimated_value: number;
  assigned_to: string | null;
  converted_client_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

interface Interaction {
  id: string;
  lead_id: string;
  tenant_id: string;
  type: string;
  description: string;
  created_by: string | null;
  created_at: string;
}

interface CrmTask {
  id: string;
  lead_id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  due_date: string;
  completed: boolean;
  completed_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
}

const STAGES: { key: CrmStage; label: string; color: string; bgColor: string }[] = [
  { key: "contato_inicial", label: "Contato Inicial", color: "text-blue-600", bgColor: "bg-blue-500/10 border-blue-500/20" },
  { key: "reuniao_agendada", label: "Reunião Agendada", color: "text-amber-600", bgColor: "bg-amber-500/10 border-amber-500/20" },
  { key: "proposta_enviada", label: "Proposta Enviada", color: "text-purple-600", bgColor: "bg-purple-500/10 border-purple-500/20" },
  { key: "negociacao", label: "Negociação", color: "text-orange-600", bgColor: "bg-orange-500/10 border-orange-500/20" },
  { key: "fechado_ganho", label: "Fechado (Ganho)", color: "text-emerald-600", bgColor: "bg-emerald-500/10 border-emerald-500/20" },
  { key: "fechado_perdido", label: "Fechado (Perdido)", color: "text-red-600", bgColor: "bg-red-500/10 border-red-500/20" },
];

const INTERACTION_TYPES = [
  { key: "call", label: "Ligação", icon: PhoneCall },
  { key: "email", label: "E-mail", icon: Mail },
  { key: "meeting", label: "Reunião", icon: Video },
  { key: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { key: "note", label: "Anotação", icon: StickyNote },
];

const ORIGINS = ["Indicação", "Site", "Redes Sociais", "OAB", "Google", "WhatsApp", "Telefone", "Evento", "Outro"];

const CRM = () => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  // New lead modal
  const [showNewLead, setShowNewLead] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", email: "", phone: "", cpf: "", company: "", origin: "", notes: "", estimated_value: "" });
  const [savingLead, setSavingLead] = useState(false);

  // Lead detail modal
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // New interaction
  const [newInteractionType, setNewInteractionType] = useState("note");
  const [newInteractionDesc, setNewInteractionDesc] = useState("");
  const [savingInteraction, setSavingInteraction] = useState(false);

  // New task
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", due_date: "" });
  const [savingTask, setSavingTask] = useState(false);

  // Edit lead
  const [editingLead, setEditingLead] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});

  // Staff list
  const [staff, setStaff] = useState<{ user_id: string; full_name: string }[]>([]);

  const fetchLeads = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("crm_leads")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false });
    if (!error) setLeads((data || []) as Lead[]);
    setLoading(false);
  };

  const fetchStaff = async () => {
    if (!tenantId) return;
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").eq("tenant_id", tenantId);
    if (!profiles) return;
    const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", profiles.map(p => p.user_id));
    const staffIds = new Set((roles || []).filter(r => r.role === "owner" || r.role === "staff").map(r => r.user_id));
    setStaff(profiles.filter(p => staffIds.has(p.user_id)));
  };

  useEffect(() => { fetchLeads(); fetchStaff(); }, [tenantId]);

  const handleCreateLead = async () => {
    if (!tenantId || !user || !newLead.name.trim()) return;
    setSavingLead(true);
    const { data, error } = await supabase.from("crm_leads").insert({
      tenant_id: tenantId,
      name: newLead.name.trim(),
      email: newLead.email || null,
      phone: newLead.phone || null,
      cpf: newLead.cpf || null,
      company: newLead.company || null,
      origin: newLead.origin || null,
      notes: newLead.notes || null,
      estimated_value: newLead.estimated_value ? parseFloat(newLead.estimated_value) : 0,
      created_by: user.id,
      stage: "contato_inicial" as CrmStage,
    }).select("*").single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else if (data) {
      setLeads(prev => [data as Lead, ...prev]);
      setShowNewLead(false);
      setNewLead({ name: "", email: "", phone: "", cpf: "", company: "", origin: "", notes: "", estimated_value: "" });
      toast({ title: "Lead criado!" });
    }
    setSavingLead(false);
  };

  const handleMoveStage = async (lead: Lead, newStage: CrmStage) => {
    const updates: any = { stage: newStage };
    if (newStage === "fechado_ganho" || newStage === "fechado_perdido") {
      updates.closed_at = new Date().toISOString();
    } else {
      updates.closed_at = null;
    }
    const { error } = await supabase.from("crm_leads").update(updates).eq("id", lead.id);
    if (!error) {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...updates } : l));
      if (selectedLead?.id === lead.id) setSelectedLead(prev => prev ? { ...prev, ...updates } : prev);
    }
  };

  const openLeadDetail = async (lead: Lead) => {
    setSelectedLead(lead);
    setEditingLead(false);
    setLoadingDetail(true);
    const [intRes, taskRes] = await Promise.all([
      supabase.from("crm_interactions").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }),
      supabase.from("crm_tasks").select("*").eq("lead_id", lead.id).order("due_date", { ascending: true }),
    ]);
    setInteractions((intRes.data || []) as Interaction[]);
    setTasks((taskRes.data || []) as CrmTask[]);
    setLoadingDetail(false);
  };

  const handleAddInteraction = async () => {
    if (!selectedLead || !tenantId || !user || !newInteractionDesc.trim()) return;
    setSavingInteraction(true);
    const { data, error } = await supabase.from("crm_interactions").insert({
      lead_id: selectedLead.id,
      tenant_id: tenantId,
      type: newInteractionType,
      description: newInteractionDesc.trim(),
      created_by: user.id,
    }).select("*").single();
    if (!error && data) {
      setInteractions(prev => [data as Interaction, ...prev]);
      setNewInteractionDesc("");
      toast({ title: "Interação registrada!" });
    }
    setSavingInteraction(false);
  };

  const handleAddTask = async () => {
    if (!selectedLead || !tenantId || !user || !newTask.title.trim() || !newTask.due_date) return;
    setSavingTask(true);
    const { data, error } = await supabase.from("crm_tasks").insert({
      lead_id: selectedLead.id,
      tenant_id: tenantId,
      title: newTask.title.trim(),
      description: newTask.description || null,
      due_date: newTask.due_date,
      assigned_to: user.id,
      created_by: user.id,
    }).select("*").single();
    if (!error && data) {
      setTasks(prev => [...prev, data as CrmTask]);
      setNewTask({ title: "", description: "", due_date: "" });
      setShowNewTask(false);
      toast({ title: "Tarefa criada!" });
    }
    setSavingTask(false);
  };

  const toggleTaskComplete = async (task: CrmTask) => {
    const updates = { completed: !task.completed, completed_at: !task.completed ? new Date().toISOString() : null };
    const { error } = await supabase.from("crm_tasks").update(updates).eq("id", task.id);
    if (!error) setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t));
  };

  const handleSaveEdit = async () => {
    if (!selectedLead) return;
    const { error } = await supabase.from("crm_leads").update({
      name: editForm.name,
      email: editForm.email || null,
      phone: editForm.phone || null,
      cpf: editForm.cpf || null,
      company: editForm.company || null,
      origin: editForm.origin || null,
      notes: editForm.notes || null,
      estimated_value: editForm.estimated_value || 0,
      assigned_to: editForm.assigned_to || null,
    }).eq("id", selectedLead.id);
    if (!error) {
      const updated = { ...selectedLead, ...editForm };
      setSelectedLead(updated);
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l));
      setEditingLead(false);
      toast({ title: "Lead atualizado!" });
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    const { error } = await supabase.from("crm_leads").delete().eq("id", leadId);
    if (!error) {
      setLeads(prev => prev.filter(l => l.id !== leadId));
      setSelectedLead(null);
      toast({ title: "Lead excluído!" });
    }
  };

  const filtered = leads.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.name.toLowerCase().includes(s) || l.email?.toLowerCase().includes(s) || l.phone?.includes(s) || l.company?.toLowerCase().includes(s);
  });

  // Metrics
  const activeLeads = leads.filter(l => !["fechado_ganho", "fechado_perdido"].includes(l.stage));
  const wonLeads = leads.filter(l => l.stage === "fechado_ganho");
  const totalValue = activeLeads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);
  const conversionRate = leads.length > 0 ? Math.round((wonLeads.length / leads.length) * 100) : 0;

  const stageLabel = (s: CrmStage) => STAGES.find(st => st.key === s)?.label || s;
  const stageInfo = (s: CrmStage) => STAGES.find(st => st.key === s);

  // Drag and drop state
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<CrmStage | null>(null);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("text/plain", leadId);
    setDraggedLeadId(leadId);
  };

  const handleDragOver = (e: React.DragEvent, stage: CrmStage) => {
    e.preventDefault();
    setDragOverStage(stage);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, stage: CrmStage) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    const lead = leads.find(l => l.id === leadId);
    if (lead && lead.stage !== stage) {
      handleMoveStage(lead, stage);
    }
    setDraggedLeadId(null);
    setDragOverStage(null);
  };

  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setDragOverStage(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de leads e relacionamento</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-0.5">
            <button onClick={() => setViewMode("kanban")} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === "kanban" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              Kanban
            </button>
            <button onClick={() => setViewMode("list")} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              Lista
            </button>
          </div>
          <Button onClick={() => setShowNewLead(true)} className="gap-2">
            <UserPlus className="w-4 h-4" /> Novo Lead
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wide font-medium">Leads Ativos</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{activeLeads.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wide font-medium">Valor Estimado</span>
          </div>
          <p className="text-2xl font-bold text-foreground">R$ {totalValue.toLocaleString("pt-BR")}</p>
        </div>
        <div className="bg-card border rounded-lg p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Check className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wide font-medium">Ganhos</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{wonLeads.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <BarChart3 className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wide font-medium">Conversão</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{conversionRate}%</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar lead por nome, e-mail, telefone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Kanban View */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : viewMode === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.filter(s => s.key !== "fechado_perdido").map(stage => {
            const stageLeads = filtered.filter(l => l.stage === stage.key);
            const isOver = dragOverStage === stage.key;
            return (
              <div
                key={stage.key}
                className="min-w-[280px] flex-shrink-0"
                onDragOver={(e) => handleDragOver(e, stage.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.key)}
              >
                <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border ${stage.bgColor}`}>
                  <span className={`text-sm font-semibold ${stage.color}`}>{stage.label}</span>
                  <span className={`text-xs font-medium ${stage.color}`}>{stageLeads.length}</span>
                </div>
                <div className={`bg-muted/30 rounded-b-lg border border-t-0 min-h-[200px] p-2 space-y-2 transition-colors ${isOver ? "bg-primary/5 border-primary/30" : ""}`}>
                  {stageLeads.map((lead, i) => (
                    <motion.div
                      key={lead.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      draggable
                      onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, lead.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => openLeadDetail(lead)}
                      className={`bg-card border rounded-lg p-3 cursor-grab hover:border-accent/30 transition-all shadow-sm active:cursor-grabbing ${draggedLeadId === lead.id ? "opacity-40" : ""}`}
                    >
                      <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
                      {lead.company && <p className="text-[10px] text-muted-foreground mt-0.5">{lead.company}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        {lead.estimated_value > 0 && (
                          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            R$ {lead.estimated_value.toLocaleString("pt-BR")}
                          </span>
                        )}
                        {lead.origin && (
                          <span className="text-[10px] text-muted-foreground">{lead.origin}</span>
                        )}
                      </div>
                      {lead.phone && (
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {lead.phone}
                        </p>
                      )}
                    </motion.div>
                  ))}
                  {stageLeads.length === 0 && (
                    <p className="text-xs text-muted-foreground/50 text-center py-8">
                      {isOver ? "Solte aqui" : "Nenhum lead"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-card rounded-lg shadow-card border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">Contato</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Etapa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden sm:table-cell">Origem</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((lead, i) => {
                  const si = stageInfo(lead.stage);
                  return (
                    <motion.tr
                      key={lead.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => openLeadDetail(lead)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{lead.name}</p>
                        {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-xs text-muted-foreground">{lead.email || lead.phone || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded border ${si?.bgColor} ${si?.color}`}>
                          {si?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">{lead.origin || "—"}</td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-foreground">
                        {lead.estimated_value > 0 ? `R$ ${lead.estimated_value.toLocaleString("pt-BR")}` : "—"}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum lead encontrado</p>
            </div>
          )}
        </div>
      )}

      {/* New Lead Modal */}
      <Dialog open={showNewLead} onOpenChange={setShowNewLead}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Nome *</label>
              <Input value={newLead.name} onChange={e => setNewLead(p => ({ ...p, name: e.target.value }))} placeholder="Nome completo" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">E-mail</label>
                <Input value={newLead.email} onChange={e => setNewLead(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">Telefone</label>
                <Input value={newLead.phone} onChange={e => setNewLead(p => ({ ...p, phone: e.target.value }))} placeholder="(51) 99999-9999" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">CPF</label>
                <Input value={newLead.cpf} onChange={e => setNewLead(p => ({ ...p, cpf: e.target.value }))} placeholder="000.000.000-00" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">Empresa</label>
                <Input value={newLead.company} onChange={e => setNewLead(p => ({ ...p, company: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">Origem</label>
                <select value={newLead.origin} onChange={e => setNewLead(p => ({ ...p, origin: e.target.value }))} className="w-full mt-1 h-10 px-3 rounded-md bg-background border text-sm text-foreground">
                  <option value="">Selecione...</option>
                  {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">Valor Estimado</label>
                <Input type="number" value={newLead.estimated_value} onChange={e => setNewLead(p => ({ ...p, estimated_value: e.target.value }))} placeholder="0,00" className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Observações</label>
              <textarea value={newLead.notes} onChange={e => setNewLead(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Detalhes sobre o lead..." className="w-full mt-1 px-3 py-2 rounded-md bg-background border text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-accent/40" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewLead(false)}>Cancelar</Button>
              <Button onClick={handleCreateLead} disabled={savingLead || !newLead.name.trim()}>
                {savingLead ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Criar Lead
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Modal */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedLead && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg">{selectedLead.name}</DialogTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditForm(selectedLead); setEditingLead(!editingLead); }}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteLead(selectedLead.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              {/* Lead info / edit */}
              {editingLead ? (
                <div className="space-y-3 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Nome</label>
                      <Input value={editForm.name || ""} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Empresa</label>
                      <Input value={editForm.company || ""} onChange={e => setEditForm(p => ({ ...p, company: e.target.value }))} className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                      <Input value={editForm.email || ""} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                      <Input value={editForm.phone || ""} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Origem</label>
                      <select value={editForm.origin || ""} onChange={e => setEditForm(p => ({ ...p, origin: e.target.value }))} className="w-full mt-1 h-10 px-3 rounded-md bg-background border text-sm text-foreground">
                        <option value="">Selecione...</option>
                        {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Valor Estimado</label>
                      <Input type="number" value={editForm.estimated_value || 0} onChange={e => setEditForm(p => ({ ...p, estimated_value: parseFloat(e.target.value) || 0 }))} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Responsável</label>
                    <select value={editForm.assigned_to || ""} onChange={e => setEditForm(p => ({ ...p, assigned_to: e.target.value || null }))} className="w-full mt-1 h-10 px-3 rounded-md bg-background border text-sm text-foreground">
                      <option value="">Nenhum</option>
                      {staff.map(s => <option key={s.user_id} value={s.user_id}>{s.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Observações</label>
                    <textarea value={editForm.notes || ""} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full mt-1 px-3 py-2 rounded-md bg-background border text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-accent/40" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingLead(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleSaveEdit}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 mt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => { const si = stageInfo(selectedLead.stage); return si ? <span className={`text-xs px-2 py-0.5 rounded border font-medium ${si.bgColor} ${si.color}`}>{si.label}</span> : null; })()}
                    {selectedLead.origin && <Badge variant="outline" className="text-[10px]">{selectedLead.origin}</Badge>}
                    {selectedLead.estimated_value > 0 && <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/20">R$ {selectedLead.estimated_value.toLocaleString("pt-BR")}</Badge>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {selectedLead.email && <p className="text-muted-foreground"><Mail className="w-3 h-3 inline mr-1" />{selectedLead.email}</p>}
                    {selectedLead.phone && <p className="text-muted-foreground"><Phone className="w-3 h-3 inline mr-1" />{selectedLead.phone}</p>}
                    {selectedLead.company && <p className="text-muted-foreground"><Building2 className="w-3 h-3 inline mr-1" />{selectedLead.company}</p>}
                  </div>
                  {selectedLead.notes && <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{selectedLead.notes}</p>}

                  {/* Stage progression */}
                  <div className="flex flex-wrap gap-1.5">
                    {STAGES.map(s => (
                      <button
                        key={s.key}
                        onClick={() => handleMoveStage(selectedLead, s.key)}
                        className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${selectedLead.stage === s.key ? `${s.bgColor} ${s.color} font-semibold` : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabs: Interactions / Tasks */}
              <Tabs defaultValue="interactions" className="mt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="interactions" className="flex-1">Interações</TabsTrigger>
                  <TabsTrigger value="tasks" className="flex-1">Tarefas</TabsTrigger>
                </TabsList>

                <TabsContent value="interactions" className="space-y-3 mt-3">
                  {/* Add interaction */}
                  <div className="space-y-2">
                    <div className="flex gap-1 flex-wrap">
                      {INTERACTION_TYPES.map(t => (
                        <button
                          key={t.key}
                          onClick={() => setNewInteractionType(t.key)}
                          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors ${newInteractionType === t.key ? "bg-primary/10 text-primary border-primary/20 font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          <t.icon className="w-3 h-3" /> {t.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Descreva a interação..." value={newInteractionDesc} onChange={e => setNewInteractionDesc(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddInteraction()} className="flex-1" />
                      <Button size="sm" onClick={handleAddInteraction} disabled={savingInteraction || !newInteractionDesc.trim()}>
                        {savingInteraction ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {loadingDetail ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
                  ) : interactions.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma interação registrada</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {interactions.map(int => {
                        const typeInfo = INTERACTION_TYPES.find(t => t.key === int.type);
                        const Icon = typeInfo?.icon || StickyNote;
                        return (
                          <div key={int.id} className="flex gap-3 text-sm border-l-2 border-muted pl-3 py-1">
                            <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-foreground">{int.description}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {typeInfo?.label} · {new Date(int.created_at).toLocaleString("pt-BR")}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="tasks" className="space-y-3 mt-3">
                  <Button variant="outline" size="sm" onClick={() => setShowNewTask(!showNewTask)} className="gap-1">
                    <Plus className="w-3 h-3" /> Nova Tarefa
                  </Button>

                  {showNewTask && (
                    <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                      <Input placeholder="Título da tarefa" value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} />
                      <div className="grid grid-cols-2 gap-2">
                        <Input type="date" value={newTask.due_date} onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))} />
                        <Input placeholder="Descrição (opcional)" value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setShowNewTask(false)}>Cancelar</Button>
                        <Button size="sm" onClick={handleAddTask} disabled={savingTask || !newTask.title.trim() || !newTask.due_date}>
                          {savingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {tasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa</p>
                  ) : (
                    <div className="space-y-1.5">
                      {tasks.map(task => {
                        const overdue = !task.completed && new Date(task.due_date) < new Date();
                        return (
                          <div key={task.id} className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${task.completed ? "bg-muted/30 opacity-60" : overdue ? "border-destructive/30 bg-destructive/5" : ""}`}>
                            <button onClick={() => toggleTaskComplete(task)} className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${task.completed ? "bg-primary border-primary" : "border-muted-foreground/30 hover:border-primary"}`}>
                              {task.completed && <Check className="w-3 h-3 text-primary-foreground" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.title}</p>
                              <p className={`text-[10px] ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                {new Date(task.due_date).toLocaleDateString("pt-BR")}
                                {task.description && ` · ${task.description}`}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRM;
