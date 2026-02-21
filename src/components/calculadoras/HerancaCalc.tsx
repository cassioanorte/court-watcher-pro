import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Herdeiro {
  nome: string;
  grau: string;
}

const graus = [
  { value: "descendente", label: "Descendente (filho/neto)" },
  { value: "ascendente", label: "Ascendente (pai/avô)" },
  { value: "conjuge", label: "Cônjuge/Companheiro" },
  { value: "colateral", label: "Colateral (irmão/sobrinho)" },
];

export default function HerancaCalc() {
  const [totalEspólio, setTotalEspolio] = useState("");
  const [regime, setRegime] = useState("parcial");
  const [herdeiros, setHerdeiros] = useState<Herdeiro[]>([{ nome: "", grau: "descendente" }]);
  const [resultado, setResultado] = useState<{ partes: { nome: string; valor: number; percentual: number }[] } | null>(null);

  const addHerdeiro = () => setHerdeiros([...herdeiros, { nome: "", grau: "descendente" }]);
  const updateHerdeiro = (i: number, field: keyof Herdeiro, val: string) => {
    const copy = [...herdeiros];
    copy[i] = { ...copy[i], [field]: val };
    setHerdeiros(copy);
  };
  const removeHerdeiro = (i: number) => { if (herdeiros.length > 1) setHerdeiros(herdeiros.filter((_, idx) => idx !== i)); };

  const calcular = () => {
    const total = parseFloat(totalEspólio);
    if (!total) { toast.error("Informe o valor total do espólio"); return; }
    if (herdeiros.length === 0) { toast.error("Adicione ao menos um herdeiro"); return; }

    const descendentes = herdeiros.filter(h => h.grau === "descendente");
    const conjuge = herdeiros.find(h => h.grau === "conjuge");
    const ascendentes = herdeiros.filter(h => h.grau === "ascendente");
    const colaterais = herdeiros.filter(h => h.grau === "colateral");

    const partes: { nome: string; valor: number; percentual: number }[] = [];

    // Lógica simplificada da ordem de vocação hereditária (Art. 1.829 CC)
    if (descendentes.length > 0) {
      // Descendentes concorrem com cônjuge
      const totalHerdeiros = conjuge ? descendentes.length + 1 : descendentes.length;
      const valorPorHerdeiro = total / totalHerdeiros;

      descendentes.forEach(d => {
        partes.push({ nome: d.nome || "Descendente", valor: valorPorHerdeiro, percentual: (valorPorHerdeiro / total) * 100 });
      });
      if (conjuge) {
        partes.push({ nome: conjuge.nome || "Cônjuge", valor: valorPorHerdeiro, percentual: (valorPorHerdeiro / total) * 100 });
      }
    } else if (ascendentes.length > 0) {
      // Ascendentes concorrem com cônjuge
      if (conjuge) {
        const parteCônjuge = total / 3;
        const parteAscendentes = (total * 2 / 3) / ascendentes.length;
        partes.push({ nome: conjuge.nome || "Cônjuge", valor: parteCônjuge, percentual: (parteCônjuge / total) * 100 });
        ascendentes.forEach(a => {
          partes.push({ nome: a.nome || "Ascendente", valor: parteAscendentes, percentual: (parteAscendentes / total) * 100 });
        });
      } else {
        const valorPor = total / ascendentes.length;
        ascendentes.forEach(a => {
          partes.push({ nome: a.nome || "Ascendente", valor: valorPor, percentual: (valorPor / total) * 100 });
        });
      }
    } else if (conjuge) {
      partes.push({ nome: conjuge.nome || "Cônjuge", valor: total, percentual: 100 });
    } else if (colaterais.length > 0) {
      const valorPor = total / colaterais.length;
      colaterais.forEach(c => {
        partes.push({ nome: c.nome || "Colateral", valor: valorPor, percentual: (valorPor / total) * 100 });
      });
    }

    setResultado({ partes });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Valor do Espólio (R$)</Label><Input type="number" value={totalEspólio} onChange={e => setTotalEspolio(e.target.value)} placeholder="Ex: 500000" /></div>
        <div>
          <Label>Regime de bens</Label>
          <Select value={regime} onValueChange={setRegime}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="parcial">Comunhão parcial</SelectItem>
              <SelectItem value="universal">Comunhão universal</SelectItem>
              <SelectItem value="separacao">Separação total</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Herdeiros</Label>
        {herdeiros.map((h, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex-1"><Input placeholder="Nome" value={h.nome} onChange={e => updateHerdeiro(i, "nome", e.target.value)} /></div>
            <div className="w-44">
              <Select value={h.grau} onValueChange={v => updateHerdeiro(i, "grau", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {graus.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {herdeiros.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeHerdeiro(i)} className="text-destructive">✕</Button>}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addHerdeiro}>+ Adicionar herdeiro</Button>
      </div>

      <Button onClick={calcular} className="w-full">Calcular Herança</Button>

      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-2">
            {resultado.partes.map((p, i) => (
              <div key={i} className="flex justify-between items-center text-sm border-b border-border pb-1 last:border-0">
                <span className="text-foreground font-medium">{p.nome}</span>
                <div className="text-right">
                  <span className="font-bold text-foreground">R$ {p.valor.toFixed(2)}</span>
                  <span className="text-muted-foreground ml-2">({p.percentual.toFixed(1)}%)</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
