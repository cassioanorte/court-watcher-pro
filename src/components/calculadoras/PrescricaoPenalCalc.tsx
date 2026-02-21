import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function PrescricaoPenalCalc() {
  const [penaAnos, setPenaAnos] = useState("");
  const [idadeReu, setIdadeReu] = useState("");
  const [tipoPresc, setTipoPresc] = useState("abstrata");
  const [dataFato, setDataFato] = useState("");
  const [resultado, setResultado] = useState<{ prazo: number; prescreveEm: string; prescrito: boolean } | null>(null);

  const calcular = () => {
    const pena = parseFloat(penaAnos);
    if (!pena) { toast.error("Informe a pena em anos"); return; }

    // Art. 109 CP - prazos prescricionais
    let prazo: number;
    if (pena > 12) prazo = 20;
    else if (pena > 8) prazo = 16;
    else if (pena > 4) prazo = 12;
    else if (pena > 2) prazo = 8;
    else if (pena >= 1) prazo = 4;
    else prazo = 3;

    // Redução pela metade se menor de 21 na data do fato ou maior de 70 na sentença
    const idade = parseInt(idadeReu);
    if (idade && (idade < 21 || idade >= 70)) prazo = prazo / 2;

    let prescreveEm = "";
    let prescrito = false;
    if (dataFato) {
      const d = new Date(dataFato);
      d.setFullYear(d.getFullYear() + prazo);
      prescreveEm = d.toLocaleDateString("pt-BR");
      prescrito = d < new Date();
    }

    setResultado({ prazo, prescreveEm, prescrito });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Pena Aplicada (anos)</Label><Input type="number" value={penaAnos} onChange={e => setPenaAnos(e.target.value)} placeholder="Ex: 4" /></div>
        <div><Label>Idade do Réu (opcional)</Label><Input type="number" value={idadeReu} onChange={e => setIdadeReu(e.target.value)} placeholder="Na data do fato" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Tipo</Label>
          <Select value={tipoPresc} onValueChange={setTipoPresc}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="abstrata">Prescrição Abstrata (PPP)</SelectItem>
              <SelectItem value="retroativa">Prescrição Retroativa</SelectItem>
              <SelectItem value="intercorrente">Prescrição Intercorrente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Data do Fato</Label><Input type="date" value={dataFato} onChange={e => setDataFato(e.target.value)} /></div>
      </div>
      <Button onClick={calcular} className="w-full">Verificar Prescrição</Button>
      {resultado && (
        <Card className={resultado.prescrito ? "bg-green-500/10 border-green-500/30" : "bg-accent/10 border-accent/30"}>
          <CardContent className="p-4 text-center space-y-1">
            <p className="text-sm text-muted-foreground">Prazo Prescricional</p>
            <p className="text-2xl font-bold text-foreground">{resultado.prazo} anos</p>
            {resultado.prescreveEm && (
              <>
                <p className="text-sm text-muted-foreground">Prescreve em: {resultado.prescreveEm}</p>
                <p className={`text-sm font-bold ${resultado.prescrito ? "text-green-600" : "text-destructive"}`}>
                  {resultado.prescrito ? "✅ PRESCRITO" : "⚠️ NÃO PRESCRITO"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
