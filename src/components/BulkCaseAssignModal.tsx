import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, CheckSquare, Square, Save, X, Loader2 } from "lucide-react";

interface BulkCaseAssignModalProps {
  staffName: string;
  staffUserId: string;
  tenantId: string;
  currentExtraIds: string[];
  currentBlockedIds: string[];
  onSave: (extraIds: string[]) => void;
  onClose: () => void;
}

interface FoundCase {
  id: string;
  process_number: string;
  parties: string | null;
  oab_match: string;
}

const BulkCaseAssignModal = ({
  staffName,
  staffUserId,
  tenantId,
  currentExtraIds,
  currentBlockedIds,
  onSave,
  onClose,
}: BulkCaseAssignModalProps) => {
  const { toast } = useToast();
  const [oabSearch, setOabSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [foundCases, setFoundCases] = useState<FoundCase[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(currentExtraIds));
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (oabSearch.length < 3) {
      toast({ title: "Digite pelo menos 3 caracteres da OAB", variant: "destructive" });
      return;
    }
    setLoading(true);
    setSearched(true);

    try {
      // Normalize search: remove common prefixes and spaces
      const normalizedSearch = oabSearch
        .replace(/OAB\/?/gi, "")
        .replace(/[^0-9a-zA-Z]/g, "")
        .trim();

      // Find publications matching this OAB (partial match)
      const { data: pubs } = await supabase
        .from("dje_publications")
        .select("case_id, oab_number")
        .eq("tenant_id", tenantId)
        .not("case_id", "is", null)
        .ilike("oab_number", `%${normalizedSearch}%`);

      // Also find cases where responsible has this OAB
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, oab_number")
        .eq("tenant_id", tenantId)
        .not("oab_number", "is", null)
        .ilike("oab_number", `%${oabSearch}%`);

      const caseIdSet = new Map<string, string>();
      
      (pubs || []).forEach((p) => {
        if (p.case_id) caseIdSet.set(p.case_id, p.oab_number);
      });

      // Find cases where responsible matches OAB profiles
      if (profiles && profiles.length > 0) {
        const userIds = profiles.map((p) => p.user_id);
        const { data: responsibleCases } = await supabase
          .from("cases")
          .select("id, process_number")
          .eq("tenant_id", tenantId)
          .in("responsible_user_id", userIds);
        
        (responsibleCases || []).forEach((c) => {
          if (!caseIdSet.has(c.id)) {
            caseIdSet.set(c.id, oabSearch);
          }
        });
      }

      if (caseIdSet.size === 0) {
        setFoundCases([]);
        setLoading(false);
        return;
      }

      // Fetch case details
      const caseIds = Array.from(caseIdSet.keys());
      const { data: cases } = await supabase
        .from("cases")
        .select("id, process_number, parties")
        .eq("tenant_id", tenantId)
        .in("id", caseIds)
        .order("process_number");

      setFoundCases(
        (cases || []).map((c) => ({
          ...c,
          oab_match: caseIdSet.get(c.id) || "",
        }))
      );
    } catch (err: any) {
      toast({ title: "Erro na busca", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleCase = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const allIds = foundCases.map((c) => c.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allIds.forEach((id) => next.delete(id));
      } else {
        allIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSave = () => {
    onSave(Array.from(selectedIds));
  };

  const allSelected = foundCases.length > 0 && foundCases.every((c) => selectedIds.has(c.id));
  const selectedCount = foundCases.filter((c) => selectedIds.has(c.id)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-xl border shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-foreground">Liberação em Lote</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Busque por OAB e libere processos para <span className="font-medium text-foreground">{staffName}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={oabSearch}
                onChange={(e) => setOabSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Buscar por OAB... (ex: 125105, RS 125105)"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-4 h-10 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {!searched ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Digite o número da OAB e clique em Buscar para encontrar os processos relacionados.
            </p>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-accent" />
            </div>
          ) : foundCases.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum processo encontrado para esta OAB.
            </p>
          ) : (
            <div className="space-y-1">
              {/* Select all header */}
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                {allSelected ? (
                  <CheckSquare className="w-4 h-4 text-accent" />
                ) : (
                  <Square className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  Selecionar todos ({foundCases.length} processos)
                </span>
              </button>

              {foundCases.map((c) => {
                const isSelected = selectedIds.has(c.id);
                const isBlocked = currentBlockedIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCase(c.id)}
                    className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-lg transition-colors text-left ${
                      isSelected ? "bg-accent/10" : "hover:bg-muted/50"
                    } ${isBlocked ? "opacity-50" : ""}`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-accent flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.process_number}</p>
                      {c.parties && (
                        <p className="text-[11px] text-muted-foreground truncate">{c.parties}</p>
                      )}
                    </div>
                    {isBlocked && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 font-medium">
                        Bloqueado
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t bg-muted/20">
          <span className="text-xs text-muted-foreground">
            {selectedCount > 0
              ? `${selectedCount} processo(s) selecionado(s)`
              : "Nenhum processo selecionado"}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 h-9 rounded-lg border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar ({selectedCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkCaseAssignModal;
