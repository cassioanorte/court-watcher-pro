import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function ParcelamentoCalc() {
  const [valorPrincipal, setValorPrincipal] = useState("");
  const [jurosMora, setJurosMora] = useState("");
  const [correcaoMonetaria, setCorrecaoMonetaria] = useState("");
  const [custasProcessuais, setCustasProcessuais] = useState("");
  const [honorariosSucumbencia, setHonorariosSucumbencia] = useState("");
  const [resultado, setResultado] = useState<{ debitoTotal: number; entrada: number; parcela: number; total: number } | null>(null);

  const calcular = () => {
    const principal = parseFloat(valorPrincipal);
    if (!principal) { toast.error("Informe o valor principal"); return; }

    const juros = parseFloat(jurosMora) || 0;
    const correcao = parseFloat(correcaoMonetaria) || 0;
    const custas = parseFloat(custasProcessuais) || 0;
    const honorarios = parseFloat(honorariosSucumbencia) || 0;

    const debitoTotal = principal + juros + correcao + custas + honorarios;
    const entrada = debitoTotal * 0.3;
    const restante = debitoTotal - entrada;
    const taxaJuros = 0.01; // 1% ao mês
    const parcela = (restante * taxaJuros * Math.pow(1 + taxaJuros, 6)) / (Math.pow(1 + taxaJuros, 6) - 1);
    const total = entrada + parcela * 6;

    setResultado({ debitoTotal, entrada, parcela, total });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <Card className="bg-accent/5 border-accent/20">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Arte. 916 do CPC:</strong> No prazo de 15 dias para embargos, confirmando o crédito, o executado poderá depositar 30% do valor e pagar o restante em até 6 parcelas mensais, acrescidas de correção monetária e juros de 1% ao mês.
          </p>
        </CardContent>
      </Card>

      <div>
        <Label className="font-semibold">Valor principal do subsídio (R$)</Label>
        <p className="text-xs text-muted-foreground mb-1">Valor original da reportagem/título executivo</p>
        <Input type="number" value={valorPrincipal} onChange={e => setValorPrincipal(e.target.value)} placeholder="Ex: 50000" />
      </div>

      <div>
        <Label className="font-semibold">Juros de mora acumulados (R$)</Label>
        <Input type="number" value={jurosMora} onChange={e => setJurosMora(e.target.value)} placeholder="0" />
      </div>

      <div>
        <Label className="font-semibold">Correção monetária acumulada (R$)</Label>
        <Input type="number" value={correcaoMonetaria} onChange={e => setCorrecaoMonetaria(e.target.value)} placeholder="0" />
      </div>

      <div>
        <Label className="font-semibold">Custas processuais (R$)</Label>
        <Input type="number" value={custasProcessuais} onChange={e => setCustasProcessuais(e.target.value)} placeholder="0" />
      </div>

      <div>
        <Label className="font-semibold">Honorários de sucumbência (R$)</Label>
        <Input type="number" value={honorariosSucumbencia} onChange={e => setHonorariosSucumbencia(e.target.value)} placeholder="0" />
      </div>

      {(parseFloat(valorPrincipal) || 0) + (parseFloat(jurosMora) || 0) + (parseFloat(correcaoMonetaria) || 0) + (parseFloat(custasProcessuais) || 0) + (parseFloat(honorariosSucumbencia) || 0) > 0 && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Débito total</p>
            <p className="text-lg font-bold text-accent">
              R$ {fmt((parseFloat(valorPrincipal) || 0) + (parseFloat(jurosMora) || 0) + (parseFloat(correcaoMonetaria) || 0) + (parseFloat(custasProcessuais) || 0) + (parseFloat(honorariosSucumbencia) || 0))}
            </p>
          </CardContent>
        </Card>
      )}

      <Button onClick={calcular} className="w-full">Calcular Parcelamento</Button>

      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Débito total</span>
              <span className="font-semibold text-foreground">R$ {fmt(resultado.debitoTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Entrada (30%)</span>
              <span className="font-semibold text-foreground">R$ {fmt(resultado.entrada)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">6 Parcelas de</span>
              <span className="font-semibold text-foreground">R$ {fmt(resultado.parcela)}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between">
              <span className="text-sm font-bold text-foreground">Total com juros</span>
              <span className="text-lg font-bold text-foreground">R$ {fmt(resultado.total)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
