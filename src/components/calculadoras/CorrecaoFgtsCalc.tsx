import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface Deposito {
  competencia: string;
  valor: number;
}

interface Resultado {
  totalOriginal: number;
  totalCorrigidoTR: number;
  totalCorrigidoIPCA: number;
  diferenca: number;
}

// Taxas anuais simplificadas TR vs IPCA (médias históricas para simulação)
const taxaAnualTR = 0.02; // ~2% ao ano média
const taxaAnualIPCA = 0.055; // ~5.5% ao ano média

export default function CorrecaoFgtsCalc() {
  const [depositos, setDepositos] = useState<Deposito[]>([{ competencia: "", valor: 0 }]);
  const [saldoAtual, setSaldoAtual] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const addDeposito = () => setDepositos([...depositos, { competencia: "", valor: 0 }]);

  const updateDeposito = (i: number, field: keyof Deposito, val: string) => {
    const copy = [...depositos];
    if (field === "valor") copy[i].valor = parseFloat(val) || 0;
    else copy[i].competencia = val;
    setDepositos(copy);
  };

  const removeDeposito = (i: number) => {
    if (depositos.length <= 1) return;
    setDepositos(depositos.filter((_, idx) => idx !== i));
  };

  const calcular = () => {
    if (!dataInicio || !dataFim) { toast.error("Informe o período"); return; }

    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const anosDecorridos = (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    if (anosDecorridos <= 0) { toast.error("A data final deve ser posterior à inicial"); return; }

    // Se o usuário informou depósitos individuais
    const temDepositos = depositos.some(d => d.valor > 0);
    let totalOriginal = 0;
    let totalCorrigidoTR = 0;
    let totalCorrigidoIPCA = 0;

    if (temDepositos) {
      depositos.forEach(dep => {
        if (dep.valor <= 0) return;
        const dataDep = dep.competencia ? new Date(dep.competencia) : inicio;
        const anosDoDeposito = Math.max(0, (fim.getTime() - dataDep.getTime()) / (1000 * 60 * 60 * 24 * 365.25));

        totalOriginal += dep.valor;
        totalCorrigidoTR += dep.valor * Math.pow(1 + taxaAnualTR + 0.03, anosDoDeposito); // TR + 3% aa (juros FGTS)
        totalCorrigidoIPCA += dep.valor * Math.pow(1 + taxaAnualIPCA + 0.03, anosDoDeposito); // IPCA + 3% aa
      });
    } else if (saldoAtual) {
      // Usa saldo informado como base
      totalOriginal = parseFloat(saldoAtual) || 0;
      totalCorrigidoTR = totalOriginal * Math.pow(1 + taxaAnualTR, anosDecorridos);
      totalCorrigidoIPCA = totalOriginal * Math.pow(1 + taxaAnualIPCA, anosDecorridos);
    } else {
      toast.error("Informe os depósitos ou o saldo atual do FGTS");
      return;
    }

    setResultado({
      totalOriginal,
      totalCorrigidoTR,
      totalCorrigidoIPCA,
      diferenca: totalCorrigidoIPCA - totalCorrigidoTR,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Data Início</Label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div>
        <div><Label>Data Fim</Label><Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} /></div>
      </div>

      <div>
        <Label>Saldo Atual do FGTS (R$) - alternativa aos depósitos</Label>
        <Input type="number" value={saldoAtual} onChange={e => setSaldoAtual(e.target.value)} placeholder="Ex: 25000" />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Depósitos Individuais (opcional)</Label>
        {depositos.map((dep, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex-1"><Input type="month" value={dep.competencia} onChange={e => updateDeposito(i, "competencia", e.target.value)} /></div>
            <div className="flex-1"><Input type="number" placeholder="Valor R$" value={dep.valor || ""} onChange={e => updateDeposito(i, "valor", e.target.value)} /></div>
            {depositos.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => removeDeposito(i)} className="text-destructive">✕</Button>
            )}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addDeposito}>+ Adicionar depósito</Button>
      </div>

      <Button onClick={calcular} className="w-full">Calcular Correção</Button>

      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Total original:</span><br /><strong>R$ {resultado.totalOriginal.toFixed(2)}</strong></div>
              <div><span className="text-muted-foreground">Corrigido (TR + 3%):</span><br /><strong>R$ {resultado.totalCorrigidoTR.toFixed(2)}</strong></div>
              <div><span className="text-muted-foreground">Corrigido (IPCA + 3%):</span><br /><strong className="text-green-600">R$ {resultado.totalCorrigidoIPCA.toFixed(2)}</strong></div>
              <div><span className="text-muted-foreground">Diferença a receber:</span><br /><strong className="text-green-600">R$ {resultado.diferenca.toFixed(2)}</strong></div>
            </div>
            <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
              Diferença entre correção pela TR e IPCA conforme tese de revisão do FGTS (ADI 5090/STF).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
