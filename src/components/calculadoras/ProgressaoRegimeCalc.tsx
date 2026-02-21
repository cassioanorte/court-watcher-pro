import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface Resultado {
  penaTotal: number;
  fracao: string;
  tempoNecessarioDias: number;
  diasCumpridos: number;
  diasRemidos: number;
  diasDetratados: number;
  saldo: number;
  dataProgressao: string;
  elegivel: boolean;
}

export default function ProgressaoRegimeCalc() {
  const [penaTotalAnos, setPenaTotalAnos] = useState("");
  const [penaTotalMeses, setPenaTotalMeses] = useState("");
  const [penaTotalDias, setPenaTotalDias] = useState("");
  const [regimeAtual, setRegimeAtual] = useState("fechado");
  const [crimeHediondo, setCrimeHediondo] = useState(false);
  const [reincidente, setReincidente] = useState(false);
  const [dataInicio, setDataInicio] = useState("");
  const [diasRemicao, setDiasRemicao] = useState("");
  const [diasDetracao, setDiasDetracao] = useState("");
  const [faltaGrave, setFaltaGrave] = useState(false);
  const [dataFaltaGrave, setDataFaltaGrave] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const calcular = () => {
    const anos = parseInt(penaTotalAnos) || 0;
    const meses = parseInt(penaTotalMeses) || 0;
    const dias = parseInt(penaTotalDias) || 0;
    const penaDias = anos * 365 + meses * 30 + dias;

    if (penaDias <= 0) { toast.error("Informe a pena total"); return; }
    if (!dataInicio) { toast.error("Informe a data de início do cumprimento"); return; }

    // Frações para progressão (Lei 13.964/2019 - Pacote Anticrime)
    let fracao: number;
    let fracaoLabel: string;

    if (crimeHediondo) {
      if (reincidente) {
        fracao = 60 / 100; // 3/5
        fracaoLabel = "3/5 (60%)";
      } else {
        fracao = 40 / 100; // 2/5
        fracaoLabel = "2/5 (40%)";
      }
    } else {
      if (reincidente) {
        fracao = 25 / 100; // 1/4 (reincidente específico) simplificado
        fracaoLabel = "1/4 (25%)";
      } else {
        fracao = 1 / 6;
        fracaoLabel = "1/6 (16,67%)";
      }
    }

    const tempoNecessarioDias = Math.ceil(penaDias * fracao);
    const remidos = parseInt(diasRemicao) || 0;
    const detratados = parseInt(diasDetracao) || 0;

    const inicio = new Date(dataInicio);
    const hoje = new Date();
    const diasCumpridos = Math.floor((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));

    const totalEfetivo = diasCumpridos + remidos + detratados;
    const saldo = tempoNecessarioDias - totalEfetivo;

    const dataProgressao = new Date(inicio);
    dataProgressao.setDate(dataProgressao.getDate() + Math.max(0, tempoNecessarioDias - remidos - detratados));

    // Se houve falta grave, reinicia contagem a partir da data da falta
    let dataFinal = dataProgressao;
    if (faltaGrave && dataFaltaGrave) {
      const dFalta = new Date(dataFaltaGrave);
      const novaData = new Date(dFalta);
      novaData.setDate(novaData.getDate() + tempoNecessarioDias);
      dataFinal = novaData;
    }

    setResultado({
      penaTotal: penaDias,
      fracao: fracaoLabel,
      tempoNecessarioDias,
      diasCumpridos: Math.max(0, diasCumpridos),
      diasRemidos: remidos,
      diasDetratados: detratados,
      saldo,
      dataProgressao: dataFinal.toLocaleDateString("pt-BR"),
      elegivel: saldo <= 0,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Pena (anos)</Label><Input type="number" value={penaTotalAnos} onChange={e => setPenaTotalAnos(e.target.value)} placeholder="0" /></div>
        <div><Label>Meses</Label><Input type="number" value={penaTotalMeses} onChange={e => setPenaTotalMeses(e.target.value)} placeholder="0" /></div>
        <div><Label>Dias</Label><Input type="number" value={penaTotalDias} onChange={e => setPenaTotalDias(e.target.value)} placeholder="0" /></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Regime Atual</Label>
          <Select value={regimeAtual} onValueChange={setRegimeAtual}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fechado">Fechado</SelectItem>
              <SelectItem value="semiaberto">Semiaberto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Início do Cumprimento</Label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox id="hediondo" checked={crimeHediondo} onCheckedChange={v => setCrimeHediondo(!!v)} />
          <Label htmlFor="hediondo" className="cursor-pointer">Crime hediondo ou equiparado</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="reincidente" checked={reincidente} onCheckedChange={v => setReincidente(!!v)} />
          <Label htmlFor="reincidente" className="cursor-pointer">Reincidente</Label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><Label>Dias de Remição</Label><Input type="number" value={diasRemicao} onChange={e => setDiasRemicao(e.target.value)} placeholder="0" /></div>
        <div><Label>Dias de Detração</Label><Input type="number" value={diasDetracao} onChange={e => setDiasDetracao(e.target.value)} placeholder="0" /></div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox id="falta" checked={faltaGrave} onCheckedChange={v => setFaltaGrave(!!v)} />
          <Label htmlFor="falta" className="cursor-pointer">Falta grave (interrompe contagem)</Label>
        </div>
        {faltaGrave && (
          <div><Label>Data da Falta Grave</Label><Input type="date" value={dataFaltaGrave} onChange={e => setDataFaltaGrave(e.target.value)} /></div>
        )}
      </div>

      <Button onClick={calcular} className="w-full">Calcular Progressão</Button>

      {resultado && (
        <Card className={resultado.elegivel ? "bg-green-500/10 border-green-500/30" : "bg-accent/10 border-accent/30"}>
          <CardContent className="p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Fração:</span> <strong>{resultado.fracao}</strong></div>
              <div><span className="text-muted-foreground">Tempo necessário:</span> <strong>{resultado.tempoNecessarioDias} dias</strong></div>
              <div><span className="text-muted-foreground">Dias cumpridos:</span> <strong>{resultado.diasCumpridos}</strong></div>
              <div><span className="text-muted-foreground">Remição:</span> <strong>{resultado.diasRemidos} dias</strong></div>
              <div><span className="text-muted-foreground">Detração:</span> <strong>{resultado.diasDetratados} dias</strong></div>
              <div><span className="text-muted-foreground">Saldo:</span> <strong>{resultado.saldo > 0 ? `${resultado.saldo} dias restantes` : "Cumprido"}</strong></div>
            </div>
            <div className="text-center pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground">Data prevista para progressão</p>
              <p className="text-xl font-bold text-foreground">{resultado.dataProgressao}</p>
              <p className={`text-sm font-bold ${resultado.elegivel ? "text-green-600" : "text-destructive"}`}>
                {resultado.elegivel ? "✅ ELEGÍVEL À PROGRESSÃO" : "⚠️ AINDA NÃO ELEGÍVEL"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
