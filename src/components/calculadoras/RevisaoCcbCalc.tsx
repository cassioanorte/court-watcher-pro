import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function RevisaoCcbCalc() {
  const [valorCredito, setValorCredito] = useState("");
  const [taxaNominal, setTaxaNominal] = useState("");
  const [taxaEfetiva, setTaxaEfetiva] = useState("");
  const [parcelas, setParcelas] = useState("");
  const [anatocismo, setAnatocismo] = useState(false);
  const [comissao, setComissao] = useState("");
  const [resultado, setResultado] = useState<{
    cetNominal: number; cetEfetivo: number; diferenca: number;
    totalNominal: number; totalEfetivo: number; comissaoValor: number;
    irregularidades: string[];
  } | null>(null);

  const calcular = () => {
    const v = parseFloat(valorCredito);
    const tn = parseFloat(taxaNominal) / 100;
    const te = parseFloat(taxaEfetiva) / 100;
    const n = parseInt(parcelas);
    if (!v || !tn || !n) { toast.error("Preencha valor, taxa nominal e parcelas"); return; }

    const tef = te || tn;
    const pmtNominal = v * (tn * Math.pow(1 + tn, n)) / (Math.pow(1 + tn, n) - 1);
    const pmtEfetivo = v * (tef * Math.pow(1 + tef, n)) / (Math.pow(1 + tef, n) - 1);
    const totalNominal = pmtNominal * n;
    const totalEfetivo = pmtEfetivo * n;
    const comissaoValor = parseFloat(comissao) || 0;
    const cetNominal = (Math.pow(totalNominal / v, 12 / n) - 1) * 100;
    const cetEfetivo = (Math.pow((totalEfetivo + comissaoValor) / v, 12 / n) - 1) * 100;

    const irregularidades: string[] = [];
    if (te && Math.abs(te - tn) > 0.005) irregularidades.push("Divergência entre taxa nominal e efetiva (Lei 10.931/2004)");
    if (anatocismo) irregularidades.push("Capitalização de juros identificada (anatocismo)");
    if (comissaoValor > 0) irregularidades.push("Comissão de permanência cobrada cumulativamente");
    if (cetEfetivo - cetNominal > 5) irregularidades.push("CET efetivo significativamente superior ao nominal");

    setResultado({ cetNominal, cetEfetivo, diferenca: totalEfetivo - totalNominal + comissaoValor, totalNominal, totalEfetivo, comissaoValor, irregularidades });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Valor do Crédito (R$)</Label><Input type="number" value={valorCredito} onChange={e => setValorCredito(e.target.value)} /></div>
        <div><Label>Nº de Parcelas</Label><Input type="number" value={parcelas} onChange={e => setParcelas(e.target.value)} /></div>
        <div><Label>Taxa Nominal (% a.m.)</Label><Input type="number" value={taxaNominal} onChange={e => setTaxaNominal(e.target.value)} /></div>
        <div><Label>Taxa Efetiva (% a.m.)</Label><Input type="number" value={taxaEfetiva} onChange={e => setTaxaEfetiva(e.target.value)} placeholder="Se diferente" /></div>
        <div><Label>Comissão de Permanência (R$)</Label><Input type="number" value={comissao} onChange={e => setComissao(e.target.value)} placeholder="Se houver" /></div>
        <div className="flex items-center gap-2 pt-5"><Checkbox checked={anatocismo} onCheckedChange={v => setAnatocismo(!!v)} /><Label className="cursor-pointer">Há capitalização de juros (anatocismo)?</Label></div>
      </div>
      <Button onClick={calcular} className="w-full">Revisar CCB</Button>
      {resultado && (
        <Card className={`border ${resultado.irregularidades.length > 0 ? "bg-destructive/10 border-destructive/30" : "bg-accent/10 border-accent/30"}`}>
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">CET Nominal (% a.a.)</span><span className="font-semibold">{resultado.cetNominal.toFixed(2)}%</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">CET Efetivo (% a.a.)</span><span className="font-semibold text-destructive">{resultado.cetEfetivo.toFixed(2)}%</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total Nominal</span><span className="font-semibold">R$ {fmt(resultado.totalNominal)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total Efetivo</span><span className="font-semibold">R$ {fmt(resultado.totalEfetivo)}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Diferença</span><span className="text-lg font-bold text-green-600">R$ {fmt(resultado.diferenca)}</span></div>
            {resultado.irregularidades.length > 0 && (
              <div className="mt-2 space-y-1">{resultado.irregularidades.map((ir, i) => <p key={i} className="text-xs text-destructive">⚠ {ir}</p>)}</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
