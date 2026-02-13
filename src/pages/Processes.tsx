import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, Plus, Filter, RefreshCw } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Process = {
  id: string;
  number: string;
  client: string;
  court: string;
  subject: string;
  status: "em_andamento" | "aguardando" | "encerrado" | "urgente";
  lastUpdate: string;
  automationActive: boolean;
};

const mockProcesses: Process[] = [
  { id: "1", number: "5001234-56.2024.8.21.0001", client: "Maria Silva", court: "TJRS - 1º Grau", subject: "Indenização por danos morais", status: "em_andamento", lastUpdate: "Há 2h", automationActive: true },
  { id: "2", number: "5009876-12.2024.4.04.7100", client: "João Oliveira", court: "TRF4 - JFRS", subject: "Revisão de benefício previdenciário", status: "urgente", lastUpdate: "Há 4h", automationActive: true },
  { id: "3", number: "5003456-78.2024.8.21.0001", client: "Ana Souza", court: "TJRS - 2º Grau", subject: "Recurso de apelação - Família", status: "aguardando", lastUpdate: "Há 1d", automationActive: true },
  { id: "4", number: "5007890-34.2024.4.04.7200", client: "Pedro Santos", court: "TRF4 - JFSC", subject: "Execução fiscal", status: "em_andamento", lastUpdate: "Há 6h", automationActive: false },
  { id: "5", number: "5002345-67.2024.8.21.0001", client: "Lucia Ferreira", court: "TJRS - 1º Grau", subject: "Ação trabalhista - Rescisão", status: "encerrado", lastUpdate: "Há 3d", automationActive: false },
];

const statusConfig: Record<string, { label: string; className: string }> = {
  em_andamento: { label: "Em andamento", className: "bg-info/15 text-info" },
  aguardando: { label: "Aguardando", className: "bg-warning/15 text-warning" },
  encerrado: { label: "Encerrado", className: "bg-muted text-muted-foreground" },
  urgente: { label: "Urgente", className: "bg-destructive/15 text-destructive" },
};

const Processes = () => {
  const [search, setSearch] = useState("");

  const filtered = mockProcesses.filter(
    (p) => p.number.includes(search) || p.client.toLowerCase().includes(search.toLowerCase()) || p.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Processos</h1>
          <p className="text-sm text-muted-foreground mt-1">{mockProcesses.length} processos cadastrados</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Novo Processo
        </button>
      </div>

      {/* Search / filter bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por número, cliente ou assunto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-lg bg-card border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
        <button className="h-10 px-3 rounded-lg border bg-card text-muted-foreground hover:text-foreground transition-colors">
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg shadow-card border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Processo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Tribunal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Automação</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atualização</th>
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
                    <Link to={`/processos/${p.id}`} className="font-medium text-foreground hover:text-accent transition-colors">
                      {p.number}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5 md:hidden">{p.client}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground hidden md:table-cell">{p.client}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{p.court}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", statusConfig[p.status].className)}>
                      {statusConfig[p.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {p.automationActive ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <RefreshCw className="w-3 h-3" /> Ativa
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Manual</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">{p.lastUpdate}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Processes;
