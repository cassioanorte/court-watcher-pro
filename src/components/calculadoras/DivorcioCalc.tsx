import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BemItem {
  descricao: string;
  valor: number;
  tipo: "comum" | "particular_a" | "particular_b";
}

const regimes = [
  { value: "parcial", label: "Comunhão parcial de bens", desc: "Bens adquiridos durante o casamento são partilhados" },
  { value: "universal", label: "Comunhão universal de bens", desc: "Todos os bens são partilhados, inclusive os anteriores" },
  { value: "separacao", label: "Separação total de bens", desc: "Cada administração mantém seus próprios bens" },
  { value: "participacao", label: "Participação final nestes", desc: "Partilha apenas do acréscimo patrimonial durante o casamento" },
];

export default function DivorcioCalc() {
  const [regime, setRegime] = useState("parcial");
  const [bens, setBens] = useState<BemItem[]>([{ descricao: "", valor: 0, tipo: "comum" }]);
  const [resultado, setResultado] = useState<{ parteA: number; parteB: number; totalComum: number } | null>(null);

  const addBem = () => setBens([...bens, { descricao: "", valor: 0, tipo: "comum" }]);
  const updateBem = (i: number, field: keyof BemItem, val: string) => {
    const copy = [...bens];
    if (field === "valor") copy[i].valor = parseFloat(val) || 0;
    else if (field === "tipo") copy[i].tipo = val as BemItem["tipo"];
    else copy[i].descricao = val;
    setBens(copy);
  };
  const removeBem = (i: number) => { if (bens.length > 1) setBens(bens.filter((_, idx) => idx !== i)); };

  const calcular = () => {
    if (bens.every(b => b.valor <= 0)) { toast.error("Adicione ao menos um bem com valor"); return; }

    let parteA = 0;
    let parteB = 0;
    let totalComum = 0;

    bens.forEach(b => {
      if (regime === "separacao") {
        if (b.tipo === "particular_a") parteA += b.valor;
        else if (b.tipo === "particular_b") parteB += b.valor;
        else { parteA += b.valor / 2; parteB += b.valor / 2; totalComum += b.valor; }
      } else if (regime === "universal") {
        totalComum += b.valor;
      } else {
        if (b.tipo === "particular_a") parteA += b.valor;
        else if (b.tipo === "particular_b") parteB += b.valor;
        else { totalComum += b.valor; }
      }
    });

    if (regime === "universal") {
      parteA = totalComum / 2;
      parteB = totalComum / 2;
    } else if (regime !== "separacao") {
      parteA += totalComum / 2;
      parteB += totalComum / 2;
    }

    setResultado({ parteA, parteB, totalComum });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-semibold">Regime de bens</Label>
        <div className="space-y-2 mt-2">
          {regimes.map(r => (
            <button
              key={r.value}
              onClick={() => setRegime(r.value)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all",
                regime === r.value ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
              )}
            >
              <p className="font-medium text-sm text-foreground">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Bens</Label>
        {bens.map((b, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex-1"><Input placeholder="Descrição" value={b.descricao} onChange={e => updateBem(i, "descricao", e.target.value)} /></div>
            <div className="w-28"><Input type="number" placeholder="Valor R$" value={b.valor || ""} onChange={e => updateBem(i, "valor", e.target.value)} /></div>
            <div className="w-36">
              <Select value={b.tipo} onValueChange={v => updateBem(i, "tipo", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comum">Comum</SelectItem>
                  <SelectItem value="particular_a">Particular A</SelectItem>
                  <SelectItem value="particular_b">Particular B</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {bens.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeBem(i)} className="text-destructive">✕</Button>}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addBem}>+ Adicionar bem</Button>
      </div>

      <Button onClick={calcular} className="w-full">Simular Partilha</Button>

      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-2 text-center">
            <p className="text-sm text-muted-foreground">Bens comuns: <strong>R$ {resultado.totalComum.toFixed(2)}</strong></p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Cônjuge A</p>
                <p className="text-xl font-bold text-foreground">R$ {resultado.parteA.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cônjuge B</p>
                <p className="text-xl font-bold text-foreground">R$ {resultado.parteB.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
