import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function ComplementacaoCalc() {
  const [salarioContribuicao, setSalarioContribuicao] = useState("");
  const [aliquotaAtual, setAliquotaAtual] = useState("5");
  const [aliquotaDesejada, setAliquotaDesejada] = useState("20");
  const [meses, setMeses] = useState("");
  const [resultado, setResultado] = useState<{
    contribuicaoAtual: number; contribuicaoDesejada: number; complementoMensal: number; totalComplemento: number;
  } | null>(null);

  const calcular = () => {
    const s = parseFloat(salarioContribuicao);
    const aa = parseFloat(aliquotaAtual) / 100;
    const ad = parseFloat(aliquotaDesejada) / 100;
    const m = parseInt(meses) || 1;
    if (!s) { toast.error("Informe o salário de contribuição"); return; }
    if (ad <= aa) { toast.error("A alíquota desejada deve ser maior que a atual"); return; }

    const contribuicaoAtual = s * aa;
    const contribuicaoDesejada = s * ad;
    const complementoMensal = contribuicaoDesejada - contribuicaoAtual;
    const totalComplemento = complementoMensal * m;

    setResultado({ contribuicaoAtual, contribuicaoDesejada, complementoMensal, totalComplemento });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Label>Salário de Contribuição (R$)</Label><Input type="number" value={salarioContribuicao} onChange={e => setSalarioContribuicao(e.target.value)} /></div>
        <div><Label>Alíquota Atual (%)</Label>
          <Select value={aliquotaAtual} onValueChange={setAliquotaAtual}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5% (MEI)</SelectItem>
              <SelectItem value="11">11% (Simplificado)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Alíquota Desejada (%)</Label>
          <Select value={aliquotaDesejada} onValueChange={setAliquotaDesejada}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="11">11% (Simplificado)</SelectItem>
              <SelectItem value="20">20% (Normal)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Meses a Complementar</Label><Input type="number" value={meses} onChange={e => setMeses(e.target.value)} placeholder="1" /></div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular Complementação</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Contribuição Atual</span><span className="font-semibold">R$ {fmt(resultado.contribuicaoAtual)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Contribuição Desejada</span><span className="font-semibold">R$ {fmt(resultado.contribuicaoDesejada)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Complemento Mensal</span><span className="font-semibold text-accent">R$ {fmt(resultado.complementoMensal)}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Total a Complementar</span><span className="text-lg font-bold text-foreground">R$ {fmt(resultado.totalComplemento)}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
