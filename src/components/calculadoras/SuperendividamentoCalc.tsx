import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface Divida {
  descricao: string;
  valor: number;
  parcela: number;
}

export default function SuperendividamentoCalc() {
  const [rendaMensal, setRendaMensal] = useState("");
  const [dividas, setDividas] = useState<Divida[]>([{ descricao: "", valor: 0, parcela: 0 }]);
  const [resultado, setResultado] = useState<{
    totalDividas: number; totalParcelas: number; comprometimento: number;
    minimoExistencial: number; disponivel: number; superendividado: boolean;
  } | null>(null);

  const addDivida = () => setDividas([...dividas, { descricao: "", valor: 0, parcela: 0 }]);
  const updateDivida = (i: number, field: keyof Divida, value: string) => {
    const updated = [...dividas];
    if (field === "descricao") updated[i].descricao = value;
    else updated[i][field] = parseFloat(value) || 0;
    setDividas(updated);
  };
  const removeDivida = (i: number) => setDividas(dividas.filter((_, idx) => idx !== i));

  const calcular = () => {
    const renda = parseFloat(rendaMensal);
    if (!renda) { toast.error("Informe a renda mensal"); return; }
    const totalDividas = dividas.reduce((s, d) => s + d.valor, 0);
    const totalParcelas = dividas.reduce((s, d) => s + d.parcela, 0);
    const comprometimento = (totalParcelas / renda) * 100;
    const minimoExistencial = renda * 0.25; // 25% da renda conforme Lei 14.181/2021
    const disponivel = renda - minimoExistencial;
    setResultado({ totalDividas, totalParcelas, comprometimento, minimoExistencial, disponivel, superendividado: comprometimento > 75 });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div><Label>Renda Mensal Líquida (R$)</Label><Input type="number" value={rendaMensal} onChange={e => setRendaMensal(e.target.value)} /></div>
      <div className="space-y-2">
        <Label>Dívidas</Label>
        {dividas.map((d, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_80px_auto] gap-2 items-end">
            <Input placeholder="Descrição" value={d.descricao} onChange={e => updateDivida(i, "descricao", e.target.value)} />
            <Input type="number" placeholder="Total" onChange={e => updateDivida(i, "valor", e.target.value)} />
            <Input type="number" placeholder="Parcela" onChange={e => updateDivida(i, "parcela", e.target.value)} />
            {dividas.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeDivida(i)}>✕</Button>}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addDivida}>+ Adicionar dívida</Button>
      </div>
      <Button onClick={calcular} className="w-full">Analisar Superendividamento</Button>
      {resultado && (
        <Card className={`border ${resultado.superendividado ? "bg-destructive/10 border-destructive/30" : "bg-accent/10 border-accent/30"}`}>
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total de Dívidas</span><span className="font-semibold">R$ {fmt(resultado.totalDividas)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Parcelas Mensais</span><span className="font-semibold text-destructive">R$ {fmt(resultado.totalParcelas)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Comprometimento da Renda</span><span className={`font-semibold ${resultado.comprometimento > 75 ? "text-destructive" : resultado.comprometimento > 50 ? "text-yellow-600" : "text-green-600"}`}>{resultado.comprometimento.toFixed(1)}%</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Mínimo Existencial (25%)</span><span className="font-semibold">R$ {fmt(resultado.minimoExistencial)}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Disponível p/ Pagamento</span><span className="text-lg font-bold text-foreground">R$ {fmt(resultado.disponivel)}</span></div>
            {resultado.superendividado && <p className="text-xs text-destructive font-medium mt-2">⚠ Situação de superendividamento identificada (Lei 14.181/2021)</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
