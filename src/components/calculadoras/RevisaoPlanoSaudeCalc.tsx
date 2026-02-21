import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Resultado {
  teses: { nome: string; aplicavel: boolean; economia: number; descricao: string }[];
  economiaTotal: number;
}

export default function RevisaoPlanoSaudeCalc() {
  const [mensalidade, setMensalidade] = useState("");
  const [faixaEtaria, setFaixaEtaria] = useState("59+");
  const [reajusteAplicado, setReajusteAplicado] = useState("");
  const [tetoAns, setTetoAns] = useState("15.9");
  const [coparticipacao, setCoparticipacao] = useState(false);
  const [cancelamento, setCancelamento] = useState(false);
  const [sinistralidade, setSinistralidade] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const calcular = () => {
    const m = parseFloat(mensalidade);
    if (!m) { toast.error("Informe a mensalidade atual"); return; }

    const reajuste = parseFloat(reajusteAplicado) || 0;
    const teto = parseFloat(tetoAns) || 15.9;
    const teses: Resultado["teses"] = [];

    // Tese 1: Teto ANS
    if (reajuste > teto) {
      const diferenca = m - (m / (1 + reajuste / 100)) * (1 + teto / 100);
      teses.push({
        nome: "Teto ANS",
        aplicavel: true,
        economia: Math.max(0, diferenca),
        descricao: `Reajuste aplicado (${reajuste}%) excede o teto ANS (${teto}%). Diferença mensal passível de restituição.`,
      });
    } else {
      teses.push({ nome: "Teto ANS", aplicavel: false, economia: 0, descricao: "Reajuste dentro do limite ANS." });
    }

    // Tese 2: Coparticipação abusiva
    if (coparticipacao) {
      const estimativa = m * 0.15;
      teses.push({
        nome: "Coparticipação",
        aplicavel: true,
        economia: estimativa,
        descricao: "Coparticipação pode configurar dupla cobrança. Economia estimada em ~15% da mensalidade.",
      });
    } else {
      teses.push({ nome: "Coparticipação", aplicavel: false, economia: 0, descricao: "Sem coparticipação informada." });
    }

    // Tese 3: Faixa etária (RN 63/Tema 1016 STJ)
    const faixaAbusiva = faixaEtaria === "59+";
    if (faixaAbusiva && reajuste > 30) {
      const economia = m * 0.20;
      teses.push({
        nome: "Faixa Etária (RN 63/Tema 1016)",
        aplicavel: true,
        economia,
        descricao: "Reajuste por faixa etária acima de 59 anos pode ser abusivo. Limitação conforme Tema 1016 STJ.",
      });
    } else {
      teses.push({ nome: "Faixa Etária (RN 63/Tema 1016)", aplicavel: false, economia: 0, descricao: "Sem indícios de abusividade na faixa etária." });
    }

    // Tese 4: Cancelamento (RN 593)
    if (cancelamento) {
      teses.push({
        nome: "Cancelamento (RN 593)",
        aplicavel: true,
        economia: m * 3,
        descricao: "Cancelamento unilateral pode gerar indenização. Estimativa de 3 mensalidades.",
      });
    } else {
      teses.push({ nome: "Cancelamento (RN 593)", aplicavel: false, economia: 0, descricao: "Sem cancelamento unilateral." });
    }

    // Tese 5: Sinistralidade/VCMH
    if (sinistralidade) {
      const economia = m * 0.10;
      teses.push({
        nome: "Sinistralidade/VCMH",
        aplicavel: true,
        economia,
        descricao: "Reajuste baseado em sinistralidade sem transparência. Economia estimada ~10%.",
      });
    } else {
      teses.push({ nome: "Sinistralidade/VCMH", aplicavel: false, economia: 0, descricao: "Sem questionamento de sinistralidade." });
    }

    const economiaTotal = teses.reduce((acc, t) => acc + t.economia, 0);
    setResultado({ teses, economiaTotal });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Mensalidade atual (R$)</Label><Input type="number" value={mensalidade} onChange={e => setMensalidade(e.target.value)} placeholder="Ex: 1200" /></div>
        <div><Label>Reajuste aplicado (%)</Label><Input type="number" value={reajusteAplicado} onChange={e => setReajusteAplicado(e.target.value)} placeholder="Ex: 25" /></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Faixa etária</Label>
          <Select value={faixaEtaria} onValueChange={setFaixaEtaria}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0-18">0–18 anos</SelectItem>
              <SelectItem value="19-23">19–23 anos</SelectItem>
              <SelectItem value="24-28">24–28 anos</SelectItem>
              <SelectItem value="29-33">29–33 anos</SelectItem>
              <SelectItem value="34-38">34–38 anos</SelectItem>
              <SelectItem value="39-43">39–43 anos</SelectItem>
              <SelectItem value="44-48">44–48 anos</SelectItem>
              <SelectItem value="49-53">49–53 anos</SelectItem>
              <SelectItem value="54-58">54–58 anos</SelectItem>
              <SelectItem value="59+">59+ anos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Teto ANS (%)</Label><Input type="number" value={tetoAns} onChange={e => setTetoAns(e.target.value)} placeholder="15.9" /></div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox id="copart" checked={coparticipacao} onCheckedChange={v => setCoparticipacao(!!v)} />
          <Label htmlFor="copart" className="cursor-pointer">Há coparticipação</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="cancel" checked={cancelamento} onCheckedChange={v => setCancelamento(!!v)} />
          <Label htmlFor="cancel" className="cursor-pointer">Cancelamento unilateral (RN 593)</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="sinist" checked={sinistralidade} onCheckedChange={v => setSinistralidade(!!v)} />
          <Label htmlFor="sinist" className="cursor-pointer">Questionamento de sinistralidade/VCMH</Label>
        </div>
      </div>

      <Button onClick={calcular} className="w-full">Analisar Teses</Button>

      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-2">
            {resultado.teses.map((t, i) => (
              <div key={i} className="flex justify-between items-start text-sm border-b border-border pb-2 last:border-0">
                <div className="flex-1">
                  <span className={`font-medium ${t.aplicavel ? "text-foreground" : "text-muted-foreground"}`}>
                    {t.aplicavel ? "✅" : "—"} {t.nome}
                  </span>
                  <p className="text-xs text-muted-foreground">{t.descricao}</p>
                </div>
                {t.aplicavel && <span className="font-bold text-foreground ml-2">R$ {t.economia.toFixed(2)}</span>}
              </div>
            ))}
            <div className="pt-2 border-t border-border text-center">
              <p className="text-sm text-muted-foreground">Economia mensal estimada</p>
              <p className="text-xl font-bold text-foreground">R$ {resultado.economiaTotal.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
