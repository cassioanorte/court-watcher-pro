import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bot, Plus, ExternalLink, Pencil, Trash2, X, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface AIAgent {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
  icon: string;
  is_system: boolean;
  created_by: string;
  created_at: string;
}

const AgentesIA = () => {
  const { tenantId, user, role } = useAuth();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AIAgent | null>(null);
  const [form, setForm] = useState({ name: "", description: "", prompt: "" });

  const fetchAgents = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("ai_agents")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    setAgents((data as unknown as AIAgent[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAgents(); }, [tenantId]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "", prompt: "" });
    setModalOpen(true);
  };

  const openEdit = (agent: AIAgent) => {
    setEditing(agent);
    setForm({ name: agent.name, description: agent.description || "", prompt: agent.prompt });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.prompt.trim()) {
      toast.error("Preencha o nome e o prompt do agente");
      return;
    }
    if (editing) {
      const { error } = await supabase
        .from("ai_agents")
        .update({ name: form.name.trim(), description: form.description.trim() || null, prompt: form.prompt.trim() })
        .eq("id", editing.id);
      if (error) { toast.error("Erro ao atualizar agente"); return; }
      toast.success("Agente atualizado");
    } else {
      const { error } = await supabase
        .from("ai_agents")
        .insert({
          tenant_id: tenantId!,
          name: form.name.trim(),
          description: form.description.trim() || null,
          prompt: form.prompt.trim(),
          created_by: user!.id,
        });
      if (error) { toast.error("Erro ao criar agente"); return; }
      toast.success("Agente criado");
    }
    setModalOpen(false);
    fetchAgents();
  };

  const handleDelete = async (agent: AIAgent) => {
    if (!confirm(`Excluir o agente "${agent.name}"?`)) return;
    const { error } = await supabase.from("ai_agents").delete().eq("id", agent.id);
    if (error) { toast.error("Erro ao excluir agente"); return; }
    toast.success("Agente excluído");
    fetchAgents();
  };

  const copyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt copiado para a área de transferência!");
    } catch {
      // Fallback: textarea hack
      const ta = document.createElement("textarea");
      ta.value = prompt;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success("Prompt copiado!");
    }
  };

  const canEdit = (agent: AIAgent) =>
    role === "owner" || (!agent.is_system && agent.created_by === user?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agentes de IA</h1>
          <p className="text-sm text-muted-foreground">Crie agentes com prompts pré-configurados para usar no ChatGPT ou Claude</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Agente
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : agents.length === 0 ? (
        <div className="text-center py-16 border rounded-xl bg-card">
          <Bot className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum agente criado ainda</p>
          <Button variant="outline" onClick={openNew} className="mt-4 gap-2">
            <Plus className="w-4 h-4" /> Criar primeiro agente
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="group relative border rounded-xl p-5 bg-card hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground truncate">{agent.name}</h3>
                  {agent.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{agent.description}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3 bg-muted/50 rounded-lg p-3 font-mono">
                {agent.prompt}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 flex-1"
                  onClick={() => copyPrompt(agent.prompt)}
                >
                  <Copy className="w-3.5 h-3.5" /> Copiar Prompt
                </Button>
                <a
                  href="https://chatgpt.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 h-8 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                  title="Abrir ChatGPT"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> GPT
                </a>
                <a
                  href="https://claude.ai/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 h-8 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                  title="Abrir Claude"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Claude
                </a>
              </div>
              {agent.is_system && (
                <span className="inline-block mt-2 text-[10px] uppercase tracking-wider text-primary font-semibold">Sistema</span>
              )}
              {canEdit(agent) && (
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(agent)}
                    className="p-1.5 rounded-md bg-background border hover:bg-muted"
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleDelete(agent)}
                    className="p-1.5 rounded-md bg-background border hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Agente" : "Novo Agente de IA"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome do Agente</label>
              <Input
                placeholder="Ex: Assistente de Petições"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Descrição (opcional)</label>
              <Input
                placeholder="Breve descrição do que este agente faz"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Prompt</label>
              <Textarea
                placeholder="Insira o prompt que será enviado ao ChatGPT..."
                value={form.prompt}
                onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
                rows={8}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editing ? "Salvar" : "Criar Agente"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentesIA;
