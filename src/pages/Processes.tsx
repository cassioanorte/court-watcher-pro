import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, Plus, Filter, RefreshCw, Download, Loader2, Pencil, Trash2, X, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import NewProcessModal from "@/components/NewProcessModal";
import type { Tables } from "@/integrations/supabase/types";

const sourceLabels: Record<string, string> = {
  TJRS_1G: "TJRS - 1º Grau",
  TJRS_2G: "TJRS - 2º Grau",
  TRF4_JFRS: "TRF4 - JFRS",
  TRF4_JFSC: "TRF4 - JFSC",
  TRF4_JFPR: "TRF4 - JFPR",
  TST: "TST",
  TSE: "TSE",
  STJ: "STJ",
  STM: "STM",
  TRF1: "TRF1", TRF2: "TRF2", TRF3: "TRF3", TRF4: "TRF4", TRF5: "TRF5", TRF6: "TRF6",
  TRT1: "TRT1", TRT2: "TRT2", TRT3: "TRT3", TRT4: "TRT4", TRT5: "TRT5", TRT6: "TRT6",
  TRT7: "TRT7", TRT8: "TRT8", TRT9: "TRT9", TRT10: "TRT10", TRT11: "TRT11", TRT12: "TRT12",
  TRT13: "TRT13", TRT14: "TRT14", TRT15: "TRT15", TRT16: "TRT16", TRT17: "TRT17", TRT18: "TRT18",
  TRT19: "TRT19", TRT20: "TRT20", TRT21: "TRT21", TRT22: "TRT22", TRT23: "TRT23", TRT24: "TRT24",
};

const Processes = () => {
  const [search, setSearch] = useState("");
  const [processes, setProcesses] = useState<Tables<"cases">[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editProcess, setEditProcess] = useState<Tables<"cases"> | null>(null);
  const [editForm, setEditForm] = useState({ subject: "", simple_status: "", automation_enabled: true });
  const [saving, setSaving] = useState(false);
  const [deleteProcess, setDeleteProcess] = useState<Tables<"cases"> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { tenantId } = useAuth();
  const { toast } = useToast();

  const fetchProcesses = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("cases")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false });
    setProcesses(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProcesses();
  }, [tenantId]);

  const filtered = processes.filter(
    (p) =>
      p.process_number.includes(search) ||
      (p.subject || "").toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Agora";
    if (hours < 24) return `Há ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Há ${days}d`;
  };

  const openEdit = (p: Tables<"cases">) => {
    setEditForm({
      subject: p.subject || "",
      simple_status: p.simple_status || "",
      automation_enabled: p.automation_enabled ?? true,
    });
    setEditProcess(p);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProcess) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("cases").update({
        subject: editForm.subject || null,
        simple_status: editForm.simple_status || null,
        automation_enabled: editForm.automation_enabled,
      }).eq("id", editProcess.id);
      if (error) throw error;
      toast({ title: "Processo atualizado!" });
      setEditProcess(null);
      fetchProcesses();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteProcess) return;
    setDeleting(true);
    try {
      // Delete related data first
      await supabase.from("movements").delete().eq("case_id", deleteProcess.id);
      await supabase.from("messages").delete().eq("case_id", deleteProcess.id);
      await supabase.from("documents").delete().eq("case_id", deleteProcess.id);
      const { error } = await supabase.from("cases").delete().eq("id", deleteProcess.id);
      if (error) throw error;
      toast({ title: "Processo excluído!", description: deleteProcess.process_number });
      setDeleteProcess(null);
      fetchProcesses();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Processos</h1>
          <p className="text-sm text-muted-foreground mt-1">{processes.length} processo{processes.length !== 1 ? "s" : ""} cadastrado{processes.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (!tenantId) return;
              setImporting(true);
              try {
                const { data: creds } = await supabase
                  .from("eproc_credentials")
                  .select("source")
                  .eq("tenant_id", tenantId);
                if (!creds || creds.length === 0) {
                  toast({ title: "Sem credenciais", description: "Cadastre suas credenciais em Configurações primeiro.", variant: "destructive" });
                  return;
                }
                let totalImported = 0;
                for (const c of creds) {
                  const { data } = await supabase.functions.invoke("import-processes", {
                    body: { tenant_id: tenantId, source: c.source },
                  });
                  totalImported += data?.imported || 0;
                }
                toast({ title: "Importação concluída!", description: `${totalImported} processo(s) importado(s).` });
                fetchProcesses();
              } catch (err: any) {
                toast({ title: "Erro", description: err.message, variant: "destructive" });
              } finally {
                setImporting(false);
              }
            }}
            disabled={importing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-card border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {importing ? "Importando..." : "Importar do tribunal"}
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Novo Processo
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por número ou assunto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-lg bg-card border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center shadow-card">
          <p className="text-sm text-muted-foreground">
            {processes.length === 0 ? "Nenhum processo cadastrado. Clique em 'Novo Processo' para começar!" : "Nenhum resultado encontrado."}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-lg shadow-card border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Processo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Tribunal</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Automação</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atualização</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link to={`/processos/${p.id}`} className="font-medium text-foreground hover:text-accent transition-colors font-mono text-xs">
                        {p.process_number}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.subject || "Sem assunto"}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{sourceLabels[p.source] || p.source}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-foreground">{p.simple_status}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {p.automation_enabled ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success">
                          <RefreshCw className="w-3 h-3" /> Ativa
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Manual</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatDate(p.updated_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteProcess(p)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Excluir">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editProcess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-foreground/30" onClick={() => setEditProcess(null)} />
          <div className="relative bg-card rounded-xl border shadow-lg w-full max-w-md p-6 animate-scale-in">
            <button onClick={() => setEditProcess(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-foreground mb-1">Editar Processo</h2>
            <p className="text-xs text-muted-foreground font-mono mb-5">{editProcess.process_number}</p>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assunto</label>
                <input type="text" value={editForm.subject} onChange={(e) => setEditForm(f => ({ ...f, subject: e.target.value }))} placeholder="Ex: Indenização por danos morais" className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
                <input type="text" value={editForm.simple_status} onChange={(e) => setEditForm(f => ({ ...f, simple_status: e.target.value }))} placeholder="Ex: Em andamento" className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.automation_enabled} onChange={(e) => setEditForm(f => ({ ...f, automation_enabled: e.target.checked }))} className="rounded border-border" />
                <span className="text-sm text-foreground">Captura automática de movimentações</span>
              </label>
              <button type="submit" disabled={saving} className="w-full h-10 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteProcess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-foreground/30" onClick={() => setDeleteProcess(null)} />
          <div className="relative bg-card rounded-xl border shadow-lg w-full max-w-sm p-6 animate-scale-in">
            <h2 className="text-lg font-bold text-foreground mb-2">Confirmar exclusão</h2>
            <p className="text-sm text-muted-foreground mb-1">
              Tem certeza que deseja excluir o processo:
            </p>
            <p className="text-sm font-mono font-semibold text-foreground mb-4">{deleteProcess.process_number}</p>
            <p className="text-xs text-destructive mb-5">⚠️ Todas as movimentações, mensagens e documentos vinculados serão excluídos permanentemente.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteProcess(null)} className="flex-1 h-10 rounded-lg border text-sm font-medium text-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 h-10 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      <NewProcessModal open={showNew} onClose={() => setShowNew(false)} onSuccess={fetchProcesses} />
    </div>
  );
};

export default Processes;
