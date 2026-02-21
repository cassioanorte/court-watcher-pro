import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface MembroFamiliar {
  nome: string;
  renda: number;
}

export default function BpcLoasCalc() {
  const [membros, setMembros] = useState<MembroFamiliar[]>([{ nome: "", renda: 0 }]);
  const [salarioMinimo, setSalarioMinimo] = useState("1518");
  const [resultado, setResultado] = useState<{
    rendaTotal: number; rendaPerCapita: number; limitePerCapita: number;
    elegivel: boolean; totalMembros: number;
  } | null>(null);

  const addMembro = () => setMembros([...membros, { nome: "", renda: 0 }]);
  const updateMembro = (i: number, field: keyof MembroFamiliar, value: string) => {
    const updated = [...membros];
    if (field === "nome") updated[i].nome = value;
    else updated[i].renda = parseFloat(value) || 0;
    setMembros(updated);
  };
  const removeMembro = (i: number) => setMembros(membros.filter((_, idx) => idx !== i));

  const calcular = () => {
    const sm = parseFloat(salarioMinimo);
    if (!sm) { toast.error("Informe o salário mínimo vigente"); return; }

    const rendaTotal = membros.reduce((s, m) => s + m.renda, 0);
    const totalMembros = membros.length;
    const rendaPerCapita = rendaTotal / totalMembros;
    const limitePerCapita = sm / 4; // 1/4 do salário mínimo

    setResultado({ rendaTotal, rendaPerCapita, limitePerCapita, elegivel: rendaPerCapita <= limitePerCapita, totalMembros });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div><Label>Salário Mínimo Vigente (R$)</Label><Input type="number" value={salarioMinimo} onChange={e => setSalarioMinimo(e.target.value)} /></div>
      <div className="space-y-2">
        <Label>Membros da Família</Label>
        {membros.map((m, i) => (
          <div key={i} className="grid grid-cols-[1fr_100px_auto] gap-2 items-end">
            <Input placeholder="Nome" value={m.nome} onChange={e => updateMembro(i, "nome", e.target.value)} />
            <Input type="number" placeholder="Renda" onChange={e => updateMembro(i, "renda", e.target.value)} />
            {membros.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeMembro(i)}>✕</Button>}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addMembro}>+ Adicionar membro</Button>
      </div>
      <Button onClick={calcular} className="w-full">Analisar Elegibilidade</Button>
      {resultado && (
        <Card className={`border ${resultado.elegivel ? "bg-green-50 border-green-300 dark:bg-green-950/20 dark:border-green-800" : "bg-destructive/10 border-destructive/30"}`}>
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Membros da Família</span><span className="font-semibold">{resultado.totalMembros}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Renda Familiar Total</span><span className="font-semibold">R$ {fmt(resultado.rendaTotal)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Renda Per Capita</span><span className={`font-semibold ${resultado.elegivel ? "text-green-600" : "text-destructive"}`}>R$ {fmt(resultado.rendaPerCapita)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Limite (1/4 SM)</span><span className="font-semibold">R$ {fmt(resultado.limitePerCapita)}</span></div>
            <div className="border-t pt-2">
              <p className={`text-sm font-bold ${resultado.elegivel ? "text-green-600" : "text-destructive"}`}>
                {resultado.elegivel ? "✅ Elegível ao BPC/LOAS" : "❌ Renda per capita acima do limite"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
