import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function JurosCompostosCalc() {
  const [capital, setCapital] = useState("");
  const [taxa, setTaxa] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [aporteMensal, setAporteMensal] = useState("0");
  const [resultado, setResultado] = useState<{ montante: number; jurosTotal: number; totalInvestido: number } | null>(null);

  const calcular = () => {
    const c = parseFloat(capital);
    const t = parseFloat(taxa) / 100;
    const p = parseInt(periodo);
    const a = parseFloat(aporteMensal) || 0;
    if (!c || !t || !p) { toast.error("Preencha capital, taxa e período"); return; }

    const montanteCapital = c * Math.pow(1 + t, p);
    const montanteAportes = a > 0 ? a * ((Math.pow(1 + t, p) - 1) / t) : 0;
    const montante = montanteCapital + montanteAportes;
    const totalInvestido = c + a * p;
    setResultado({ montante, jurosTotal: montante - totalInvestido, totalInvestido });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Capital Inicial (R$)</Label><Input type="number" value={capital} onChange={e => setCapital(e.target.value)} /></div>
        <div><Label>Taxa Mensal (%)</Label><Input type="number" value={taxa} onChange={e => setTaxa(e.target.value)} placeholder="Ex: 1.5" /></div>
        <div><Label>Período (meses)</Label><Input type="number" value={periodo} onChange={e => setPeriodo(e.target.value)} /></div>
        <div><Label>Aporte Mensal (R$)</Label><Input type="number" value={aporteMensal} onChange={e => setAporteMensal(e.target.value)} placeholder="Opcional" /></div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total Investido</span><span className="font-semibold">R$ {resultado.totalInvestido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Juros Acumulados</span><span className="font-semibold text-green-600">R$ {resultado.jurosTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Montante Final</span><span className="text-lg font-bold text-foreground">R$ {resultado.montante.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
