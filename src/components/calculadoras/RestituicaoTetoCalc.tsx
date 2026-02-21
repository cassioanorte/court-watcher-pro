import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function RestituicaoTetoCalc() {
  const [contribuicaoMensal, setContribuicaoMensal] = useState("");
  const [tetoVigente, setTetoVigente] = useState("8157.41");
  const [meses, setMeses] = useState("");
  const [resultado, setResultado] = useState<{
    excedenteMensal: number; totalRestituir: number; aliquotaMaxima: number;
  } | null>(null);

  const calcular = () => {
    const c = parseFloat(contribuicaoMensal);
    const t = parseFloat(tetoVigente);
    const m = parseInt(meses);
    if (!c || !t || !m) { toast.error("Preencha todos os campos"); return; }

    const aliquotaMaxima = 0.14; // 14% teto
    const contribuicaoMaxima = t * aliquotaMaxima;
    const excedente = c > contribuicaoMaxima ? c - contribuicaoMaxima : 0;
    if (excedente <= 0) { toast.error("Contribuição não excede o teto"); return; }

    setResultado({ excedenteMensal: excedente, totalRestituir: excedente * m, aliquotaMaxima: contribuicaoMaxima });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Contribuição Mensal Paga (R$)</Label><Input type="number" value={contribuicaoMensal} onChange={e => setContribuicaoMensal(e.target.value)} /></div>
        <div><Label>Teto do INSS Vigente (R$)</Label><Input type="number" value={tetoVigente} onChange={e => setTetoVigente(e.target.value)} /></div>
        <div className="col-span-2"><Label>Meses com Contribuição Acima do Teto</Label><Input type="number" value={meses} onChange={e => setMeses(e.target.value)} /></div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular Restituição</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Contribuição Máxima (14% teto)</span><span className="font-semibold">R$ {fmt(resultado.aliquotaMaxima)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Excedente Mensal</span><span className="font-semibold text-destructive">R$ {fmt(resultado.excedenteMensal)}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Total a Restituir</span><span className="text-lg font-bold text-green-600">R$ {fmt(resultado.totalRestituir)}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
