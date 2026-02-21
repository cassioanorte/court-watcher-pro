import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function CapitalGiroCalc() {
  const [valorOperacao, setValorOperacao] = useState("");
  const [taxaMensal, setTaxaMensal] = useState("");
  const [parcelas, setParcelas] = useState("");
  const [iof, setIof] = useState("0.38");
  const [tarifas, setTarifas] = useState("");
  const [tipo, setTipo] = useState("capital_giro");
  const [resultado, setResultado] = useState<{
    parcelaMensal: number; totalPago: number; totalJuros: number;
    custoIof: number; custoTarifas: number; cetMensal: number; cetAnual: number;
  } | null>(null);

  const calcular = () => {
    const v = parseFloat(valorOperacao);
    const t = parseFloat(taxaMensal) / 100;
    const n = parseInt(parcelas);
    const iofRate = parseFloat(iof) / 100;
    const tar = parseFloat(tarifas) || 0;
    if (!v || !t || !n) { toast.error("Preencha valor, taxa e parcelas"); return; }

    const pmt = v * (t * Math.pow(1 + t, n)) / (Math.pow(1 + t, n) - 1);
    const totalPago = pmt * n;
    const totalJuros = totalPago - v;
    const custoIof = v * iofRate;
    const custoTarifas = tar;
    const custoTotal = totalPago + custoIof + custoTarifas;
    const cetMensal = (Math.pow(custoTotal / v, 1 / n) - 1) * 100;
    const cetAnual = (Math.pow(1 + cetMensal / 100, 12) - 1) * 100;

    setResultado({ parcelaMensal: pmt, totalPago, totalJuros, custoIof, custoTarifas, cetMensal, cetAnual });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Valor da Operação (R$)</Label><Input type="number" value={valorOperacao} onChange={e => setValorOperacao(e.target.value)} /></div>
        <div><Label>Tipo de Operação</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="capital_giro">Capital de Giro</SelectItem>
              <SelectItem value="fomento">Fomento / Factoring</SelectItem>
              <SelectItem value="desconto_duplicatas">Desconto de Duplicatas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Taxa Mensal (%)</Label><Input type="number" value={taxaMensal} onChange={e => setTaxaMensal(e.target.value)} /></div>
        <div><Label>Nº de Parcelas</Label><Input type="number" value={parcelas} onChange={e => setParcelas(e.target.value)} /></div>
        <div><Label>IOF (%)</Label><Input type="number" value={iof} onChange={e => setIof(e.target.value)} /></div>
        <div><Label>Tarifas / TAC (R$)</Label><Input type="number" value={tarifas} onChange={e => setTarifas(e.target.value)} placeholder="0" /></div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Parcela Mensal</span><span className="font-semibold">R$ {fmt(resultado.parcelaMensal)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total de Juros</span><span className="font-semibold text-destructive">R$ {fmt(resultado.totalJuros)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">IOF</span><span className="font-semibold">R$ {fmt(resultado.custoIof)}</span></div>
            {resultado.custoTarifas > 0 && <div className="flex justify-between"><span className="text-sm text-muted-foreground">Tarifas / TAC</span><span className="font-semibold">R$ {fmt(resultado.custoTarifas)}</span></div>}
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">CET</span><span className="font-semibold">{resultado.cetMensal.toFixed(2)}% a.m. / {resultado.cetAnual.toFixed(2)}% a.a.</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Total Pago</span><span className="text-lg font-bold text-foreground">R$ {fmt(resultado.totalPago)}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
