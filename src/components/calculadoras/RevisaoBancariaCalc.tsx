import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function RevisaoBancariaCalc() {
  const [valorContrato, setValorContrato] = useState("");
  const [taxaContratual, setTaxaContratual] = useState("");
  const [taxaBacen, setTaxaBacen] = useState("");
  const [parcelas, setParcelas] = useState("");
  const [parcelasPagas, setParcelasPagas] = useState("");
  const [resultado, setResultado] = useState<{
    totalContratual: number; totalBacen: number; diferenca: number;
    parcelaContratual: number; parcelaBacen: number;
  } | null>(null);

  const calcular = () => {
    const v = parseFloat(valorContrato);
    const tc = parseFloat(taxaContratual) / 100;
    const tb = parseFloat(taxaBacen) / 100;
    const n = parseInt(parcelas);
    const pp = parseInt(parcelasPagas) || 0;
    if (!v || !tc || !tb || !n) { toast.error("Preencha todos os campos obrigatórios"); return; }

    const pmt = (pv: number, r: number, np: number) => pv * (r * Math.pow(1 + r, np)) / (Math.pow(1 + r, np) - 1);
    const parcelaContratual = pmt(v, tc, n);
    const parcelaBacen = pmt(v, tb, n);
    const totalContratual = parcelaContratual * n;
    const totalBacen = parcelaBacen * n;
    const diferenca = (parcelaContratual - parcelaBacen) * (pp > 0 ? pp : n);

    setResultado({ totalContratual, totalBacen, diferenca, parcelaContratual, parcelaBacen });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Valor do Contrato (R$)</Label><Input type="number" value={valorContrato} onChange={e => setValorContrato(e.target.value)} /></div>
        <div><Label>Nº de Parcelas</Label><Input type="number" value={parcelas} onChange={e => setParcelas(e.target.value)} /></div>
        <div><Label>Taxa Contratual (% a.m.)</Label><Input type="number" value={taxaContratual} onChange={e => setTaxaContratual(e.target.value)} placeholder="Ex: 3.5" /></div>
        <div><Label>Taxa Média BACEN (% a.m.)</Label><Input type="number" value={taxaBacen} onChange={e => setTaxaBacen(e.target.value)} placeholder="Ex: 1.8" /></div>
        <div className="col-span-2"><Label>Parcelas já Pagas (opcional)</Label><Input type="number" value={parcelasPagas} onChange={e => setParcelasPagas(e.target.value)} placeholder="Para calcular valor a restituir" /></div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular Revisão</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Parcela Contratual</span><span className="font-semibold text-destructive">R$ {fmt(resultado.parcelaContratual)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Parcela com Taxa BACEN</span><span className="font-semibold text-green-600">R$ {fmt(resultado.parcelaBacen)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total Contratual</span><span className="font-semibold">R$ {fmt(resultado.totalContratual)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total com Taxa BACEN</span><span className="font-semibold">R$ {fmt(resultado.totalBacen)}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Diferença (a restituir)</span><span className="text-lg font-bold text-green-600">R$ {fmt(resultado.diferenca)}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
