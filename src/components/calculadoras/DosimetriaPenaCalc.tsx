import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export default function DosimetriaPenaCalc() {
  const [penaMinima, setPenaMinima] = useState("");
  const [penaMaxima, setPenaMaxima] = useState("");
  const [circunstanciasDesfav, setCircunstanciasDesfav] = useState([0]);
  const [agravantes, setAgravantes] = useState("0");
  const [atenuantes, setAtenuantes] = useState("0");
  const [aumento, setAumento] = useState("0");
  const [diminuicao, setDiminuicao] = useState("0");
  const [resultado, setResultado] = useState<{ penaBase: number; segunda: number; definitiva: number } | null>(null);

  const calcular = () => {
    const min = parseFloat(penaMinima);
    const max = parseFloat(penaMaxima);
    if (!min || !max) { toast.error("Informe as penas mínima e máxima"); return; }

    // 1ª fase: pena-base (proporção das circunstâncias desfavoráveis, de 0 a 8)
    const frac = circunstanciasDesfav[0] / 8;
    const penaBase = min + (max - min) * frac;

    // 2ª fase: agravantes e atenuantes (fração de 1/6)
    const agr = parseInt(agravantes) || 0;
    const ate = parseInt(atenuantes) || 0;
    const segunda = penaBase + penaBase * (1 / 6) * agr - penaBase * (1 / 6) * ate;

    // 3ª fase: causas de aumento e diminuição
    const aum = parseFloat(aumento) || 0;
    const dim = parseFloat(diminuicao) || 0;
    const definitiva = segunda * (1 + aum / 100) * (1 - dim / 100);

    setResultado({ penaBase, segunda, definitiva: Math.max(definitiva, min) });
  };

  const formatPena = (meses: number) => {
    const a = Math.floor(meses / 12);
    const m = Math.round(meses % 12);
    return `${a > 0 ? `${a} ano${a > 1 ? "s" : ""}` : ""} ${m > 0 ? `${m} mes${m !== 1 ? "es" : ""}` : ""}`.trim() || "0 meses";
  };

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Pena Mínima (meses)</Label><Input type="number" value={penaMinima} onChange={e => setPenaMinima(e.target.value)} placeholder="Ex: 12" /></div>
        <div><Label>Pena Máxima (meses)</Label><Input type="number" value={penaMaxima} onChange={e => setPenaMaxima(e.target.value)} placeholder="Ex: 360" /></div>
      </div>
      <div>
        <Label>Circunstâncias Judiciais Desfavoráveis: {circunstanciasDesfav[0]}/8</Label>
        <Slider value={circunstanciasDesfav} onValueChange={setCircunstanciasDesfav} min={0} max={8} step={1} className="mt-2" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Agravantes (qtd)</Label><Input type="number" value={agravantes} onChange={e => setAgravantes(e.target.value)} /></div>
        <div><Label>Atenuantes (qtd)</Label><Input type="number" value={atenuantes} onChange={e => setAtenuantes(e.target.value)} /></div>
        <div><Label>Causa de Aumento (%)</Label><Input type="number" value={aumento} onChange={e => setAumento(e.target.value)} placeholder="Ex: 33" /></div>
        <div><Label>Causa de Diminuição (%)</Label><Input type="number" value={diminuicao} onChange={e => setDiminuicao(e.target.value)} placeholder="Ex: 33" /></div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular Pena</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">1ª Fase (Pena-Base)</span><span className="font-semibold">{formatPena(resultado.penaBase)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">2ª Fase (Agr/Aten)</span><span className="font-semibold">{formatPena(resultado.segunda)}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Pena Definitiva</span><span className="text-lg font-bold text-foreground">{formatPena(resultado.definitiva)}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
