import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

export default function DanoMoralCalc() {
  const [gravidade, setGravidade] = useState("media");
  const [tipoRelacao, setTipoRelacao] = useState("consumidor");
  const [reincidencia, setReincidencia] = useState([1]);
  const [resultado, setResultado] = useState<{ minimo: number; medio: number; maximo: number } | null>(null);

  const calcular = () => {
    const bases: Record<string, { min: number; med: number; max: number }> = {
      leve: { min: 1000, med: 3000, max: 5000 },
      media: { min: 5000, med: 10000, max: 20000 },
      grave: { min: 20000, med: 40000, max: 80000 },
      gravissima: { min: 50000, med: 100000, max: 200000 },
    };

    const multiplier: Record<string, number> = {
      consumidor: 1,
      trabalhista: 1.2,
      saude: 1.5,
      bancario: 0.8,
    };

    const base = bases[gravidade];
    const mult = multiplier[tipoRelacao] || 1;
    const reincMult = 1 + (reincidencia[0] - 1) * 0.2;

    setResultado({
      minimo: base.min * mult * reincMult,
      medio: base.med * mult * reincMult,
      maximo: base.max * mult * reincMult,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Gravidade</Label>
          <Select value={gravidade} onValueChange={setGravidade}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="leve">Leve</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="grave">Grave</SelectItem>
              <SelectItem value="gravissima">Gravíssima</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Tipo de Relação</Label>
          <Select value={tipoRelacao} onValueChange={setTipoRelacao}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="consumidor">Consumidor</SelectItem>
              <SelectItem value="trabalhista">Trabalhista</SelectItem>
              <SelectItem value="saude">Saúde/Erro Médico</SelectItem>
              <SelectItem value="bancario">Bancário</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Reincidência do Ofensor: {reincidencia[0]}x</Label>
        <Slider value={reincidencia} onValueChange={setReincidencia} min={1} max={5} step={1} className="mt-2" />
      </div>
      <Button onClick={calcular} className="w-full">Estimar Dano Moral</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Estimativa Mínima</span><span className="font-semibold">R$ {resultado.minimo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Estimativa Média</span><span className="text-lg font-bold text-foreground">R$ {resultado.medio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Estimativa Máxima</span><span className="font-semibold">R$ {resultado.maximo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <p className="text-xs text-muted-foreground mt-2 text-center">*Valores estimados com base em precedentes. Cada caso é único.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
