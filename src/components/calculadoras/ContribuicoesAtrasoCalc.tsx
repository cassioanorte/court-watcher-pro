import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const ALIQUOTAS: Record<string, number> = {
  "empregado": 0.20,
  "facultativo": 0.20,
  "mei": 0.05,
  "simplificado": 0.11,
};

export default function ContribuicoesAtrasoCalc() {
  const [salarioBase, setSalarioBase] = useState("");
  const [mesesAtraso, setMesesAtraso] = useState("");
  const [categoria, setCategoria] = useState("facultativo");
  const [dataInicio, setDataInicio] = useState("");
  const [resultado, setResultado] = useState<{
    contribuicaoMensal: number; totalSemJuros: number; juros: number; multa: number; totalDevido: number;
  } | null>(null);

  const calcular = () => {
    const s = parseFloat(salarioBase);
    const m = parseInt(mesesAtraso);
    if (!s || !m) { toast.error("Preencha salário e meses"); return; }

    const aliquota = ALIQUOTAS[categoria];
    const contribuicaoMensal = s * aliquota;
    const totalSemJuros = contribuicaoMensal * m;
    // Juros SELIC + multa de 10% (após vencimento)
    const juros = totalSemJuros * 0.01 * m; // ~1% a.m. SELIC
    const multa = totalSemJuros * 0.10;
    const totalDevido = totalSemJuros + juros + multa;

    setResultado({ contribuicaoMensal, totalSemJuros, juros, multa, totalDevido });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Salário Base (R$)</Label><Input type="number" value={salarioBase} onChange={e => setSalarioBase(e.target.value)} /></div>
        <div><Label>Meses em Atraso</Label><Input type="number" value={mesesAtraso} onChange={e => setMesesAtraso(e.target.value)} /></div>
        <div><Label>Categoria</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="empregado">Empregado (20%)</SelectItem>
              <SelectItem value="facultativo">Facultativo (20%)</SelectItem>
              <SelectItem value="simplificado">Simplificado (11%)</SelectItem>
              <SelectItem value="mei">MEI (5%)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Data de Início do Atraso</Label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular Contribuições</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Contribuição Mensal</span><span className="font-semibold">R$ {fmt(resultado.contribuicaoMensal)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total sem Juros/Multa</span><span className="font-semibold">R$ {fmt(resultado.totalSemJuros)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Juros (SELIC)</span><span className="font-semibold text-destructive">R$ {fmt(resultado.juros)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Multa (10%)</span><span className="font-semibold text-destructive">R$ {fmt(resultado.multa)}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Total Devido</span><span className="text-lg font-bold text-foreground">R$ {fmt(resultado.totalDevido)}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
