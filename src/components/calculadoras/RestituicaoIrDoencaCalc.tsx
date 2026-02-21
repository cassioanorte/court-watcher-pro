import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function RestituicaoIrDoencaCalc() {
  const [rendaMensal, setRendaMensal] = useState("");
  const [irRetido, setIrRetido] = useState("");
  const [meses, setMeses] = useState("");
  const [possuiLaudo, setPossuiLaudo] = useState(false);
  const [resultado, setResultado] = useState<{
    totalRetido: number; restituicao: number;
  } | null>(null);

  const calcular = () => {
    const r = parseFloat(rendaMensal);
    const ir = parseFloat(irRetido);
    const m = parseInt(meses);
    if (!ir || !m) { toast.error("Preencha IR retido e meses"); return; }

    // Lei 7.713/88 - Isenção de IR para portadores de doenças graves
    const totalRetido = ir * m;
    setResultado({ totalRetido, restituicao: totalRetido });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Renda Mensal do Benefício (R$)</Label><Input type="number" value={rendaMensal} onChange={e => setRendaMensal(e.target.value)} placeholder="Opcional" /></div>
        <div><Label>IR Retido por Mês (R$)</Label><Input type="number" value={irRetido} onChange={e => setIrRetido(e.target.value)} /></div>
        <div><Label>Meses com Retenção Indevida</Label><Input type="number" value={meses} onChange={e => setMeses(e.target.value)} /></div>
        <div className="flex items-center gap-2 pt-5"><Checkbox checked={possuiLaudo} onCheckedChange={v => setPossuiLaudo(!!v)} /><Label className="cursor-pointer">Possui laudo médico oficial?</Label></div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular Restituição</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total de IR Retido</span><span className="font-semibold text-destructive">R$ {fmt(resultado.totalRetido)}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Restituição Devida</span><span className="text-lg font-bold text-green-600">R$ {fmt(resultado.restituicao)}</span></div>
            <p className="text-xs text-muted-foreground mt-2">Base legal: Lei 7.713/88, Art. 6º, XIV</p>
            {!possuiLaudo && <p className="text-xs text-yellow-600 mt-1">⚠ Laudo médico oficial é necessário para o pedido</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
