import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function InssRestituicaoCalc() {
  const [beneficio, setBeneficio] = useState("");
  const [descontoMensal, setDescontoMensal] = useState("");
  const [mesesDesconto, setMesesDesconto] = useState("");
  const [valorAcordo, setValorAcordo] = useState("");
  const [resultado, setResultado] = useState<{
    totalDescontado: number; valorRestituicao: number; diferencaAcordo: number;
  } | null>(null);

  const calcular = () => {
    const b = parseFloat(beneficio);
    const d = parseFloat(descontoMensal);
    const m = parseInt(mesesDesconto);
    if (!d || !m) { toast.error("Preencha desconto mensal e meses"); return; }

    const totalDescontado = d * m;
    const va = parseFloat(valorAcordo) || 0;
    const valorRestituicao = totalDescontado;
    const diferencaAcordo = va > 0 ? totalDescontado - va : 0;

    setResultado({ totalDescontado, valorRestituicao, diferencaAcordo });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Valor do Benefício (R$)</Label><Input type="number" value={beneficio} onChange={e => setBeneficio(e.target.value)} placeholder="Opcional" /></div>
        <div><Label>Desconto Mensal (R$)</Label><Input type="number" value={descontoMensal} onChange={e => setDescontoMensal(e.target.value)} /></div>
        <div><Label>Meses de Desconto</Label><Input type="number" value={mesesDesconto} onChange={e => setMesesDesconto(e.target.value)} /></div>
        <div><Label>Valor do Acordo Administrativo (R$)</Label><Input type="number" value={valorAcordo} onChange={e => setValorAcordo(e.target.value)} placeholder="Se houver" /></div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular Restituição</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total Descontado</span><span className="font-semibold text-destructive">R$ {fmt(resultado.totalDescontado)}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Valor a Restituir</span><span className="text-lg font-bold text-green-600">R$ {fmt(resultado.valorRestituicao)}</span></div>
            {resultado.diferencaAcordo > 0 && <div className="flex justify-between"><span className="text-sm text-muted-foreground">Diferença do Acordo</span><span className="font-semibold">R$ {fmt(resultado.diferencaAcordo)}</span></div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
