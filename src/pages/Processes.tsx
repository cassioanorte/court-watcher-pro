import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, Plus, Filter, RefreshCw, Download, Loader2, Pencil, Trash2, X, Save, AlertTriangle, CheckSquare, Square, MinusSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import NewProcessModal from "@/components/NewProcessModal";
import type { Tables, Database } from "@/integrations/supabase/types";

type ProcessSource = Database["public"]["Enums"]["process_source"];

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
  const [editForm, setEditForm] = useState({ process_number: "", source: "TJRS_1G" as ProcessSource, subject: "", case_summary: "", client_user_id: "", responsible_user_id: "", simple_status: "", automation_enabled: true });
  const [clients, setClients] = useState<{ user_id: string; full_name: string }[]>([]);
  const [staff, setStaff] = useState<{ user_id: string; full_name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteProcess, setDeleteProcess] = useState<Tables<"cases"> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  const fetchClientsAndStaff = async () => {
    if (!tenantId) return;
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").eq("tenant_id", tenantId);
    if (!profiles) return;
    const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", profiles.map((p) => p.user_id));
    const clientIds = new Set((roles || []).filter((r) => r.role === "client").map((r) => r.user_id));
    const staffIds = new Set((roles || []).filter((r) => r.role === "owner" || r.role === "staff").map((r) => r.user_id));
    setClients(profiles.filter((p) => clientIds.has(p.user_id)));
    setStaff(profiles.filter((p) => staffIds.has(p.user_id)));
  };

  const openEdit = (p: Tables<"cases">) => {
    setEditForm({
      process_number: p.process_number,
      source: p.source,
      subject: p.subject || "",
      case_summary: p.case_summary || "",
      client_user_id: p.client_user_id || "",
      responsible_user_id: p.responsible_user_id || "",
      simple_status: p.simple_status || "",
      automation_enabled: p.automation_enabled ?? true,
    });
    fetchClientsAndStaff();
    setEditProcess(p);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProcess) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("cases").update({
        process_number: editForm.process_number,
        source: editForm.source,
        subject: editForm.subject || null,
        case_summary: editForm.case_summary || null,
        client_user_id: editForm.client_user_id || null,
        responsible_user_id: editForm.responsible_user_id || null,
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

  const handleDeleteSelected = async () => {
    if (!tenantId || deleteAllConfirm !== "EXCLUIR") return;
    setDeletingAll(true);
    try {
      const caseIds = Array.from(selected);
      if (caseIds.length === 0) return;

      for (let i = 0; i < caseIds.length; i += 50) {
        const batch = caseIds.slice(i, i + 50);
        await Promise.all([
          supabase.from("movements").delete().in("case_id", batch),
          supabase.from("messages").delete().in("case_id", batch),
          supabase.from("documents").delete().in("case_id", batch),
        ]);
        await supabase.from("cases").delete().in("id", batch);
      }

      toast({ title: "Processos excluídos!", description: `${caseIds.length} processo(s) removido(s).` });
      setShowDeleteAll(false);
      setDeleteAllConfirm("");
      setSelected(new Set());
      fetchProcesses();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDeletingAll(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(p => p.id)));
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
          {selected.size > 0 && (
            <button
              onClick={() => { setShowDeleteAll(true); setDeleteAllConfirm(""); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Excluir selecionados ({selected.size})
            </button>
          )}
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
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground transition-colors">
                      {selected.size === filtered.length && filtered.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-accent" />
                      ) : selected.size > 0 ? (
                        <MinusSquare className="w-4 h-4 text-accent" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
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
                    className={cn("hover:bg-muted/30 transition-colors", selected.has(p.id) && "bg-accent/5")}
                  >
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelect(p.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                        {selected.has(p.id) ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
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
          <div className="relative bg-card rounded-xl border shadow-lg w-full max-w-lg p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
            <button onClick={() => setEditProcess(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-foreground mb-1">Editar Processo</h2>
            <p className="text-sm text-muted-foreground mb-5">Atualize os dados do processo</p>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Número CNJ *</label>
                <input type="text" value={editForm.process_number} onChange={(e) => setEditForm(f => ({ ...f, process_number: e.target.value }))} required className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Origem *</label>
                <select value={editForm.source} onChange={(e) => setEditForm(f => ({ ...f, source: e.target.value as ProcessSource }))} className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40">
                  {Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assunto</label>
                <input type="text" value={editForm.subject} onChange={(e) => setEditForm(f => ({ ...f, subject: e.target.value }))} placeholder="Ex: Indenização por danos morais" className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resumo do caso</label>
                <textarea value={editForm.case_summary} onChange={(e) => setEditForm(f => ({ ...f, case_summary: e.target.value }))} placeholder="Descreva brevemente o caso, partes envolvidas, pedidos, etc." rows={3} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cliente</label>
                <select value={editForm.client_user_id} onChange={(e) => setEditForm(f => ({ ...f, client_user_id: e.target.value }))} className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40">
                  <option value="">Sem cliente vinculado</option>
                  {clients.map((c) => <option key={c.user_id} value={c.user_id}>{c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Advogado responsável</label>
                <select value={editForm.responsible_user_id} onChange={(e) => setEditForm(f => ({ ...f, responsible_user_id: e.target.value }))} className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40">
                  <option value="">Selecione...</option>
                  {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
                <input type="text" value={editForm.simple_status} onChange={(e) => setEditForm(f => ({ ...f, simple_status: e.target.value }))} placeholder="Ex: Em andamento" className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.automation_enabled} onChange={(e) => setEditForm(f => ({ ...f, automation_enabled: e.target.checked }))} className="rounded border-border" />
                <span className="text-sm text-foreground">Ativar captura automática de movimentações</span>
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

      {/* Delete Selected Confirmation Modal */}
      {showDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-foreground/30" onClick={() => setShowDeleteAll(false)} />
          <div className="relative bg-card rounded-xl border shadow-lg w-full max-w-md p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Excluir processos selecionados</h2>
                <p className="text-xs text-muted-foreground">{selected.size} processo(s) serão removidos</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Esta ação é <strong className="text-destructive">irreversível</strong>. Os processos selecionados e todos os dados vinculados (movimentações, mensagens, documentos) serão excluídos permanentemente.
            </p>
            <p className="text-sm text-foreground mb-3">
              Para confirmar, digite <strong className="font-mono">EXCLUIR</strong> abaixo:
            </p>
            <input
              type="text"
              value={deleteAllConfirm}
              onChange={(e) => setDeleteAllConfirm(e.target.value)}
              placeholder="Digite EXCLUIR"
              className="w-full h-10 px-3 rounded-lg bg-background border text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/40 mb-5"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteAll(false)} className="flex-1 h-10 rounded-lg border text-sm font-medium text-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={deletingAll || deleteAllConfirm !== "EXCLUIR"}
                className="flex-1 h-10 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {deletingAll ? "Excluindo..." : `Excluir ${selected.size} processo(s)`}
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
