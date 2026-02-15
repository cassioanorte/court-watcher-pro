import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Newspaper, RefreshCw, Eye, EyeOff, Filter, ExternalLink, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

      const { data, error } = await supabase.functions.invoke("fetch-dje-publications", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      toast({
        title: "Sincronização concluída",
        description: `${data?.found || 0} publicação(ões) encontrada(s).`,
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
          <h1 className="text-2xl font-bold text-foreground font-display">Publicações DJE</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Notas de expediente dos diários eletrônicos
            {unreadCount > 0 && (
              <span className="ml-2 text-accent font-medium">• {unreadCount} não lida(s)</span>
            )}
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing || !profile?.oab_number}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Buscando..." : "Buscar Publicações"}
        </Button>
      </div>

      {!profile?.oab_number && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-sm text-amber-700 dark:text-amber-400">
          ⚠️ Configure seu número da OAB nas <a href="/configuracoes" className="underline font-medium">Configurações</a> para buscar publicações automaticamente.
        </div>
      )}

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
            Clique em "Buscar Publicações" para verificar os diários eletrônicos
          </p>
        </div>
      ) : (
        <div className="space-y-2">
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
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {pub.process_number && <span className="font-mono">{pub.process_number}</span>}
                    <span>{new Date(pub.publication_date).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleRead(pub); }}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-1"
                  title={pub.read ? "Marcar como não lida" : "Marcar como lida"}
                >
                  {pub.read ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
