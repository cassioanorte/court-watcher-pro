import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Phone, Scale, Clock, ChevronDown, FileText, Plus, Pencil, X, Save, User, CreditCard, MapPin, Globe, Archive } from "lucide-react";
import NewProcessModal from "@/components/NewProcessModal";
import CaseAppointments from "@/components/CaseAppointments";

const sourceLabels: Record<string, string> = {
  TJRS_1G: "TJRS - 1º Grau",
  TJRS_2G: "TJRS - 2º Grau",
  TRF4_JFRS: "TRF4 - JFRS",
  TRF4_JFSC: "TRF4 - JFSC",
  TRF4_JFPR: "TRF4 - JFPR",
};

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [client, setClient] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [movements, setMovements] = useState<Record<string, any[]>>({});
  const [loadingMovements, setLoadingMovements] = useState<string | null>(null);
  const [showNewProcess, setShowNewProcess] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", cpf: "", address: "", origin: "", new_password: "" });
  const [saving, setSaving] = useState(false);

  const fetchCases = async () => {
    if (!id) return;
    const { data } = await supabase.from("cases").select("*").eq("client_user_id", id).order("updated_at", { ascending: false });
    setCases(data || []);
  };

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [profileRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", id).single(),
      ]);
      setClient(profileRes.data);
      await fetchCases();
      setLoading(false);
    };
    load();
  }, [id]);

  const toggleCase = async (caseId: string) => {
    if (expandedCase === caseId) {
      setExpandedCase(null);
      return;
    }
    setExpandedCase(caseId);

    if (!movements[caseId]) {
      setLoadingMovements(caseId);
      const { data } = await supabase
        .from("movements")
        .select("*")
        .eq("case_id", caseId)
        .order("occurred_at", { ascending: false })
        .limit(20);
      setMovements((prev) => ({ ...prev, [caseId]: data || [] }));
      setLoadingMovements(null);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");
  const formatTime = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Há ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Há ${hours}h`;
    return `Há ${Math.floor(hours / 24)}d`;
  };

  const originOptions = ["Indicação", "Google", "Instagram", "Facebook", "LinkedIn", "Site", "OAB", "Outro"];

  const openEdit = () => {
    setEditForm({
      full_name: client?.full_name || "",
      phone: client?.phone || "",
      cpf: client?.cpf || "",
      address: client?.address || "",
      origin: client?.origin || "",
      new_password: "",
    });
    setShowEdit(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editForm.full_name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("manage-team-member", {
        body: {
          action: "update",
          target_user_id: id,
          updates: {
            full_name: editForm.full_name.trim(),
            phone: editForm.phone.trim() || null,
            cpf: editForm.cpf.trim() || null,
            address: editForm.address.trim() || null,
            origin: editForm.origin || null,
            new_password: editForm.new_password || undefined,
          },
        },
      });
      if (error) throw error;
      setClient((prev: any) => ({
        ...prev,
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim() || null,
        cpf: editForm.cpf.trim() || null,
        address: editForm.address.trim() || null,
        origin: editForm.origin || null,
      }));
      setShowEdit(false);
      toast({ title: "Cliente atualizado!", description: "Os dados foram salvos com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-muted-foreground text-sm p-4">Carregando...</div>;
  if (!client) return <div className="text-muted-foreground text-sm p-4">Cliente não encontrado.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/clientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      {/* Client card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg border p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center text-lg font-bold text-primary-foreground">
              {client.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{client.full_name}</h1>
              <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {client.phone}</span>}
                {client.cpf && <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> {client.cpf}</span>}
                {client.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {client.address}</span>}
                {client.origin && <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {client.origin}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={openEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
        </div>
      </motion.div>

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-foreground/30" onClick={() => setShowEdit(false)} />
          <div className="relative bg-card rounded-xl border shadow-lg w-full max-w-md p-6 animate-scale-in">
            <button onClick={() => setShowEdit(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-foreground mb-1">Editar Cliente</h2>
            <p className="text-sm text-muted-foreground mb-5">Atualize os dados do cliente</p>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome completo *</label>
                <div className="relative mt-1">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" value={editForm.full_name} onChange={(e) => setEditForm(f => ({ ...f, full_name: e.target.value }))} required className="w-full h-10 pl-9 pr-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Telefone</label>
                <div className="relative mt-1">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" className="w-full h-10 pl-9 pr-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CPF</label>
                <div className="relative mt-1">
                  <CreditCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" value={editForm.cpf} onChange={(e) => setEditForm(f => ({ ...f, cpf: e.target.value.replace(/\D/g, "").slice(0, 11) }))} placeholder="00000000000" className="w-full h-10 pl-9 pr-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Endereço</label>
                <div className="relative mt-1">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" value={editForm.address} onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))} placeholder="Rua, número, bairro, cidade - UF" className="w-full h-10 pl-9 pr-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Origem</label>
                <div className="relative mt-1">
                  <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <select value={editForm.origin} onChange={(e) => setEditForm(f => ({ ...f, origin: e.target.value }))} className="w-full h-10 pl-9 pr-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40">
                    <option value="">Selecione...</option>
                    {originOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nova senha (opcional)</label>
                <input type="text" value={editForm.new_password} onChange={(e) => setEditForm(f => ({ ...f, new_password: e.target.value }))} placeholder="Mínimo 6 caracteres" className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" />
                <p className="text-[10px] text-muted-foreground mt-1">Deixe em branco para manter a senha atual.</p>
              </div>
              <button type="submit" disabled={saving} className="w-full h-10 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Processes - expandable */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">
            Processos Ativos ({cases.filter(c => !c.archived).length})
          </h2>
          <button
            onClick={() => setShowNewProcess(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Processo
          </button>
        </div>
        {cases.filter(c => !c.archived).length === 0 ? (
          <p className="text-sm text-muted-foreground bg-card rounded-lg border p-4">Nenhum processo ativo vinculado a este cliente.</p>
        ) : (
          <div className="space-y-3">
            {cases.filter(c => !c.archived).map((c, i) => {
              const isExpanded = expandedCase === c.id;
              const caseMov = movements[c.id] || [];
              const isLoadingMov = loadingMovements === c.id;

              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-card rounded-lg border shadow-card overflow-hidden"
                >
                  {/* Process header - clickable */}
                  <button
                    onClick={() => toggleCase(c.id)}
                    className="w-full text-left px-5 py-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground font-mono">{c.process_number}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.subject || "Sem assunto"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          {sourceLabels[c.source] || c.source}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Scale className="w-3 h-3" /> {c.simple_status}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(c.updated_at)}</span>
                    </div>
                  </button>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t px-5 py-4 space-y-4">
                          {/* Case summary */}
                          {(c.subject || c.next_step) && (
                            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-accent" /> Resumo do Caso
                              </h3>
                              {c.subject && (
                                <p className="text-sm text-foreground">{c.subject}</p>
                              )}
                              {c.next_step && (
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-2">Próximo passo</p>
                                  <p className="text-sm text-foreground">{c.next_step}</p>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2 mt-1">
                                {c.tags?.map((tag: string) => (
                                  <span key={tag} className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">{tag}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Movements */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Movimentações</h3>
                              <Link to={`/processos/${c.id}`} className="text-[10px] text-accent hover:underline">
                                Ver processo completo →
                              </Link>
                            </div>

                            {isLoadingMov ? (
                              <p className="text-xs text-muted-foreground py-2">Carregando movimentações...</p>
                            ) : caseMov.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2">Nenhuma movimentação registrada.</p>
                            ) : (
                              <div className="space-y-0 divide-y rounded-lg border overflow-hidden">
                                {caseMov.map((mov) => (
                                  <div key={mov.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                                    <div className="flex items-start gap-3">
                                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-accent" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-foreground">{mov.title}</p>
                                        {mov.translation && (
                                          <p className="text-xs text-accent mt-0.5 italic">{mov.translation}</p>
                                        )}
                                        {mov.details && (
                                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{mov.details}</p>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {formatTime(mov.occurred_at)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Archived processes */}
      {cases.filter(c => c.archived).length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Archive className="w-4 h-4" /> Processos Arquivados ({cases.filter(c => c.archived).length})
          </h2>
          <div className="space-y-2">
            {cases.filter(c => c.archived).map((c, i) => (
              <Link
                key={c.id}
                to={`/processos/${c.id}`}
                className="block bg-card rounded-lg border p-4 shadow-card opacity-70 hover:opacity-100 transition-opacity"
              >
                <p className="text-sm font-mono text-foreground">{c.process_number}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{c.subject || "Sem assunto"}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{sourceLabels[c.source] || c.source}</span>
                  <span>·</span>
                  <span>{formatDate(c.updated_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
      <NewProcessModal
        open={showNewProcess}
        onClose={() => setShowNewProcess(false)}
        onSuccess={fetchCases}
        defaultClientUserId={id}
      />
    </div>
  );
};

export default ClientDetail;
