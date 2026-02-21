import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function BuscaApreensaoCalc() {
  const [valorBem, setValorBem] = useState("");
  const [valorContrato, setValorContrato] = useState("");
  const [totalPago, setTotalPago] = useState("");
  const [parcelasRestantes, setParcelasRestantes] = useState("");
  const [valorParcela, setValorParcela] = useState("");
  const [resultado, setResultado] = useState<{
    saldoDevedor: number; valorPurga: number; percentualPago: number;
    restituicao: number; direito: string;
  } | null>(null);

  const calcular = () => {
    const vb = parseFloat(valorBem);
    const vc = parseFloat(valorContrato);
    const tp = parseFloat(totalPago);
    const pr = parseInt(parcelasRestantes);
    const vp = parseFloat(valorParcela);
    if (!vc || !tp) { toast.error("Preencha valor do contrato e total pago"); return; }

    const saldoDevedor = (pr && vp) ? pr * vp : vc - tp;
    const percentualPago = (tp / vc) * 100;
    // DL 911/69 - Purga da mora: pagamento de no mínimo 40% do financiamento
    const valorPurga = vc * 0.4 > tp ? vc * 0.4 - tp : 0;
    const restituicao = tp > vc ? tp - vc : 0;
    const direito = percentualPago >= 40
      ? "Direito à purgação da mora e manutenção na posse"
      : "Possibilidade de acordo para purgação da mora";

    setResultado({ saldoDevedor, valorPurga, percentualPago, restituicao, direito });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Valor do Bem (R$)</Label><Input type="number" value={valorBem} onChange={e => setValorBem(e.target.value)} placeholder="Opcional" /></div>
        <div><Label>Valor do Contrato (R$)</Label><Input type="number" value={valorContrato} onChange={e => setValorContrato(e.target.value)} /></div>
        <div><Label>Total já Pago (R$)</Label><Input type="number" value={totalPago} onChange={e => setTotalPago(e.target.value)} /></div>
        <div><Label>Parcelas Restantes</Label><Input type="number" value={parcelasRestantes} onChange={e => setParcelasRestantes(e.target.value)} placeholder="Opcional" /></div>
        <div className="col-span-2"><Label>Valor da Parcela (R$)</Label><Input type="number" value={valorParcela} onChange={e => setValorParcela(e.target.value)} placeholder="Opcional" /></div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular Defesa</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">% do Contrato Pago</span><span className="font-semibold">{resultado.percentualPago.toFixed(1)}%</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Saldo Devedor Estimado</span><span className="font-semibold">R$ {fmt(resultado.saldoDevedor)}</span></div>
            {resultado.valorPurga > 0 && <div className="flex justify-between"><span className="text-sm text-muted-foreground">Valor p/ Purga da Mora</span><span className="font-semibold text-yellow-600">R$ {fmt(resultado.valorPurga)}</span></div>}
            {resultado.restituicao > 0 && <div className="flex justify-between"><span className="text-sm text-muted-foreground">Valor a Restituir</span><span className="font-semibold text-green-600">R$ {fmt(resultado.restituicao)}</span></div>}
            <div className="border-t pt-2"><p className="text-xs font-medium text-foreground">{resultado.direito}</p><p className="text-xs text-muted-foreground mt-1">Base legal: DL 911/69, Art. 3º, §2º</p></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
