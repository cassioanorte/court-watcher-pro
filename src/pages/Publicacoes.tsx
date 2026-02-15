import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Newspaper, RefreshCw, Eye, EyeOff, Filter, ExternalLink, Search, Trash2, CheckSquare, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import EmailIntegrationSetup from "@/components/EmailIntegrationSetup";

interface Publication {
  id: string;
  oab_number: string;
  source: string;
  publication_date: string;
  title: string;
  content: string | null;
  publication_type: string | null;
  process_number: string | null;
  organ: string | null;
  read: boolean;
  created_at: string;
  external_url: string | null;
}

const Publicacoes = () => {
  const { tenantId, profile } = useAuth();
  const { toast } = useToast();
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all");
  const [selectedPub, setSelectedPub] = useState<Publication | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchPublications = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      let query = supabase
        .from("dje_publications")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("publication_date", { ascending: false })
        .limit(100);

      if (sourceFilter !== "all") {
        query = query.eq("source", sourceFilter);
      }
      if (readFilter === "unread") {
        query = query.eq("read", false);
      } else if (readFilter === "read") {
        query = query.eq("read", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPublications((data || []) as Publication[]);
    } catch (err: any) {
      console.error("Error fetching publications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublications();
  }, [tenantId, sourceFilter, readFilter]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const { data, error } = await supabase.functions.invoke("poll-email-imap", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { tenant_id: tenantId },
      });

      if (error) throw error;

      const result = data?.results?.[0] || {};
      const inserted = result.inserted || 0;
      const scanned = result.emails_scanned || 0;

      toast({
        title: "Verificação concluída",
        description: inserted > 0
          ? `${inserted} publicação(ões) nova(s) encontrada(s) em ${scanned} e-mail(s).`
          : `Nenhuma publicação nova (${scanned} e-mail(s) verificados).`,
      });
      fetchPublications();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const toggleRead = async (pub: Publication) => {
    const { error } = await supabase
      .from("dje_publications")
      .update({ read: !pub.read })
      .eq("id", pub.id);
    if (!error) {
      setPublications(prev => prev.map(p => p.id === pub.id ? { ...p, read: !p.read } : p));
    }
  };

  const handleDelete = async (pub: Publication) => {
    const { error } = await supabase
      .from("dje_publications")
      .delete()
      .eq("id", pub.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      setPublications(prev => prev.filter(p => p.id !== pub.id));
      if (selectedPub?.id === pub.id) setSelectedPub(null);
      toast({ title: "Publicação excluída" });
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("dje_publications")
      .delete()
      .in("id", ids);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      setPublications(prev => prev.filter(p => !selectedIds.has(p.id)));
      toast({ title: `${ids.length} publicação(ões) excluída(s)` });
      setSelectedIds(new Set());
    }
    setBulkDeleting(false);
  };

  const filtered = publications.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(s) ||
      p.process_number?.toLowerCase().includes(s) ||
      p.content?.toLowerCase().includes(s)
    );
  });

  const unreadCount = publications.filter(p => !p.read).length;

  const typeColor = (type: string | null) => {
    switch (type) {
      case "Decisão": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "Despacho": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "Sentença": return "bg-red-500/10 text-red-600 border-red-500/20";
      case "Intimação": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "Acórdão": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "Ato Ordinatório": return "bg-slate-500/10 text-slate-600 border-slate-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
      <h1 className="text-2xl font-bold text-foreground font-display">Publicações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Notas de expediente capturadas via e-mail
            {unreadCount > 0 && (
              <span className="ml-2 text-accent font-medium">• {unreadCount} não lida(s)</span>
            )}
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Verificando e-mails..." : "Verificar E-mails"}
        </Button>
      </div>

      <EmailIntegrationSetup />


      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, processo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Fonte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas fontes</SelectItem>
            <SelectItem value="EMAIL">E-mail</SelectItem>
            <SelectItem value="DJE">DJE</SelectItem>
            <SelectItem value="TRF4">TRF4</SelectItem>
            <SelectItem value="TJRS">TJRS</SelectItem>
          </SelectContent>
        </Select>
        <Select value={readFilter} onValueChange={setReadFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="unread">Não lidas</SelectItem>
            <SelectItem value="read">Lidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Publications List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando publicações...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Newspaper className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma publicação encontrada</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Configure a integração de e-mail e clique em "Verificar E-mails"
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Bulk actions bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {selectedIds.size === filtered.length && filtered.length > 0 ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {selectedIds.size > 0 ? `${selectedIds.size} selecionada(s)` : "Selecionar todas"}
            </button>
            {selectedIds.size > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={bulkDeleting} className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Excluir {selectedIds.size} selecionada(s)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {selectedIds.size} publicação(ões)?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. As publicações selecionadas serão removidas permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          {filtered.map((pub, i) => (
            <motion.div
              key={pub.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelectedPub(pub)}
              className={`group bg-card border rounded-lg p-4 cursor-pointer hover:border-accent/30 transition-all ${!pub.read ? "border-l-4 border-l-accent" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    onClick={(e) => toggleSelect(pub.id, e)}
                    className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    {selectedIds.has(pub.id) ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] shrink-0">{pub.source}</Badge>
                    {pub.publication_type && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${typeColor(pub.publication_type)}`}>
                        {pub.publication_type}
                      </span>
                    )}
                    {!pub.read && (
                      <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                    )}
                  </div>
                  <p className={`text-sm ${pub.read ? "text-muted-foreground" : "text-foreground font-medium"} line-clamp-2`}>
                    {pub.title}
                  </p>
                  {/* Extract client and lawyer from content */}
                  {pub.content && (() => {
                    const clientMatch = pub.content.match(/Cliente: (.+)/);
                    const lawyerMatch = pub.content.match(/Advogado: (.+)/);
                    if (!clientMatch && !lawyerMatch) return null;
                    return (
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {clientMatch && <span>👤 {clientMatch[1]}</span>}
                        {lawyerMatch && <span>⚖️ {lawyerMatch[1]}</span>}
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {pub.process_number && <span className="font-mono">{pub.process_number}</span>}
                    <span>{new Date(pub.publication_date).toLocaleDateString("pt-BR")}</span>
                  </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleRead(pub); }}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    title={pub.read ? "Marcar como não lida" : "Marcar como lida"}
                  >
                    {pub.read ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        title="Excluir publicação"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir publicação?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. A publicação será removida permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(pub)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!selectedPub} onOpenChange={() => setSelectedPub(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedPub && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg leading-snug">{selectedPub.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{selectedPub.source}</Badge>
                  {selectedPub.publication_type && (
                    <span className={`text-xs px-2 py-0.5 rounded border ${typeColor(selectedPub.publication_type)}`}>
                      {selectedPub.publication_type}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(selectedPub.publication_date).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                {selectedPub.process_number && (
                  <p className="text-sm font-mono text-muted-foreground">Processo: {selectedPub.process_number}</p>
                )}
                {/* Extract parties from content */}
                {selectedPub.content && (() => {
                  const patterns: [RegExp, string, string][] = [
                    [/Cliente:\s*(.+)/i, '👤', 'Cliente'],
                    [/Advogado:\s*(.+)/i, '⚖️', 'Advogado'],
                    [/Autor(?:a)?:\s*(.+)/i, '🔵', 'Autor'],
                    [/R[ée]u:\s*(.+)/i, '🔴', 'Réu'],
                    [/Requerente:\s*(.+)/i, '🔵', 'Requerente'],
                    [/Requerido(?:a)?:\s*(.+)/i, '🔴', 'Requerido'],
                    [/Impetrante:\s*(.+)/i, '🔵', 'Impetrante'],
                    [/Impetrado(?:a)?:\s*(.+)/i, '🔴', 'Impetrado'],
                    [/Agravante:\s*(.+)/i, '🔵', 'Agravante'],
                    [/Agravado(?:a)?:\s*(.+)/i, '🔴', 'Agravado'],
                    [/Apelante:\s*(.+)/i, '🔵', 'Apelante'],
                    [/Apelado(?:a)?:\s*(.+)/i, '🔴', 'Apelado'],
                    [/Recorrente:\s*(.+)/i, '🔵', 'Recorrente'],
                    [/Recorrido(?:a)?:\s*(.+)/i, '🔴', 'Recorrido'],
                    [/Exequente:\s*(.+)/i, '🔵', 'Exequente'],
                    [/Executado(?:a)?:\s*(.+)/i, '🔴', 'Executado'],
                  ];
                  const found: { icon: string; label: string; name: string }[] = [];
                  for (const [regex, icon, label] of patterns) {
                    const m = selectedPub.content!.match(regex);
                    if (m) found.push({ icon, label, name: m[1].trim() });
                  }
                  if (found.length === 0) return null;
                  return (
                    <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Partes</p>
                      {found.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span>{p.icon}</span>
                          <span className="text-muted-foreground font-medium">{p.label}:</span>
                          <span className="text-foreground">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {selectedPub.content && (
                  <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
                    {selectedPub.content}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleRead(selectedPub)}
                  >
                    {selectedPub.read ? "Marcar como não lida" : "Marcar como lida"}
                  </Button>
                  {selectedPub.external_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={selectedPub.external_url} target="_blank" rel="noopener noreferrer" className="gap-1">
                        <ExternalLink className="w-3 h-3" /> Ver no tribunal
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Publicacoes;
