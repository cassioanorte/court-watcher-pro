import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function AtualizacaoDividaCalc() {
  const [valorOriginal, setValorOriginal] = useState("");
  const [taxaContratual, setTaxaContratual] = useState("");
  const [taxaJusta, setTaxaJusta] = useState("");
  const [meses, setMeses] = useState("");
  const [resultado, setResultado] = useState<{ comAbusiva: number; comJusta: number; diferenca: number } | null>(null);

  const calcular = () => {
    const v = parseFloat(valorOriginal);
    const tc = parseFloat(taxaContratual) / 100;
    const tj = parseFloat(taxaJusta) / 100;
    const m = parseInt(meses);
    if (!v || !tc || !tj || !m) { toast.error("Preencha todos os campos"); return; }

    const comAbusiva = v * Math.pow(1 + tc, m);
    const comJusta = v * Math.pow(1 + tj, m);
    setResultado({ comAbusiva, comJusta, diferenca: comAbusiva - comJusta });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Valor Original (R$)</Label><Input type="number" value={valorOriginal} onChange={e => setValorOriginal(e.target.value)} /></div>
        <div><Label>Meses</Label><Input type="number" value={meses} onChange={e => setMeses(e.target.value)} /></div>
        <div><Label>Taxa Contratual (% a.m.)</Label><Input type="number" value={taxaContratual} onChange={e => setTaxaContratual(e.target.value)} placeholder="Ex: 3.5" /></div>
        <div><Label>Taxa Justa (% a.m.)</Label><Input type="number" value={taxaJusta} onChange={e => setTaxaJusta(e.target.value)} placeholder="Ex: 1.0" /></div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Com Taxa Abusiva</span><span className="font-semibold text-destructive">R$ {resultado.comAbusiva.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Com Taxa Justa</span><span className="font-semibold text-green-600">R$ {resultado.comJusta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Diferença (a restituir)</span><span className="text-lg font-bold text-foreground">R$ {resultado.diferenca.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
