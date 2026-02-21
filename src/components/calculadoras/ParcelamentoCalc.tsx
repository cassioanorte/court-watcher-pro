import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function ParcelamentoCalc() {
  const [valor, setValor] = useState("");
  const [resultado, setResultado] = useState<{ entrada: number; parcela: number; total: number } | null>(null);

  const calcular = () => {
    const v = parseFloat(valor);
    if (!v) { toast.error("Informe o valor"); return; }
    const entrada = v * 0.3;
    const restante = v - entrada;
    const juros = 0.01;
    const parcela = (restante * juros * Math.pow(1 + juros, 6)) / (Math.pow(1 + juros, 6) - 1);
    setResultado({ entrada, parcela, total: entrada + parcela * 6 });
  };

  return (
    <div className="space-y-4">
      <div><Label>Valor Total da Condenação (R$)</Label><Input type="number" value={valor} onChange={e => setValor(e.target.value)} /></div>
      <Button onClick={calcular} className="w-full">Calcular</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Entrada (30%)</span><span className="font-semibold">R$ {resultado.entrada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">6 Parcelas de</span><span className="font-semibold">R$ {resultado.parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-medium">Total</span><span className="text-lg font-bold text-foreground">R$ {resultado.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
