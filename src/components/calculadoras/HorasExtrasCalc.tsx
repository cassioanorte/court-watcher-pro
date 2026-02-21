import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function HorasExtrasCalc() {
  const [salario, setSalario] = useState("");
  const [cargaHoraria, setCargaHoraria] = useState("220");
  const [horas50, setHoras50] = useState("");
  const [horas100, setHoras100] = useState("");
  const [meses, setMeses] = useState("1");
  const [resultado, setResultado] = useState<{ valorHora: number; total50: number; total100: number; totalGeral: number } | null>(null);

  const calcular = () => {
    const sal = parseFloat(salario);
    const ch = parseFloat(cargaHoraria);
    const h50 = parseFloat(horas50) || 0;
    const h100 = parseFloat(horas100) || 0;
    const m = parseInt(meses) || 1;
    if (!sal || !ch) { toast.error("Preencha salário e carga horária"); return; }

    const valorHora = sal / ch;
    const total50 = valorHora * 1.5 * h50 * m;
    const total100 = valorHora * 2 * h100 * m;
    setResultado({ valorHora, total50, total100, totalGeral: total50 + total100 });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Salário (R$)</Label><Input type="number" value={salario} onChange={e => setSalario(e.target.value)} /></div>
        <div><Label>Carga Horária Mensal</Label><Input type="number" value={cargaHoraria} onChange={e => setCargaHoraria(e.target.value)} /></div>
        <div><Label>Horas Extras 50%</Label><Input type="number" value={horas50} onChange={e => setHoras50(e.target.value)} placeholder="Por mês" /></div>
        <div><Label>Horas Extras 100%</Label><Input type="number" value={horas100} onChange={e => setHoras100(e.target.value)} placeholder="Por mês" /></div>
      </div>
      <div><Label>Quantidade de Meses</Label><Input type="number" value={meses} onChange={e => setMeses(e.target.value)} /></div>
      <Button onClick={calcular} className="w-full">Calcular</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Valor da Hora Normal</span><span className="font-semibold">R$ {resultado.valorHora.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total HE 50%</span><span className="font-semibold">R$ {resultado.total50.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total HE 100%</span><span className="font-semibold">R$ {resultado.total100.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Total Geral</span><span className="text-lg font-bold text-foreground">R$ {resultado.totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
