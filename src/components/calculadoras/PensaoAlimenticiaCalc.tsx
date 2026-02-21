import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export default function PensaoAlimenticiaCalc() {
  const [rendaAlimentante, setRendaAlimentante] = useState("");
  const [percentual, setPercentual] = useState([30]);
  const [filhos, setFilhos] = useState("1");
  const [resultado, setResultado] = useState<{ pensaoTotal: number; porFilho: number } | null>(null);

  const calcular = () => {
    const renda = parseFloat(rendaAlimentante);
    const f = parseInt(filhos) || 1;
    if (!renda) { toast.error("Informe a renda do alimentante"); return; }

    const pensaoTotal = renda * (percentual[0] / 100);
    setResultado({ pensaoTotal, porFilho: pensaoTotal / f });
  };

  return (
    <div className="space-y-4">
      <div><Label>Renda Líquida do Alimentante (R$)</Label><Input type="number" value={rendaAlimentante} onChange={e => setRendaAlimentante(e.target.value)} /></div>
      <div>
        <Label>Percentual: {percentual[0]}%</Label>
        <Slider value={percentual} onValueChange={setPercentual} min={10} max={50} step={5} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-1">Jurisprudência: geralmente entre 15% e 33% da renda</p>
      </div>
      <div><Label>Quantidade de Filhos</Label><Input type="number" value={filhos} onChange={e => setFilhos(e.target.value)} min={1} /></div>
      <Button onClick={calcular} className="w-full">Calcular</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Pensão Total</span><span className="font-semibold">R$ {resultado.pensaoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Por Filho</span><span className="text-lg font-bold text-foreground">R$ {resultado.porFilho.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
