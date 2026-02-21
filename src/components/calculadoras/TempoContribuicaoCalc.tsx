import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import CnisUpload from "./CnisUpload";
import type { CnisDados } from "@/lib/cnisParser";

interface Vinculo {
  inicio: string;
  fim: string;
  empresa: string;
}

export default function TempoContribuicaoCalc() {
  const [vinculos, setVinculos] = useState<Vinculo[]>([{ inicio: "", fim: "", empresa: "" }]);
  const [resultado, setResultado] = useState<{ anos: number; meses: number; dias: number; totalDias: number } | null>(null);

  const handleCnisData = (dados: CnisDados) => {
    if (dados.vinculos.length > 0) {
      setVinculos(dados.vinculos.map(v => ({ inicio: v.inicio, fim: v.fim, empresa: v.empresa })));
      setResultado(dados.tempoTotal);
    }
  };

  const addVinculo = () => setVinculos([...vinculos, { inicio: "", fim: "", empresa: "" }]);
  const removeVinculo = (i: number) => setVinculos(vinculos.filter((_, idx) => idx !== i));
  const updateVinculo = (i: number, field: keyof Vinculo, value: string) => {
    const updated = [...vinculos];
    updated[i] = { ...updated[i], [field]: value };
    setVinculos(updated);
  };

  const calcular = () => {
    let totalDias = 0;
    for (const v of vinculos) {
      if (!v.inicio || !v.fim) { toast.error("Preencha todas as datas dos vínculos"); return; }
      const d1 = new Date(v.inicio);
      const d2 = new Date(v.fim);
      if (d2 <= d1) { toast.error(`Vínculo "${v.empresa || "sem nome"}" tem data fim anterior ao início`); return; }
      const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      totalDias += diff;
    }
    const anos = Math.floor(totalDias / 365);
    const meses = Math.floor((totalDias % 365) / 30);
    const dias = totalDias % 365 % 30;
    setResultado({ anos, meses, dias, totalDias });
  };

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <CnisUpload onDataExtracted={handleCnisData} />

      {vinculos.map((v, i) => (
        <Card key={i} className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Vínculo {i + 1}</span>
            {vinculos.length > 1 && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeVinculo(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Empresa</Label><Input value={v.empresa} onChange={e => updateVinculo(i, "empresa", e.target.value)} placeholder="Opcional" className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Início</Label><Input type="date" value={v.inicio} onChange={e => updateVinculo(i, "inicio", e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Fim</Label><Input type="date" value={v.fim} onChange={e => updateVinculo(i, "fim", e.target.value)} className="h-8 text-xs" /></div>
          </div>
        </Card>
      ))}
      <Button variant="outline" size="sm" onClick={addVinculo} className="w-full"><Plus className="w-3.5 h-3.5 mr-1" />Adicionar Vínculo</Button>
      <Button onClick={calcular} className="w-full">Calcular Tempo</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 text-center space-y-1">
            <p className="text-sm text-muted-foreground">Tempo Total de Contribuição</p>
            <p className="text-2xl font-bold text-foreground">{resultado.anos}a {resultado.meses}m {resultado.dias}d</p>
            <p className="text-xs text-muted-foreground">{resultado.totalDias} dias totais</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
