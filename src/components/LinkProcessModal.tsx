import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Link2, Check, Loader2 } from "lucide-react";

interface LinkProcessModalProps {
  open: boolean;
  onClose: () => void;
  contactUserId: string;
  contactName: string;
  alreadyLinkedCaseIds: string[];
  onLinked: () => void;
}

const LinkProcessModal = ({ open, onClose, contactUserId, contactName, alreadyLinkedCaseIds, onLinked }: LinkProcessModalProps) => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [linked, setLinked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
      setLinked(new Set());
    }
  }, [open]);

  const handleSearch = async () => {
    if (!search.trim() || !tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from("cases")
      .select("id, process_number, subject, simple_status, parties, client_user_id")
      .eq("tenant_id", tenantId)
      .or(`process_number.ilike.%${search.trim()}%,subject.ilike.%${search.trim()}%,parties.ilike.%${search.trim()}%`)
      .order("updated_at", { ascending: false })
      .limit(20);
    setResults(data || []);
    setLoading(false);
  };

  const handleLink = async (caseId: string) => {
    setLinking(caseId);
    const { error } = await supabase
      .from("cases")
      .update({ client_user_id: contactUserId })
      .eq("id", caseId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setLinked((prev) => new Set(prev).add(caseId));
      toast({ title: "Vinculado!", description: "Processo vinculado ao contato." });
      onLinked();
    }
    setLinking(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Vincular Processos a {contactName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Buscar por número, assunto ou partes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={loading} size="sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1">
          {results.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-6">
              {search ? "Nenhum processo encontrado." : "Digite para buscar processos."}
            </p>
          )}
          {results.map((c) => {
            const isAlreadyLinked = alreadyLinkedCaseIds.includes(c.id);
            const justLinked = linked.has(c.id);
            return (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium text-foreground">{c.process_number}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.subject || c.parties || "—"}</p>
                </div>
                <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">
                  {c.simple_status}
                </span>
                {isAlreadyLinked || justLinked ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold">
                    <Check className="w-3.5 h-3.5" /> Vinculado
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleLink(c.id)}
                    disabled={linking === c.id}
                    className="shrink-0"
                  >
                    {linking === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                    Vincular
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LinkProcessModal;
