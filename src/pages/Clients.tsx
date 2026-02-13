import { motion } from "framer-motion";
import { Search, Plus, Mail, Phone } from "lucide-react";
import { useState } from "react";

const mockClients = [
  { id: "1", name: "Maria Silva", email: "maria@email.com", phone: "(51) 99999-0001", processes: 3, lastAccess: "Hoje" },
  { id: "2", name: "João Oliveira", email: "joao@email.com", phone: "(51) 99999-0002", processes: 1, lastAccess: "Ontem" },
  { id: "3", name: "Ana Souza", email: "ana@email.com", phone: "(51) 99999-0003", processes: 2, lastAccess: "Há 3 dias" },
  { id: "4", name: "Pedro Santos", email: "pedro@email.com", phone: "(48) 99999-0004", processes: 1, lastAccess: "Há 1 semana" },
  { id: "5", name: "Lucia Ferreira", email: "lucia@email.com", phone: "(51) 99999-0005", processes: 1, lastAccess: "Há 2 semanas" },
];

const Clients = () => {
  const [search, setSearch] = useState("");
  const filtered = mockClients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">{mockClients.length} clientes cadastrados</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Convidar Cliente
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-4 rounded-lg bg-card border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((client, i) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-card rounded-lg border p-5 shadow-card hover:shadow-card-hover transition-shadow"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                {client.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{client.name}</h3>
                <p className="text-xs text-muted-foreground">{client.processes} processo{client.processes > 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><Mail className="w-3 h-3" /> {client.email}</div>
              <div className="flex items-center gap-2"><Phone className="w-3 h-3" /> {client.phone}</div>
            </div>
            <div className="mt-4 pt-3 border-t flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Último acesso: {client.lastAccess}</span>
              <button className="text-xs text-accent hover:underline">Ver detalhes</button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Clients;
