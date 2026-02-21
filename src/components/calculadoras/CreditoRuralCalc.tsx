import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const TAXAS_RURAIS: Record<string, { limite: number; descricao: string }> = {
  pronaf: { limite: 5.0, descricao: "PRONAF - Agricultura Familiar" },
  pronamp: { limite: 8.0, descricao: "PRONAMP - Médio Produtor" },
  investimento: { limite: 10.5, descricao: "Investimento Rural - Grande Produtor" },
  custeio: { limite: 12.0, descricao: "Custeio Rural" },
  comercializacao: { limite: 12.0, descricao: "Comercialização" },
};

export default function CreditoRuralCalc() {
  const [valorFinanciamento, setValorFinanciamento] = useState("");
  const [taxaContratual, setTaxaContratual] = useState("");
  const [modalidade, setModalidade] = useState("pronaf");
  const [parcelas, setParcelas] = useState("");
  const [carencia, setCarencia] = useState("0");
  const [resultado, setResultado] = useState<{
    taxaLimite: number; abusiva: boolean; parcelaContratual: number;
    parcelaLimite: number; diferencaTotal: number; totalContratual: number; totalLimite: number;
  } | null>(null);

  const calcular = () => {
    const v = parseFloat(valorFinanciamento);
    const tc = parseFloat(taxaContratual);
    const n = parseInt(parcelas);
    if (!v || !tc || !n) { toast.error("Preencha todos os campos obrigatórios"); return; }

    const rural = TAXAS_RURAIS[modalidade];
    const tcm = tc / 12 / 100;
    const tlm = rural.limite / 12 / 100;
    const car = parseInt(carencia) || 0;
    const saldoCarencia = v * Math.pow(1 + tcm, car);
    const saldoCarenciaLimite = v * Math.pow(1 + tlm, car);

    const pmt = (pv: number, r: number, np: number) => pv * (r * Math.pow(1 + r, np)) / (Math.pow(1 + r, np) - 1);
    const parcelaContratual = pmt(saldoCarencia, tcm, n);
    const parcelaLimite = pmt(saldoCarenciaLimite, tlm, n);
    const totalContratual = parcelaContratual * n;
    const totalLimite = parcelaLimite * n;

    setResultado({
      taxaLimite: rural.limite,
      abusiva: tc > rural.limite,
      parcelaContratual, parcelaLimite,
      diferencaTotal: totalContratual - totalLimite,
      totalContratual, totalLimite,
    });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Valor Financiado (R$)</Label><Input type="number" value={valorFinanciamento} onChange={e => setValorFinanciamento(e.target.value)} /></div>
        <div><Label>Modalidade</Label>
          <Select value={modalidade} onValueChange={setModalidade}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TAXAS_RURAIS).map(([k, v]) => <SelectItem key={k} value={k}>{v.descricao}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Taxa Contratual (% a.a.)</Label><Input type="number" value={taxaContratual} onChange={e => setTaxaContratual(e.target.value)} /></div>
        <div><Label>Nº de Parcelas</Label><Input type="number" value={parcelas} onChange={e => setParcelas(e.target.value)} /></div>
        <div className="col-span-2"><Label>Carência (meses)</Label><Input type="number" value={carencia} onChange={e => setCarencia(e.target.value)} placeholder="0" /></div>
      </div>
      <p className="text-xs text-muted-foreground">Taxa limite {TAXAS_RURAIS[modalidade].descricao}: {TAXAS_RURAIS[modalidade].limite}% a.a.</p>
      <Button onClick={calcular} className="w-full">Revisar Contrato</Button>
      {resultado && (
        <Card className={`border ${resultado.abusiva ? "bg-destructive/10 border-destructive/30" : "bg-accent/10 border-accent/30"}`}>
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Parcela Contratual</span><span className="font-semibold text-destructive">R$ {fmt(resultado.parcelaContratual)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Parcela com Taxa Limite</span><span className="font-semibold text-green-600">R$ {fmt(resultado.parcelaLimite)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total Contratual</span><span className="font-semibold">R$ {fmt(resultado.totalContratual)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total com Taxa Limite</span><span className="font-semibold">R$ {fmt(resultado.totalLimite)}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Diferença</span><span className="text-lg font-bold text-green-600">R$ {fmt(resultado.diferencaTotal)}</span></div>
            {resultado.abusiva && <p className="text-xs text-destructive font-medium mt-2">⚠ Taxa contratual acima do limite para {TAXAS_RURAIS[modalidade].descricao}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
