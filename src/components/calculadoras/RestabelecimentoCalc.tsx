import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function RestabelecimentoCalc() {
  const [valorBeneficioCessado, setValorBeneficioCessado] = useState("");
  const [dataCessacao, setDataCessacao] = useState("");
  const [dataRestabelecimento, setDataRestabelecimento] = useState("");
  const [resultado, setResultado] = useState<{
    rmiAtualizada: number; mesesAtrasados: number; totalAtrasados: number;
  } | null>(null);

  const calcular = () => {
    const v = parseFloat(valorBeneficioCessado);
    if (!v || !dataCessacao || !dataRestabelecimento) { toast.error("Preencha todos os campos"); return; }

    const d1 = new Date(dataCessacao);
    const d2 = new Date(dataRestabelecimento);
    const meses = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    if (meses <= 0) { toast.error("Data de restabelecimento deve ser posterior"); return; }

    // Correção pelo INPC
    const taxaInpc = 0.0045;
    const rmiAtualizada = v * Math.pow(1 + taxaInpc, meses);
    const totalAtrasados = rmiAtualizada * meses;

    setResultado({ rmiAtualizada, mesesAtrasados: meses, totalAtrasados });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Label>Valor do Benefício Cessado (RMI) (R$)</Label><Input type="number" value={valorBeneficioCessado} onChange={e => setValorBeneficioCessado(e.target.value)} /></div>
        <div><Label>Data da Cessação</Label><Input type="date" value={dataCessacao} onChange={e => setDataCessacao(e.target.value)} /></div>
        <div><Label>Data do Restabelecimento</Label><Input type="date" value={dataRestabelecimento} onChange={e => setDataRestabelecimento(e.target.value)} /></div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular Restabelecimento</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">RMI Atualizada (INPC)</span><span className="font-semibold">R$ {fmt(resultado.rmiAtualizada)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Meses Atrasados</span><span className="font-semibold">{resultado.mesesAtrasados}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Total de Atrasados</span><span className="text-lg font-bold text-green-600">R$ {fmt(resultado.totalAtrasados)}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
